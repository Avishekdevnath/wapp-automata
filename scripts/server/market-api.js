/**
 * Market Analytics & Intelligence APIs
 * - GET /api/trends: Historical pricing data for Chart.js
 * - GET /api/news: Outage, fraud and regulatory alerts
 * - GET /api/vendors: Directory of telecom providers
 * - GET /api/insights: Arbitrage deal matching
 */
const { getTradingDb } = require('./db');

function handleTrendsGet(req, res, parsedUrl) {
  const db = getTradingDb();
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  const days = parseInt(parsedUrl.searchParams.get('days') || '30', 10);
  const country = parsedUrl.searchParams.get('country') || '';
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

  let sql = `
    SELECT 
      date(created_at / 1000, 'unixepoch') AS day,
      country,
      route_type,
      ROUND(MIN(rate_per_min), 5) AS min_rate,
      ROUND(AVG(rate_per_min), 5) AS avg_rate,
      ROUND(MAX(rate_per_min), 5) AS max_rate,
      COUNT(*) as offer_count
    FROM route_ticks
    WHERE created_at >= ?
  `;
  const params = [cutoff];
  if (country) {
    sql += ' AND LOWER(country) = LOWER(?)';
    params.push(country);
  }
  sql += ' GROUP BY day, country, route_type ORDER BY day ASC';

  const rows = db.prepare(sql).all(...params);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ status: 'ok', trends: rows }));
}

function handleNewsGet(req, res) {
  const db = getTradingDb();
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  const rows = db.prepare('SELECT * FROM market_news ORDER BY created_at DESC LIMIT 50').all();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ status: 'ok', news: rows }));
}

function handleVendorsGet(req, res) {
  const db = getTradingDb();
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  const rows = db.prepare('SELECT * FROM vendors ORDER BY last_seen_at DESC LIMIT 50').all();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ status: 'ok', vendors: rows }));
}

function handleInsightsGet(req, res) {
  const db = getTradingDb();
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  const totalRoutes = db.prepare('SELECT COUNT(*) as c FROM route_ticks').get()?.c || 0;
  const totalCountries = db.prepare('SELECT COUNT(DISTINCT country) as c FROM route_ticks').get()?.c || 0;
  const totalVendors = db.prepare('SELECT COUNT(*) as c FROM vendors').get()?.c || 0;
  const urgentNews = db.prepare("SELECT COUNT(*) as c FROM market_news WHERE urgency = 'HIGH'").get()?.c || 0;
  const recentRoutes = db.prepare('SELECT * FROM route_ticks ORDER BY created_at DESC LIMIT 6').all();
  const topNews = db.prepare('SELECT * FROM market_news ORDER BY created_at DESC LIMIT 3').all();

  // Detect potential arbitrage: matching countries where WTS exists and WTB exists
  const wtsCountries = db.prepare("SELECT DISTINCT country FROM route_ticks WHERE intent = 'WTS'").all().map(r => r.country);
  let wtbMatches = [];
  if (wtsCountries.length > 0) {
    const placeholders = wtsCountries.map(() => '?').join(',');
    wtbMatches = db.prepare(`
      SELECT * FROM route_ticks WHERE intent = 'WTB' AND country IN (${placeholders})
      ORDER BY created_at DESC LIMIT 5
    `).all(...wtsCountries);
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    status: 'ok',
    summary: {
      totalRoutes,
      totalCountries,
      totalVendors,
      urgentNews
    },
    recentRoutes,
    topNews,
    arbitrageOpportunities: wtbMatches
  }));
}

const { generateTradePitch } = require('./pitch-generator');

async function handlePitchPost(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const pitches = await generateTradePitch(payload);
      const cleanPhone = (payload.vendorPhone || '').replace(/[^0-9]/g, '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        pitches,
        phone: cleanPhone
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  });
}

const { getExecutiveOutageBrief } = require('./executive-summary');

async function handleExecutiveBriefGet(req, res, parsedUrl) {
  try {
    const force = parsedUrl.searchParams.get('refresh') === 'true';
    const brief = await getExecutiveOutageBrief(force);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', brief }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message }));
  }
}

module.exports = {
  handleTrendsGet,
  handleNewsGet,
  handleVendorsGet,
  handleInsightsGet,
  handlePitchPost,
  handleExecutiveBriefGet
};
