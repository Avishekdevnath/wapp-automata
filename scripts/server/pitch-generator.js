/**
 * Wholesale Voice Trade Pitch & Negotiation Generator
 * Generates high-converting counter-offers, volume commitments, and SLA knocks.
 */
const { getSetting } = require('./ai-settings');

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
 * Deterministic fallback pitch templates if AI is offline or without API key
 */
function generateFallbackPitches(params) {
  const dest = params.destination || 'Destination';
  const type = params.routeType || 'CLI';
  const current = params.currentRate ? `$${Number(params.currentRate).toFixed(4)}` : 'your current rate';
  const target = params.targetRate ? `$${Number(params.targetRate).toFixed(4)}` : 'better price';
  const pulse = params.pulse || '1/1';
  const vendor = params.vendorName || 'Partner';
  const volume = params.volume || '100k min/day';

  return [
    {
      title: 'Aggressive Counter-Offer',
      strategy: 'Price-focused deal commitment with volume lock',
      text: `Hi ${vendor}, saw your ${dest} ${type} offer at ${current}. We have live retail traffic ready right now (~${volume}, ${pulse} pulse). If you can do ${target} FAS-free with clean ANI passing, we can route immediately. Let me know if you can match.`
    },
    {
      title: 'Quality & FAS Assurance',
      strategy: 'Zero-FAS and ANI compliance guarantee pitch',
      text: `Hello ${vendor}, we are currently looking for stable ${dest} ${type} routes with strict 0% FAS SLA and pure CLI passing. We pay promptly on short cycle. Can you confirm your current ASR/ACD and send test IPs for ${target || current}?`
    },
    {
      title: 'Quick Interconnect Knock',
      strategy: 'Low-friction test traffic invitation',
      text: `Hi ${vendor}, urgent test traffic needed for ${dest} ${type} (${pulse} pulse). Ready to test 20-50 ports today. Please send your SIP signalling IP and prefix so we can configure and launch.`
    }
  ];
}

/**
 * Generate 3 tailored trade pitches using DeepSeek / LLM or instant heuristic templates
 */
async function generateTradePitch(params = {}) {
  const provider = (getSetting('AI_PROVIDER', process.env.AI_PROVIDER || 'deepseek')).toLowerCase();
  const endpointCfg = AI_ENDPOINTS[provider] || AI_ENDPOINTS.deepseek;
  const apiKey = getSetting(endpointCfg.keyEnv, process.env[endpointCfg.keyEnv] || '');

  if (!apiKey || provider === 'local') {
    return generateFallbackPitches(params);
  }

  const model = getSetting(`${provider.toUpperCase()}_MODEL`, endpointCfg.defaultModel);
  const prompt = `You are a Senior Wholesale Telecom Voice Trading Desk Manager negotiating voice routes on WhatsApp / Skype.
Target Deal Context:
- Counterparty / Vendor: ${params.vendorName || 'Carrier Partner'}
- Destination: ${params.destination || 'Global'}
- Route Type: ${params.routeType || 'CLI'}
- Offered/Current Rate: ${params.currentRate ? '$' + params.currentRate + '/min' : 'Not specified'}
- Our Target Rate: ${params.targetRate ? '$' + params.targetRate + '/min' : 'Competitive floor'}
- Billing Pulse: ${params.pulse || '1/1'}
- Traffic Volume / Capacity: ${params.volume || '50-100k min/day'}
- Key Concern: Zero FAS (False Answer Supervision), clean ANI passing, direct interconnect.

TASK:
Generate exactly 3 distinct, professional WhatsApp trading pitches in JSON format:
1. "Aggressive Counter-Offer" (commit volume in exchange for our target rate).
2. "Quality & FAS Assurance" (demands strict 0% FAS, clean CLI, and SLA verification).
3. "Quick Interconnect Knock" (low-friction request for test IPs and quick trade).

Return ONLY raw JSON with this exact structure (no markdown fences, no explanation):
{
  "pitches": [
    { "title": "Aggressive Counter-Offer", "strategy": "...", "text": "..." },
    { "title": "Quality & FAS Assurance", "strategy": "...", "text": "..." },
    { "title": "Quick Interconnect Knock", "strategy": "...", "text": "..." }
  ]
}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(endpointCfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[pitch-gen] LLM call failed with HTTP ${res.status}, falling back to template engine`);
      return generateFallbackPitches(params);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const cleanJson = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (Array.isArray(parsed.pitches) && parsed.pitches.length > 0) {
      return parsed.pitches;
    }
    return generateFallbackPitches(params);
  } catch (err) {
    console.warn(`[pitch-gen] AI error (${err.message}), falling back to deterministic templates`);
    return generateFallbackPitches(params);
  }
}

module.exports = {
  generateTradePitch,
  generateFallbackPitches
};
