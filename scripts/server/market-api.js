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

function handleNewsClear(req, res) {
  const db = getTradingDb();
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  try {
    const resDel = db.prepare('DELETE FROM market_news').run();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', deleted: resDel.changes }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message }));
  }
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

/**
 * Live Arbitrage & Buy/Sell Spread Matching Engine (ADR-016)
 * Calculates real-time spreads across Buy (WTB) and Sell (WTS) orders
 */
function handleArbitrageGet(req, res) {
  const db = getTradingDb();
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }

  // Find corridors where both Sell (WTS) and Buy (WTB) ticks exist
  const pairsQuery = `
    SELECT 
      sell.country,
      sell.route_type,
      sell.rate_per_min as sell_rate,
      sell.vendor_name as seller_name,
      sell.vendor_phone as seller_phone,
      sell.company_name as seller_company,
      sell.billing_pulse as sell_pulse,
      sell.created_at as sell_time,
      buy.rate_per_min as buy_rate,
      buy.vendor_name as buyer_name,
      buy.vendor_phone as buyer_phone,
      buy.company_name as buyer_company,
      buy.billing_pulse as buy_pulse,
      buy.created_at as buy_time
    FROM route_ticks sell
    JOIN route_ticks buy 
      ON LOWER(sell.country) = LOWER(buy.country)
      AND LOWER(sell.route_type) = LOWER(buy.route_type)
      AND (sell.intent = 'WTS' OR sell.intent = 'OFFER')
      AND (buy.intent = 'WTB' OR buy.intent = 'BID' OR buy.intent = 'NEED')
      AND sell.vendor_phone != buy.vendor_phone
    WHERE sell.rate_per_min > 0 AND buy.rate_per_min > 0
    ORDER BY (buy.rate_per_min - sell.rate_per_min) DESC, sell.created_at DESC
    LIMIT 20
  `;

  let matches = [];
  try {
    const rawMatches = db.prepare(pairsQuery).all();
    matches = rawMatches.map(m => {
      const spread = Number((m.buy_rate - m.sell_rate).toFixed(5));
      const marginPercent = m.sell_rate > 0 ? Number(((spread / m.sell_rate) * 100).toFixed(1)) : 0;
      return {
        country: m.country,
        route_type: m.route_type,
        sell_rate: m.sell_rate,
        seller_name: m.seller_name || m.seller_phone,
        seller_phone: m.seller_phone,
        seller_company: m.seller_company || '',
        sell_pulse: m.sell_pulse || '1/1',
        sell_time: m.sell_time,
        buy_rate: m.buy_rate,
        buyer_name: m.buyer_name || m.buyer_phone,
        buyer_phone: m.buyer_phone,
        buyer_company: m.buyer_company || '',
        buy_pulse: m.buy_pulse || '1/1',
        buy_time: m.buy_time,
        spread,
        marginPercent,
        isProfitable: spread > 0
      };
    });
  } catch (err) {
    console.warn('Arbitrage pairs query notice:', err.message);
  }

  // Fallback: If no opposite intent pairs exist, identify corridor price variance across all quotes
  if (matches.length === 0) {
    const spreadQuery = `
      SELECT 
        country,
        route_type,
        MIN(rate_per_min) as min_rate,
        MAX(rate_per_min) as max_rate,
        COUNT(*) as tick_count
      FROM route_ticks
      WHERE rate_per_min > 0
      GROUP BY country, route_type
      HAVING COUNT(*) > 1 AND MAX(rate_per_min) > MIN(rate_per_min)
      ORDER BY (MAX(rate_per_min) - MIN(rate_per_min)) DESC
      LIMIT 10
    `;
    try {
      const spreads = db.prepare(spreadQuery).all();
      matches = spreads.map(s => {
        const spread = Number((s.max_rate - s.min_rate).toFixed(5));
        const marginPercent = s.min_rate > 0 ? Number(((spread / s.min_rate) * 100).toFixed(1)) : 0;
        return {
          country: s.country,
          route_type: s.route_type,
          sell_rate: s.min_rate,
          seller_name: 'Best Market Offer',
          seller_phone: '',
          seller_company: 'Market Vendor',
          sell_pulse: '1/1',
          sell_time: Date.now(),
          buy_rate: s.max_rate,
          buyer_name: 'Highest Market Bid',
          buyer_phone: '',
          buyer_company: 'Target Buyer',
          buy_pulse: '1/1',
          buy_time: Date.now(),
          spread,
          marginPercent,
          isProfitable: spread > 0
        };
      });
    } catch (_) {}
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ status: 'ok', opportunities: matches }));
}

module.exports = {
  handleTrendsGet,
  handleNewsGet,
  handleNewsClear,
  handleVendorsGet,
  handleInsightsGet,
  handlePitchPost,
  handleExecutiveBriefGet,
  handleArbitrageGet
};
