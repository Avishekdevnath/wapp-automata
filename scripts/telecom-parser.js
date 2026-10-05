/**
 * Wholesale Telecom Route & News Parser
 * - Extracts structured routes (Country, CLI/CC, Pulse, Rate, ANI, FAS)
 * - Identifies trade intent (WTS - Want To Sell vs WTB - Want To Buy)
 * - Extracts market news, outages, and regulatory updates
 * - Supports hybrid execution: Fast local heuristic regex + Optional AI LLM enhancement (Gemini/OpenAI)
 */

const COUNTRY_MAP = [
  { name: 'USA', flags: ['🇺🇸', 'US', 'USA', 'UNITED STATES', 'AMERICA'], prefixes: ['1', '+1', '1800', '1888', '1877'] },
  { name: 'Canada', flags: ['🇨🇦', 'CANADA', 'CA'], prefixes: ['1', '+1'] },
  { name: 'United Kingdom', flags: ['🇬🇧', 'UK', 'UNITED KINGDOM', 'BRITAIN'], prefixes: ['44', '+44'] },
  { name: 'Australia', flags: ['🇦🇺', 'AUSTRALIA', 'AUS'], prefixes: ['61', '+61', '614'] },
  { name: 'Germany', flags: ['🇩🇪', 'GERMANY', 'DE'], prefixes: ['49', '+49'] },
  { name: 'Hong Kong', flags: ['🇭🇰', 'HONG KONG', 'HK'], prefixes: ['852', '+852'] },
  { name: 'Bangladesh', flags: ['🇧🇩', 'BANGLADESH', 'BD'], prefixes: ['880', '+880'] },
  { name: 'India', flags: ['🇮🇳', 'INDIA', 'IND'], prefixes: ['91', '+91'] },
  { name: 'Singapore', flags: ['🇸🇬', 'SINGAPORE', 'SG'], prefixes: ['65', '+65'] },
  { name: 'Puerto Rico', flags: ['🇵🇷', 'PUERTO RICO', 'PR'], prefixes: ['1787', '1939'] },
  { name: 'Japan', flags: ['🇯🇵', 'JAPAN', 'JP'], prefixes: ['81', '+81'] },
  { name: 'Colombia', flags: ['🇨🇴', 'COLOMBIA'], prefixes: ['57', '+57'] },
  { name: 'Mexico', flags: ['🇲🇽', 'MEXICO', 'MX'], prefixes: ['52', '+52'] },
  { name: 'Brazil', flags: ['🇧🇷', 'BRAZIL', 'BR'], prefixes: ['55', '+55'] },
  { name: 'Macau', flags: ['🇲🇴', 'MACAU', 'MACAO'], prefixes: ['853', '+853'] },
  { name: 'Taiwan', flags: ['🇹🇼', 'TAIWAN', 'TW'], prefixes: ['886', '+886'] },
  { name: 'Malaysia', flags: ['🇲🇾', 'MALAYSIA', 'MY'], prefixes: ['60', '+60'] },
  { name: 'Indonesia', flags: ['🇮🇩', 'INDONESIA', 'ID'], prefixes: ['62', '+62'] },
  { name: 'China', flags: ['🇨🇳', 'CHINA', 'CN'], prefixes: ['86', '+86'] },
  { name: 'Philippines', flags: ['🇵🇭', 'PHILIPPINES', 'PH'], prefixes: ['63', '+63'] },
  { name: 'Pakistan', flags: ['🇵🇰', 'PAKISTAN', 'PK'], prefixes: ['92', '+92'] },
  { name: 'New Zealand', flags: ['🇳🇿', 'NEW ZEALAND', 'NZ'], prefixes: ['64', '+64'] },
  { name: 'UAE', flags: ['🇦🇪', 'UAE', 'DUBAI'], prefixes: ['971', '+971'] },
  { name: 'Saudi Arabia', flags: ['🇸🇦', 'SAUDI', 'KSA'], prefixes: ['966', '+966'] }
];

/**
 * Fast local regex & heuristic parser extracting telecom routes and market news
 */
function parseTelecomMessage(rawText, senderPhone = '', senderName = '') {
  if (!rawText || typeof rawText !== 'string') {
    return { isTelecom: false, routes: [], news: null };
  }

  const text = rawText.trim();
  const lower = text.toLowerCase();

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

  // 2. Identify Intent: WTS (Selling / Available) vs WTB (Buying / Looking for / Need)
  let intent = 'WTS';
  if (/\b(wtb|need|looking for|urgently required|require|buying|buyer)\b/i.test(text) && !/\b(available|wts|selling|promoting)\b/i.test(text)) {
    intent = 'WTB';
  }

  // 3. Extract Company Name & Vendor Name
  let companyName = '';
  let contactName = senderName || '';

  // Match company in bottom lines e.g. "Echolink Tel Ltd — HANI"
  const lastLines = text.split(/\r?\n/).slice(-5);
  for (const l of lastLines) {
    const compMatch = l.match(/([A-Za-z0-9\s.,&]+(?:Tel Ltd|Telecom|Telecoms|VoIP|Carrier|Networks|Communications))\s*(?:[—–-]\s*([A-Za-z0-9\s]+))?/i);
    if (compMatch) {
      companyName = compMatch[1].trim();
      if (compMatch[2] && !contactName) {
        contactName = compMatch[2].trim();
      }
      break;
    }
  }

  // 4. Default Route Type from Header (e.g., "LIVE CC CLI ROUTES")
  let defaultRouteType = 'CLI';
  if (/cc\s*cli/i.test(text)) defaultRouteType = 'CC CLI';
  else if (/cli/i.test(text) && !/non[- ]?cli/i.test(text)) defaultRouteType = 'CLI';
  else if (/non[- ]?cli/i.test(text)) defaultRouteType = 'Non-CLI';
  else if (/cc/i.test(text)) defaultRouteType = 'CC';

  // 5. Global FAS status
  const isFasFree = !/high fas|has fas/i.test(text);

  // 6. Split message into lines to parse routes
  const lines = text.split(/\r?\n+/);
  const detectedRoutes = [];
  let currentCountry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if line declares a Country
    let foundCountryInLine = null;
    for (const c of COUNTRY_MAP) {
      const match = c.flags.some(flag => {
        const re = new RegExp(`(^|[^a-zA-Z0-9])${flag}([^a-zA-Z0-9]|$)`, 'i');
        return re.test(line);
      });
      if (match) {
        foundCountryInLine = c.name;
        break;
      }
    }

    if (foundCountryInLine) {
      currentCountry = foundCountryInLine;
    }

    // Determine if this line has route attributes
    const hasRouteIndicators = /cli|ivr|dtmf|cc|fas|ani|pulse|1\/1|60\/1|60\/60|crtp|ortp|rate|display|fixed|mobile/i.test(line);

    if (currentCountry && (hasRouteIndicators || foundCountryInLine)) {
      // Line-specific Route Type or inherit default
      let routeType = defaultRouteType;
      if (/cc\s*cli/i.test(line) || (/cc/i.test(line) && /cli/i.test(line))) routeType = 'CC CLI';
      else if (/ivr/i.test(line)) routeType = 'IVR';
      else if (/non[- ]?cli/i.test(line)) routeType = 'Non-CLI';
      else if (/crtp/i.test(line)) routeType = 'CRTP';
      else if (/ortp/i.test(line)) routeType = 'ORTP';
      else if (/cli/i.test(line)) routeType = 'CLI';
      else if (/cc/i.test(line)) routeType = 'CC';

      // Billing Pulse for this specific line
      let pulse = '1/1';
      if (/60\/1/i.test(line)) pulse = '60/1';
      else if (/60\/60/i.test(line)) pulse = '60/60';
      else if (/1\/1/i.test(line)) pulse = '1/1';
      else if (/60\/1/i.test(text)) pulse = '60/1';

      // ANI Pass for this specific line
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

  const prompt = `You are a Wholesale Telecom Route Analyst. Extract structured data from this WhatsApp message into JSON.
Format required:
{
  "isTelecom": boolean,
  "intent": "WTS" | "WTB",
  "company": string | null,
  "vendor_name": string | null,
  "routes": [
    {
      "country": string,
      "route_type": "CLI" | "CC CLI" | "IVR" | "Non-CLI" | "CRTP" | "ORTP",
      "billing_pulse": "1/1" | "60/1" | "60/60",
      "rate_per_min": number | null,
      "ani_pass": string | null,
      "quality_notes": string | null,
      "fas_free": boolean
    }
  ],
  "news": {
    "category": "OUTAGE" | "REGULATION" | "MAINTENANCE" | "SCAM_WARNING",
    "headline": string,
    "affected_countries": string,
    "urgency": "LOW" | "MEDIUM" | "HIGH"
  } | null
}
Return ONLY pure JSON. No markdown ticks.`;

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
      const resultText = json.choices?.[0]?.message?.content || '';
      if (resultText) {
        const parsed = JSON.parse(resultText);
        if (Array.isArray(parsed.routes)) {
          parsed.routes = parsed.routes.map(r => ({
            ...r,
            fas_free: r.fas_free ? 1 : 0,
            intent: parsed.intent || 'WTS',
            vendor_name: parsed.vendor_name || senderName || 'Vendor',
            vendor_phone: senderPhone,
            company_name: parsed.company || null,
            raw_text: rawText.slice(0, 100)
          }));
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
  COUNTRY_MAP
};

