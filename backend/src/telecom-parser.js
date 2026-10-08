/**
 * Wholesale Telecom Route & News Parser
 * - Extracts structured routes (Country, CLI/CC, Pulse, Rate, ANI, FAS)
 * - Identifies trade intent (WTS - Want To Sell vs WTB - Want To Buy)
 * - Extracts market news, outages, and regulatory updates
 * - Supports hybrid execution: Fast local heuristic regex + Optional AI LLM enhancement (Gemini/OpenAI)
 */

const COUNTRY_MAP = [
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
  { name: 'Italy', flags: ['🇮🇹', 'ITALY'], exactCodes: ['IT'], prefixes: ['39', '+39'] }
];

function matchCountryInLine(line) {
  if (!line || typeof line !== 'string') return null;
  for (const c of COUNTRY_MAP) {
    // 1. Full names & flag emojis (case-insensitive)
    for (const f of c.flags) {
      if (f.length > 2) {
        const re = new RegExp(`(^|[^a-zA-Z0-9])${f}([^a-zA-Z0-9]|$)`, 'i');
        if (re.test(line)) return c.name;
      } else {
        if (line.includes(f)) return c.name;
      }
    }
    // 2. Exact 2-letter codes (STRICT UPPERCASE ONLY or followed by telecom keyword)
    if (c.exactCodes) {
      for (const code of c.exactCodes) {
        const uppercaseMatch = new RegExp(`(^|[^a-zA-Z0-9])${code}([^a-zA-Z0-9]|$)`).test(line);
        const telecomSuffixMatch = new RegExp(`(^|[^a-zA-Z0-9])${code}\\s+(?:cli|ncli|non-cli|cc|ivr|mobile|fixed|did|ani|pulse|rate)`, 'i').test(line);
        if (uppercaseMatch || telecomSuffixMatch) {
          return c.name;
        }
      }
    }
  }
  return null;
}

/**
 * Fast local regex & heuristic parser extracting telecom routes and market news
 */
function parseTelecomMessage(rawText, senderPhone = '', senderName = '') {
  if (!rawText || typeof rawText !== 'string') {
    return { isTelecom: false, routes: [], news: null };
  }

  const text = rawText.trim();
  const lower = text.toLowerCase();

  // STRICT PRE-FILTER: Must contain telecom wholesale trading keywords
  const isWholesale = /\b(cli|non-cli|ncli|ivr|did|cc cli|cc|ani|pulse|rate|rates|route|routes|traffic|carrier|gateway|voip|dialer|ports|fas|asr|acd|wtb|wts|need|looking for|buying|selling|cpm|interconnect|termination|daily capacity)\b/i.test(text);

  // 1. Check if this is a telecom news or outage alert
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

  // 2. Identify Intent: WTS (Selling / Available) vs WTB (Buying / Looking for / Need)
  let intent = 'WTS';
  if (/\b(wtb|need|looking for|urgently required|require|buying|buyer)\b/i.test(text) && !/\b(available|wts|selling|promoting)\b/i.test(text)) {
    intent = 'WTB';
  }

  // 3. Extract Company Name & Vendor Name from Signature / Sender
  let companyName = '';
  let contactName = senderName || '';

  // Extract from pushName if formatted like "Name | Company"
  if (senderName && senderName.includes('|')) {
    const parts = senderName.split('|').map(s => s.trim());
    if (parts[0]) contactName = parts[0];
    if (parts[1]) companyName = parts[1];
  }

  // Check explicit Company / Carrier / Provider prefix
  const explicitComp = text.match(/\b(?:company|carrier|provider|org):\s*([A-Za-z0-9\s.,&'-]+?)(?:\s*(?:\||whatsapp|skype|email|phone|telegram|\+|$|\n))/i);
  if (explicitComp && explicitComp[1].trim().length > 1) {
    companyName = explicitComp[1].trim();
  }

  // Check explicit Contact Person prefix
  const explicitContact = text.match(/\b(?:contact|contact person|ping|reach us at):?\s*([A-Za-z0-9\s.,&'-]+?)(?:\s*(?:\||whatsapp|skype|email|phone|telegram|\+|$|\n))/i);
  if (explicitContact && explicitContact[1].trim().length > 1) {
    const candidate = explicitContact[1].trim();
    if (/(?:LLC|Inc\.?|Ltd\.?|Telecom|VoIP|Carrier|Networks|Trading)/i.test(candidate)) {
      if (!companyName) companyName = candidate;
    } else if (!contactName || contactName.startsWith('+')) {
      contactName = candidate;
    }
  }

  // Extract company from signature in lines or text
  if (!companyName) {
    const compRegex = /\b([A-Z][a-zA-Z0-9&'-]+(?:\s+[A-Z][a-zA-Z0-9&'-]+){0,3}\s+(?:LLC|Inc\.?|Ltd\.?|Limited|Telecom|Telecoms|VoIP|Carrier|Networks|Communications|Trading|Solutions|GmbH))\b/;
    const m = text.match(compRegex);
    if (m && !m[1].toLowerCase().includes('group')) {
      companyName = m[1].replace(/^(?:contact|from|at|route|clean|ping)\s+/i, '').trim();
    }
  }

  // Email domain detection: e.g. sales@voicetrade.com -> VoiceTrade
  if (!companyName) {
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,})/);
    if (emailMatch && !/gmail|yahoo|hotmail|outlook|proton/i.test(emailMatch[1])) {
      const brand = emailMatch[1].replace(/[-_]/g, ' ');
      companyName = brand.charAt(0).toUpperCase() + brand.slice(1);
    }
  }

  // 4. Default Route Type from Header
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

    // Determine if this line has genuine wholesale route attributes
    const hasRouteIndicators = /cli|ivr|dtmf|cc|fas|ani|pulse|1\/1|60\/1|60\/60|crtp|ortp|rate|daily|ports|capacity|mobile|fixed/i.test(line);

    // Rate / Price per minute candidate
    let rate = null;
    const rateMatch = line.match(/(?:@|\$|rate:?|price:?|usd)?\s*([0-9]+\.[0-9]{2,6})\s*(?:usd|\/min|cents?|\$)?/i) ||
                      line.match(/([0-9]+\.[0-9]{2,6})\s*(?:usd|\$|\/min)/i);
    if (rateMatch) {
      const parsedVal = parseFloat(rateMatch[1]);
      if (parsedVal > 0 && parsedVal <= 5.0) {
        rate = parsedVal;
      }
    }

    // A valid route line MUST have a destination AND (a rate OR route quality OR explicit pulse)
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
      else if (/60\/1/i.test(text)) pulse = '60/1';

      let ani = null;
      const aniMatch = line.match(/(\+?\d+xx\/\+?\d+xx|\+?\d+xx|all ani|\+?1 & 86 ani|\d+ ani|\d+xxx)/i) ||
                       text.match(/(\+?\d+xx\/\+?\d+xx|\+?\d+xx|all ani|\+?1 & 86 ani|\d+ ani)/i);
      if (aniMatch) ani = aniMatch[0].trim();

      // Price / Rate per minute
      let rate = null;
      const rateMatch = line.match(/\$?(\d+\.\d{2,6})\s*(?:usd|\/min|cents)?/i);
      if (rateMatch) {
        rate = parseFloat(rateMatch[1]);
      }

      // Quality notes
      let quality = '';
      if (/local correct/i.test(line)) quality = 'Local Correct Display';
      else if (/correct display/i.test(line)) quality = 'Correct Display';
      else if (/dtmf/i.test(line)) quality = 'DTMF Supported';
      else if (/outbound|live calls passing/i.test(line)) quality = 'Live Calls Passing';
      else if (/cellphone/i.test(line)) quality = 'Mobile / Cellphone';

      detectedRoutes.push({
        country: currentCountry,
        route_type: routeType,
        billing_pulse: pulse,
        rate_per_min: rate,
        ani_pass: ani,
        quality_notes: quality || null,
        fas_free: isFasFree ? 1 : 0,
        intent: intent,
        vendor_name: contactName || 'Vendor',
        vendor_phone: senderPhone,
        company_name: companyName || null,
        raw_text: line
      });
    }
  }

  // Deduplicate routes in same message for same country + type + pulse
  const uniqueRoutes = [];
  const seenKey = new Set();
  for (const r of detectedRoutes) {
    const key = `${r.country}_${r.route_type}_${r.billing_pulse}`;
    if (!seenKey.has(key)) {
      seenKey.add(key);
      uniqueRoutes.push(r);
    }
  }

  const isTelecom = uniqueRoutes.length > 0 || newsRecord !== null;

  return {
    isTelecom,
    intent,
    company: companyName,
    vendor_name: contactName,
    routes: uniqueRoutes,
    news: newsRecord
  };
}

/**
 * AI-Powered extraction using DeepSeek, OpenAI, Grok, or Local Regex
 */
let getSettingFn = (k, def = '') => process.env[k] || def;
try {
  const settingsModule = require('./server/ai-settings');
  if (settingsModule && settingsModule.getSetting) {
    getSettingFn = settingsModule.getSetting;
  }
} catch (_) {}

const AI_ENDPOINTS = {
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    keyEnv: 'DEEPSEEK_API_KEY'
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    keyEnv: 'OPENAI_API_KEY'
  },
  grok: {
    url: 'https://api.x.ai/v1/chat/completions',
    defaultModel: 'grok-beta',
    keyEnv: 'GROK_API_KEY'
  }
};

/**
 * Scans raw text for all numeric candidates (handling $, decimals, commas, cents, ports)
 */
function extractNumericCandidates(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const candidates = [];
  const matches = rawText.match(/(?:[\$€£])?\b\d+\.\d+\b|(?:\s|^)\.\d+\b|\b\d+,\d+\b|\b\d+(?:\.\d+)?\s*(?:c|cents?)\b|\b\d+\b/gi) || [];
  for (const m of matches) {
    const trimmed = m.trim();
    if (/c|cent/i.test(trimmed)) {
      const n = parseFloat(trimmed.replace(/[^0-9.]/g, ''));
      if (!isNaN(n)) candidates.push(n / 100);
    } else {
      const clean = trimmed.replace(/[\$€£]/g, '').replace(',', '.');
      const v = parseFloat(clean);
      if (!isNaN(v)) candidates.push(v);
    }
  }
  return candidates;
}

/**
 * Validates that an extracted rate actually exists in the raw text within float tolerance
 */
function verifyRatePresence(rate, candidates) {
  if (rate === null || rate === undefined) return null;
  if (typeof rate !== 'number' || isNaN(rate)) return null;
  // Rates per min in wholesale voice are never negative and realistically never > $5.00/min
  if (rate <= 0 || rate > 5.0) return null;

  for (const c of candidates) {
    if (Math.abs(rate - c) < 0.00005) {
      return rate;
    }
  }
  // If not mathematically found in text, reject as hallucination
  return null;
}

async function extractTelecomWithAI(rawText, senderPhone = '', senderName = '') {
  const provider = (getSettingFn('AI_PROVIDER', process.env.AI_PROVIDER || 'deepseek')).toLowerCase();
  
  if (provider === 'local') {
    return parseTelecomMessage(rawText, senderPhone, senderName);
  }

  const endpointCfg = AI_ENDPOINTS[provider] || AI_ENDPOINTS.deepseek;
  const apiKey = getSettingFn(endpointCfg.keyEnv, process.env[endpointCfg.keyEnv] || process.env.AI_API_KEY || '');

  if (!apiKey) {
    // Fall back to local regex parser
    return parseTelecomMessage(rawText, senderPhone, senderName);
  }

  const prompt = `You are a Wholesale Telecom Voice Trading Analyst. Extract verified structured routes from the message into pure JSON.

STRICT ZERO-HALLUCINATION RULES:
1. ZERO INVENTIONS: If rate, pulse, or ANI is NOT explicitly stated in text, you MUST output null. NEVER guess or assume defaults.
2. PORTS VS RATES: Numbers with "ports", "channels", or integers > 10 (e.g. 500 ports) are CAPACITY, NEVER the rate_per_min.
3. QUALITY METRICS: Percentages (e.g. 45% ASR) and duration (e.g. 3.5m ACD) are quality metrics, NEVER the rate_per_min.
4. RATE VALUES: Rate per minute is in USD decimals (e.g. 0.0062). If formatted as cents (e.g. "1.2c"), convert to 0.012. If unstated, rate_per_min MUST be null.
5. INTENT: "WTS" if selling/available/offering. "WTB" if buying/need/looking for.
6. ROUTE TYPE: Must strictly be one of: ["CLI", "CC CLI", "IVR", "Non-CLI", "CRTP", "ORTP"]. Default to "CLI" if ambiguous.
7. BILLING PULSE: Must strictly be one of: ["1/1", "60/1", "60/60"] or null.

FEW-SHOT EXAMPLES:
Input: "Direct Colombia CC CLI 1/1 clean 86xx at $0.0062/min LatinTel Carlos"
Output: {"isTelecom":true,"intent":"WTS","company":"LatinTel","vendor_name":"Carlos","routes":[{"country":"Colombia","route_type":"CC CLI","billing_pulse":"1/1","rate_per_min":0.0062,"ani_pass":"86xx","quality_notes":"clean","fas_free":true}],"news":null}

Input: "Need 500 ports USA CC CLI 1/1 target 0.0070 VoxTel Sarah"
Output: {"isTelecom":true,"intent":"WTB","company":"VoxTel","vendor_name":"Sarah","routes":[{"country":"USA","route_type":"CC CLI","billing_pulse":"1/1","rate_per_min":0.0070,"ani_pass":null,"quality_notes":"500 ports capacity","fas_free":true}],"news":null}

Input: "Good morning team, please send payment receipt for invoice 492"
Output: {"isTelecom":false,"intent":"WTS","company":null,"vendor_name":null,"routes":[],"news":null}

Return ONLY valid JSON.`;

  try {
    const res = await fetch(endpointCfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: endpointCfg.defaultModel,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: rawText }
        ],
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const json = await res.json();
      let resultText = json.choices?.[0]?.message?.content || '';
      // Strip any markdown code fences if emitted
      resultText = resultText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

      if (resultText) {
        const parsed = JSON.parse(resultText);
        const candidates = extractNumericCandidates(rawText);

        if (Array.isArray(parsed.routes)) {
          const allowedTypes = ['CLI', 'CC CLI', 'IVR', 'Non-CLI', 'CRTP', 'ORTP'];
          const allowedPulses = ['1/1', '60/1', '60/60'];

          parsed.routes = parsed.routes.map(r => {
            // Guardrail 1: Numeric float presence check
            const verifiedRate = verifyRatePresence(r.rate_per_min, candidates);

            // Guardrail 2: Strict enum sanitization
            let cleanType = allowedTypes.includes(r.route_type) ? r.route_type : 'CLI';
            let cleanPulse = allowedPulses.includes(r.billing_pulse) ? r.billing_pulse : (r.billing_pulse ? '1/1' : null);

            return {
              ...r,
              route_type: cleanType,
              billing_pulse: cleanPulse,
              rate_per_min: verifiedRate,
              fas_free: r.fas_free ? 1 : 0,
              intent: parsed.intent || 'WTS',
              vendor_name: parsed.vendor_name || senderName || 'Vendor',
              vendor_phone: senderPhone,
              company_name: parsed.company || null,
              raw_text: rawText.slice(0, 100)
            };
          });
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[Telecom Parser] ${provider} extraction notice, using local regex:`, err.message);
  }

  // Fallback to local heuristic parser
  return parseTelecomMessage(rawText, senderPhone, senderName);
}

module.exports = {
  parseTelecomMessage,
  extractTelecomWithAI,
  extractNumericCandidates,
  verifyRatePresence,
  COUNTRY_MAP
};

