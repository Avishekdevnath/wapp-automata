const MARKET_FLOORS = {
  'USA': { 'CLI': 0.0030, 'CC CLI': 0.0040, 'IVR': 0.0020, 'Non-CLI': 0.0015 },
  'Canada': { 'CLI': 0.0035, 'CC CLI': 0.0045, 'IVR': 0.0025, 'Non-CLI': 0.0020 },
  'United Kingdom': { 'CLI': 0.0040, 'CC CLI': 0.0050, 'IVR': 0.0025, 'Non-CLI': 0.0020 },
  'Bangladesh': { 'CLI': 0.0100, 'CC CLI': 0.0110, 'IVR': 0.0070, 'Non-CLI': 0.0060 },
  'India': { 'CLI': 0.0060, 'CC CLI': 0.0070, 'IVR': 0.0045, 'Non-CLI': 0.0035 },
  'Colombia': { 'CLI': 0.0045, 'CC CLI': 0.0050, 'IVR': 0.0030, 'Non-CLI': 0.0025 },
  'Mexico': { 'CLI': 0.0050, 'CC CLI': 0.0060, 'IVR': 0.0035, 'Non-CLI': 0.0030 },
  'Brazil': { 'CLI': 0.0055, 'CC CLI': 0.0065, 'IVR': 0.0040, 'Non-CLI': 0.0030 },
  'Germany': { 'CLI': 0.0070, 'CC CLI': 0.0080, 'IVR': 0.0050, 'Non-CLI': 0.0040 },
  'Australia': { 'CLI': 0.0075, 'CC CLI': 0.0085, 'IVR': 0.0055, 'Non-CLI': 0.0045 },
  'DEFAULT': { 'CLI': 0.0035, 'CC CLI': 0.0045, 'IVR': 0.0020, 'Non-CLI': 0.0015 }
};

export function evaluateRouteFraudRisk(route = {}) {
  const country = route.country || 'Global';
  const routeType = route.route_type || 'CLI';
  const pulse = route.billing_pulse || '1/1';
  const rate = typeof route.rate_per_min === 'number' ? route.rate_per_min : null;
  const rawText = (route.raw_text || '').toLowerCase();
  const quality = (route.quality_notes || '').toLowerCase();

  let riskScore = 15;
  const flags = [];

  const countryFloors = MARKET_FLOORS[country] || MARKET_FLOORS['DEFAULT'];
  const floorPrice = countryFloors[routeType] || countryFloors['CLI'] || 0.0035;

  if (rate !== null && rate > 0) {
    if (rate < floorPrice * 0.45) {
      riskScore += 65;
      flags.push(`Rate ($${rate}/min) is >55% below viable floor ($${floorPrice}) — Severe FAS Trap Risk`);
    } else if (rate < floorPrice * 0.75) {
      riskScore += 30;
      flags.push(`Rate ($${rate}/min) is below typical carrier floor ($${floorPrice})`);
    } else if (rate <= 0.0008 && !['IVR', 'Non-CLI'].includes(routeType)) {
      riskScore += 40;
      flags.push('Unrealistically low micro-rate for retail voice');
    } else {
      flags.push(`Rate matches healthy commercial corridor for ${country}`);
    }
  }

  if (/has fas|high fas|fas alert|experiencing fas/.test(rawText) || /has fas|high fas/.test(quality)) {
    riskScore += 50;
    flags.push('Message contains explicit FAS warnings or carrier complaints');
  } else if (/0% fas|100% fas free|fas free|zero fas/.test(rawText) || /0% fas|fas free/.test(quality)) {
    riskScore = Math.max(5, riskScore - 10);
    flags.push('Explicit 0% FAS commercial guarantee stated');
  }

  if (/unregistered ani|spoof ani|random ani|fake ani/.test(rawText)) {
    riskScore += 35;
    flags.push('Route uses unregistered or randomized ANI passing');
  } else if (route.ani_pass && /86xx|1xx|clean ani|clean 86|all ani/.test(route.ani_pass.toLowerCase())) {
    riskScore = Math.max(5, riskScore - 5);
    flags.push(`Verified ANI format passing: ${route.ani_pass}`);
  }

  if (/(100%|99%)\s*acd/.test(rawText)) {
    riskScore += 25;
    flags.push('Unrealistic ACD claim (100% duration impossible on automated traffic)');
  }

  if (routeType === 'CC CLI' && pulse === '60/60') {
    riskScore += 15;
    flags.push('60/60 pulse is non-standard and costly for short-duration Call Center dialer traffic');
  }

  riskScore = Math.min(100, Math.max(0, Math.round(riskScore)));

  let riskLevel = 'LOW';
  let badge = 'Verified Safe';

  if (riskScore > 75) {
    riskLevel = 'CRITICAL';
    badge = '🚨 High FAS Risk';
  } else if (riskScore > 50) {
    riskLevel = 'HIGH';
    badge = '⚠️ Rate Notice';
  } else if (riskScore > 25) {
    riskLevel = 'MEDIUM';
    badge = 'Unverified Vendor';
  }

  return {
    riskScore,
    riskLevel,
    badge,
    flags
  };
}
