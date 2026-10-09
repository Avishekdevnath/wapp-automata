export const COUNTRY_MAP = [
  { name: 'USA', flags: ['🇺🇸', 'USA', 'UNITED STATES', 'AMERICA'], exactCodes: ['US'], prefixes: ['1', '+1', '1800', '1888', '1877'] },
  { name: 'Canada', flags: ['🇨🇦', 'CANADA'], exactCodes: ['CA'], prefixes: ['1', '+1'] },
  { name: 'United Kingdom', flags: ['🇬🇧', 'UNITED KINGDOM', 'BRITAIN', 'ENGLAND'], exactCodes: ['UK', 'GB'], prefixes: ['44', '+44'] },
  { name: 'Australia', flags: ['🇦🇺', 'AUSTRALIA'], exactCodes: ['AU', 'AUS'], prefixes: ['61', '+61', '614'] },
  { name: 'Germany', flags: ['🇩🇪', 'GERMANY'], exactCodes: ['DE'], prefixes: ['49', '+49'] },
  { name: 'Hong Kong', flags: ['🇭🇰', 'HONG KONG'], exactCodes: ['HK'], prefixes: ['852', '+852'] },
  { name: 'Bangladesh', flags: ['🇧🇩', 'BANGLADESH'], exactCodes: ['BD'], prefixes: ['880', '+880'] },
  { name: 'India', flags: ['🇮🇳', 'INDIA'], exactCodes: ['IN', 'IND'], prefixes: ['91', '+91'] },
  { name: 'Singapore', flags: ['🇸🇬', 'SINGAPORE'], exactCodes: ['SG'], prefixes: ['65', '+65'] },
  { name: 'Puerto Rico', flags: ['🇵🇷', 'PUERTO RICO'], exactCodes: ['PR'], prefixes: ['1787', '1939'] },
  { name: 'Japan', flags: ['🇯🇵', 'JAPAN'], exactCodes: ['JP'], prefixes: ['81', '+81'] },
  { name: 'Colombia', flags: ['🇨🇴', 'COLOMBIA'], exactCodes: ['CO'], prefixes: ['57', '+57'] },
  { name: 'Mexico', flags: ['🇲🇽', 'MEXICO'], exactCodes: ['MX'], prefixes: ['52', '+52'] },
  { name: 'Brazil', flags: ['🇧🇷', 'BRAZIL'], exactCodes: ['BR'], prefixes: ['55', '+55'] },
  { name: 'Macau', flags: ['🇲🇴', 'MACAU', 'MACAO'], exactCodes: ['MO'], prefixes: ['853', '+853'] },
  { name: 'Taiwan', flags: ['🇹🇼', 'TAIWAN'], exactCodes: ['TW'], prefixes: ['886', '+886'] },
  { name: 'Malaysia', flags: ['🇲🇾', 'MALAYSIA'], exactCodes: ['MY'], prefixes: ['60', '+60'] },
  { name: 'Indonesia', flags: ['🇮🇩', 'INDONESIA'], exactCodes: ['ID'], prefixes: ['62', '+62'] },
  { name: 'China', flags: ['🇨🇳', 'CHINA'], exactCodes: ['CN'], prefixes: ['86', '+86'] },
  { name: 'Philippines', flags: ['🇵🇭', 'PHILIPPINES'], exactCodes: ['PH'], prefixes: ['63', '+63'] },
  { name: 'Pakistan', flags: ['🇵🇰', 'PAKISTAN'], exactCodes: ['PK'], prefixes: ['92', '+92'] },
  { name: 'New Zealand', flags: ['🇳🇿', 'NEW ZEALAND'], exactCodes: ['NZ'], prefixes: ['64', '+64'] },
  { name: 'UAE', flags: ['🇦🇪', 'DUBAI'], exactCodes: ['UAE', 'AE'], prefixes: ['971', '+971'] },
  { name: 'Saudi Arabia', flags: ['🇸🇦', 'SAUDI', 'KSA'], exactCodes: ['SA'], prefixes: ['966', '+966'] },
  { name: 'Egypt', flags: ['🇪🇬', 'EGYPT'], exactCodes: ['EG'], prefixes: ['20', '+20'] },
  { name: 'Nigeria', flags: ['🇳🇬', 'NIGERIA'], exactCodes: ['NG'], prefixes: ['234', '+234'] },
  { name: 'South Africa', flags: ['🇿🇦', 'SOUTH AFRICA'], exactCodes: ['ZA'], prefixes: ['27', '+27'] },
  { name: 'Turkey', flags: ['🇹🇷', 'TURKEY'], exactCodes: ['TR'], prefixes: ['90', '+90'] },
  { name: 'Vietnam', flags: ['🇻🇳', 'VIETNAM'], exactCodes: ['VN'], prefixes: ['84', '+84'] },
  { name: 'France', flags: ['🇫🇷', 'FRANCE'], exactCodes: ['FR'], prefixes: ['33', '+33'] },
  { name: 'Spain', flags: ['🇪🇸', 'SPAIN'], exactCodes: ['ES'], prefixes: ['34', '+34'] },
  { name: 'Italy', flags: ['🇮🇹', 'ITALY'], exactCodes: ['IT'], prefixes: ['39', '+39'] },
  { name: 'Zimbabwe', flags: ['🇿🇼', 'ZIMBABWE', 'ZIM'], exactCodes: ['ZW'], prefixes: ['263', '+263'] }
];

export function matchCountryInLine(line) {
  if (!line || typeof line !== 'string') return null;
  for (const c of COUNTRY_MAP) {
    for (const f of c.flags) {
      if (f.length > 2) {
        const re = new RegExp(`(^|[^a-zA-Z0-9])${f}([^a-zA-Z0-9]|$)`, 'i');
        if (re.test(line)) return c.name;
      } else {
        if (line.includes(f)) return c.name;
      }
    }
    if (c.exactCodes) {
      for (const code of c.exactCodes) {
        const uppercaseMatch = new RegExp(`(^|[^a-zA-Z0-9])${code}([^a-zA-Z0-9]|$)`).test(line);
        const suffixMatch = new RegExp(`(^|[^a-zA-Z0-9])${code}\\s+(?:cli|ncli|non-cli|cc|ivr|mobile|fixed|did|ani|pulse|rate)`, 'i').test(line);
        if (uppercaseMatch || suffixMatch) {
          return c.name;
        }
      }
    }
  }
  return null;
}

export function parseTelecomMessage(rawText, senderPhone = '', senderName = '') {
  if (!rawText || typeof rawText !== 'string') {
    return { isTelecom: false, routes: [], news: null };
  }

  const text = rawText.trim();
  const lower = text.toLowerCase();

  const isWholesale = /\b(cli|non-cli|ncli|ivr|did|cc cli|cc|ani|pulse|rate|rates|route|routes|traffic|carrier|gateway|voip|dialer|ports|fas|asr|acd|wtb|wts|need|looking for|buying|selling|cpm|interconnect|termination|daily capacity)\b/i.test(text);

  const isNews = /outage|down|maintenance|blocked|warning|regulation|ncc|fcc|scam|fraud|alert|degraded|latency|fiber cut/i.test(text);
  let newsRecord = null;
  if (isNews && (lower.includes('route') || lower.includes('traffic') || lower.includes('carrier') || lower.includes('gateway') || lower.includes('cli') || lower.includes('pulse') || lower.includes('partners'))) {
    let category = 'MAINTENANCE';
    if (/outage|down|fiber cut/i.test(text)) category = 'OUTAGE';
    else if (/regulation|ncc|fcc|law|license/i.test(text)) category = 'REGULATION';
    else if (/scam|fraud|fas alert|spoofing/i.test(text)) category = 'SCAM_WARNING';

    let urgency = 'MEDIUM';
    if (/urgent|critical|emergency|immediately|high fas/i.test(text)) urgency = 'HIGH';

    const affected = [];
    for (const c of COUNTRY_MAP) {
      if (c.flags.some(f => text.toUpperCase().includes(f))) {
        affected.push(c.name);
      }
    }

    newsRecord = {
      category,
      headline: text.split('\n')[0].replace(/^[🔥✨⚠️🚨\s]+/, '').slice(0, 150),
      affected_countries: affected.length > 0 ? affected.join(', ') : 'Global',
      urgency,
      raw_text: text
    };
  }

  if (!isWholesale && !newsRecord) {
    return {
      isTelecom: false,
      intent: 'WTS',
      company: null,
      vendor_name: senderName || null,
      routes: [],
      news: null
    };
  }

  let intent = 'WTS';
  if (/\b(wtb|need|looking for|urgently required|require|buying|buyer)\b/i.test(text) && !/\b(available|wts|selling|promoting)\b/i.test(text)) {
    intent = 'WTB';
  }

  let companyName = '';
  let contactName = senderName || '';

  if (senderName && senderName.includes('|')) {
    const parts = senderName.split('|').map(s => s.trim());
    if (parts[0]) contactName = parts[0];
    if (parts[1]) companyName = parts[1];
  }

  const explicitComp = text.match(/\b(?:company|carrier|provider|org):\s*([A-Za-z0-9\s.,&'-]+?)(?:\s*(?:\||whatsapp|skype|email|phone|telegram|\+|$|\n))/i);
  if (explicitComp && explicitComp[1].trim().length > 1) {
    companyName = explicitComp[1].trim();
  }

  if (!companyName) {
    const compRegex = /\b([A-Z][a-zA-Z0-9&'-]+(?:\s+[A-Z][a-zA-Z0-9&'-]+){0,3}\s+(?:LLC|Inc\.?|Ltd\.?|Limited|Telecom|Telecoms|VoIP|Carrier|Networks|Communications|Trading|Solutions|GmbH))\b/;
    const m = text.match(compRegex);
    if (m && !m[1].toLowerCase().includes('group')) {
      companyName = m[1].replace(/^(?:contact|from|at|route|clean|ping)\s+/i, '').trim();
    }
  }

  let defaultRouteType = 'CLI';
  if (/cc\s*cli/i.test(text)) defaultRouteType = 'CC CLI';
  else if (/cli/i.test(text) && !/non[- ]?cli/i.test(text)) defaultRouteType = 'CLI';
  else if (/non[- ]?cli/i.test(text)) defaultRouteType = 'Non-CLI';
  else if (/cc/i.test(text)) defaultRouteType = 'CC';

  const isFasFree = !/high fas|has fas/i.test(text);
  const detectedRoutes = [];
  let currentCountry = null;
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const foundCountryInLine = matchCountryInLine(line);
    if (foundCountryInLine) {
      currentCountry = foundCountryInLine;
    }

    const hasRouteIndicators = /cli|ivr|dtmf|cc|fas|ani|pulse|1\/1|60\/1|60\/60|crtp|ortp|rate|daily|ports|capacity|mobile|fixed/i.test(line);

    let rate = null;
    const rateMatch = line.match(/(?:@|\$|rate:?|price:?|usd)?\s*([0-9]+\.[0-9]{2,6})\s*(?:usd|\/min|cents?|\$)?/i) ||
                      line.match(/([0-9]+\.[0-9]{2,6})\s*(?:usd|\$|\/min)/i);
    if (rateMatch) {
      const parsedVal = parseFloat(rateMatch[1]);
      if (parsedVal > 0 && parsedVal <= 5.0) {
        rate = parsedVal;
      }
    }

    if (currentCountry && (rate !== null || hasRouteIndicators)) {
      let routeType = defaultRouteType;
      if (/cc\s*cli/i.test(line) || (/cc/i.test(line) && /cli/i.test(line))) routeType = 'CC CLI';
      else if (/ivr/i.test(line)) routeType = 'IVR';
      else if (/non[- ]?cli/i.test(line)) routeType = 'Non-CLI';
      else if (/crtp/i.test(line)) routeType = 'CRTP';
      else if (/ortp/i.test(line)) routeType = 'ORTP';
      else if (/cli/i.test(line)) routeType = 'CLI';
      else if (/cc/i.test(line)) routeType = 'CC';

      let pulse = '1/1';
      if (/60\/1/i.test(line)) pulse = '60/1';
      else if (/60\/60/i.test(line)) pulse = '60/60';
      else if (/1\/1/i.test(line)) pulse = '1/1';

      let ani = null;
      const aniMatch = line.match(/(\+?\d+xx\/\+?\d+xx|\+?\d+xx|all ani|\+?1 & 86 ani|\d+ ani|\d+xxx)/i);
      if (aniMatch) ani = aniMatch[0].trim();

      let quality = '';
      if (/local correct/i.test(line)) quality = 'Local Correct Display';
      else if (/correct display/i.test(line)) quality = 'Correct Display';
      else if (/dtmf/i.test(line)) quality = 'DTMF Supported';
      else if (/outbound|live calls passing/i.test(line)) quality = 'Live Calls Passing';

      detectedRoutes.push({
        country: currentCountry,
        route_type: routeType,
        billing_pulse: pulse,
        rate_per_min: rate,
        ani_pass: ani,
        quality_notes: quality || null,
        fas_free: isFasFree ? 1 : 0,
        intent,
        vendor_name: contactName || senderName || 'Direct Vendor',
        vendor_phone: senderPhone || 'Unknown Phone',
        company_name: companyName || null,
        raw_text: line
      });
    }
  }

  return {
    isTelecom: detectedRoutes.length > 0 || Boolean(newsRecord),
    intent,
    company: companyName || null,
    vendor_name: contactName || senderName || null,
    routes: detectedRoutes,
    news: newsRecord
  };
}
