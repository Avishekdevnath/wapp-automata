/**
 * Telecom Outage & Regulatory Executive Summary Engine
 * Synthesizes active carrier outages, cable cuts, and regulatory warnings into an actionable brief.
 */
const { getTradingDb } = require('./db');
const { getSetting } = require('./ai-settings');

let cachedBrief = null;
let lastBriefGeneratedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Heuristic fallback summarizer if AI is offline
 */
function generateFallbackBrief(newsItems = []) {
  const highUrgency = newsItems.filter(n => n.urgency === 'HIGH');
  const outages = newsItems.filter(n => n.category === 'OUTAGE');
  const regs = newsItems.filter(n => n.category === 'REGULATION');
  const scams = newsItems.filter(n => n.category === 'SCAM_WARNING');

  let statusLevel = 'STABLE';
  let badgeColor = 'emerald';
  let headline = 'Global Telecom Routes Operating Normally';

  if (highUrgency.length > 0 || outages.length >= 2) {
    statusLevel = 'CRITICAL_DISRUPTION';
    badgeColor = 'rose';
    headline = `Critical Voice Disruptions Active: ${outages.length} Outages & ${highUrgency.length} Emergency Alerts`;
  } else if (newsItems.length > 0) {
    statusLevel = 'MODERATE_RISK';
    badgeColor = 'amber';
    headline = `Market Advisory: ${newsItems.length} Carrier Maintenance & Regulatory Notices Active`;
  }

  const affectedSet = new Set();
  newsItems.forEach(n => {
    (n.affected_countries || '').split(',').forEach(c => {
      const trimmed = c.trim();
      if (trimmed && trimmed !== 'Global') affectedSet.add(trimmed);
    });
  });

  const corridors = Array.from(affectedSet).slice(0, 5);

  const recommendations = [];
  if (outages.length > 0) {
    recommendations.push('Switch high-CPS dialer traffic to secondary IP interconnects for affected transit zones');
  }
  if (scams.length > 0) {
    recommendations.push('Enforce 100% FAS screening and reject non-CLI routes with abnormal short-duration ACD');
  }
  if (regs.length > 0) {
    recommendations.push('Confirm STIR/SHAKEN token signing and carrier compliance documentation');
  }
  if (recommendations.length === 0) {
    recommendations.push('Maintain regular trunk monitoring and benchmark daily ASR/ACD ratios');
  }

  return {
    headline,
    status_level: statusLevel,
    badge_color: badgeColor,
    active_alerts_count: newsItems.length,
    high_urgency_count: highUrgency.length,
    corridors_at_risk: corridors.length > 0 ? corridors : ['Global Traffic Stable'],
    routing_recommendations: recommendations,
    regulatory_brief: regs.length > 0
      ? `${regs.length} regulatory compliance notices active across partner networks.`
      : 'No active carrier license revocation or regulatory penalties reported today.',
    generated_at: Date.now()
  };
}

/**
 * Generates an executive brief using DeepSeek AI or heuristic fallback
 */
async function getExecutiveOutageBrief(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedBrief && (now - lastBriefGeneratedAt < CACHE_TTL_MS)) {
    return cachedBrief;
  }

  const db = getTradingDb();
  if (!db) return generateFallbackBrief([]);

  const newsItems = db.prepare('SELECT * FROM market_news ORDER BY created_at DESC LIMIT 20').all();
  if (newsItems.length === 0) {
    cachedBrief = generateFallbackBrief([]);
    lastBriefGeneratedAt = now;
    return cachedBrief;
  }

  const provider = (getSetting('AI_PROVIDER', process.env.AI_PROVIDER || 'deepseek')).toLowerCase();
  const apiKey = getSetting('DEEPSEEK_API_KEY', process.env.DEEPSEEK_API_KEY || '');

  if (!apiKey || provider === 'local') {
    cachedBrief = generateFallbackBrief(newsItems);
    lastBriefGeneratedAt = now;
    return cachedBrief;
  }

  const newsText = newsItems.map((n, i) => 
    `[Alert ${i+1}] ${n.category} (${n.urgency}) - Affects: ${n.affected_countries}: ${n.headline}. ${n.raw_text || ''}`
  ).join('\n\n');

  const prompt = `You are a Global Wholesale Telecom Chief Intelligence Officer. Synthesize these live telecom alerts into an Executive Voice Trading Brief.

Alerts:
${newsText}

TASK:
Produce pure JSON with this exact structure (no markdown fences, no formatting):
{
  "headline": "A concise executive summary headline (12-16 words)",
  "status_level": "STABLE" or "MODERATE_RISK" or "CRITICAL_DISRUPTION",
  "badge_color": "emerald" or "amber" or "rose",
  "corridors_at_risk": ["Country/Region - Description", ... up to 4],
  "routing_recommendations": ["Actionable routing or interconnect advice for traders", ... up to 3],
  "regulatory_brief": "Concise summary of regulatory compliance risks"
}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getSetting('DEEPSEEK_MODEL', 'deepseek-chat'),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 600
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const cleanJson = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      cachedBrief = {
        headline: parsed.headline || 'Telecom Network Posture Brief',
        status_level: parsed.status_level || 'MODERATE_RISK',
        badge_color: parsed.badge_color || 'amber',
        active_alerts_count: newsItems.length,
        high_urgency_count: newsItems.filter(n => n.urgency === 'HIGH').length,
        corridors_at_risk: parsed.corridors_at_risk || [],
        routing_recommendations: parsed.routing_recommendations || [],
        regulatory_brief: parsed.regulatory_brief || '',
        generated_at: now
      };
      lastBriefGeneratedAt = now;
      return cachedBrief;
    }
  } catch (err) {
    console.warn(`[exec-brief] DeepSeek call error (${err.message}), using fallback brief`);
  }

  cachedBrief = generateFallbackBrief(newsItems);
  lastBriefGeneratedAt = now;
  return cachedBrief;
}

module.exports = {
  getExecutiveOutageBrief,
  generateFallbackBrief
};
