/**
 * Market Analytics & Intelligence APIs
 * - GET /api/trends: Historical pricing data for Chart.js
 * - GET /api/news: Outage, fraud and regulatory alerts
 * - GET /api/vendors: Directory of telecom providers
 * - GET /api/insights: Arbitrage deal matching
 */
const { getTradingDb } = require('./db');

function handleTrendsGet(req, res, parsedUrl) {
  const db = getTradingDb(req);
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
  const db = getTradingDb(req);
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  const urlObj = new URL(req.url, 'http://localhost');
  const limitParam = parseInt(urlObj.searchParams.get('limit'), 10);
  const limit = (limitParam > 0 && limitParam <= 500) ? limitParam : 100;
  const rows = db.prepare('SELECT * FROM market_news ORDER BY created_at DESC LIMIT ?').all(limit);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ status: 'ok', news: rows, total: rows.length }));
}

function handleNewsClear(req, res) {
  const db = getTradingDb(req);
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  try {
    const resDel = db.prepare('DELETE FROM market_news').run();
    try {
      db.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`).run();
      db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('user_cleared_news', 'true')`).run();
    } catch (_) {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', deleted: resDel.changes }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message }));
  }
}

function handleNewsSeed(req, res) {
  const db = getTradingDb(req);
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  try {
    try {
      db.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`).run();
      db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('user_cleared_news', 'false')`).run();
    } catch (_) {}
    const { seedBenchmarkRoutes } = require('./benchmark-data');
    seedBenchmarkRoutes(db, true);
    const count = db.prepare('SELECT COUNT(*) as c FROM market_news').get()?.c || 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', seeded: count }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message }));
  }
}

function detectCountry(phone) {
  if (!phone) return 'Global Carrier 🌐';
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('880')) return 'Bangladesh 🇧🇩';
  if (clean.startsWith('44')) return 'United Kingdom 🇬🇧';
  if (clean.startsWith('1')) return 'United States 🇺🇸';
  if (clean.startsWith('971')) return 'United Arab Emirates 🇦🇪';
  if (clean.startsWith('65')) return 'Singapore 🇸🇬';
  if (clean.startsWith('92')) return 'Pakistan 🇵🇰';
  if (clean.startsWith('91')) return 'India 🇮🇳';
  if (clean.startsWith('20')) return 'Egypt 🇪🇬';
  if (clean.startsWith('63')) return 'Philippines 🇵🇭';
  if (clean.startsWith('49')) return 'Germany 🇩🇪';
  if (clean.startsWith('33')) return 'France 🇫🇷';
  if (clean.startsWith('86')) return 'China 🇨🇳';
  if (clean.startsWith('60')) return 'Malaysia 🇲🇾';
  if (clean.startsWith('966')) return 'Saudi Arabia 🇸🇦';
  if (clean.startsWith('974')) return 'Qatar 🇶🇦';
  if (clean.startsWith('968')) return 'Oman 🇴🇲';
  if (clean.startsWith('90')) return 'Turkey 🇹🇷';
  if (clean.startsWith('234')) return 'Nigeria 🇳🇬';
  if (clean.startsWith('27')) return 'South Africa 🇿🇦';
  if (clean.startsWith('84')) return 'Vietnam 🇻🇳';
  if (clean.startsWith('62')) return 'Indonesia 🇮🇩';
  return 'International 🌐';
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'recently';
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(ms)) return 'recently';
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function handleVendorsGet(req, res) {
  const db = getTradingDb(req);
  const contactsMap = new Map();

  // 1. Read registered vendors from SQLite
  if (db) {
    try {
      const dbVendors = db.prepare('SELECT * FROM vendors').all();
      for (const v of dbVendors) {
        if (!v.phone) continue;
        const normKey = v.phone.trim();
        contactsMap.set(normKey, {
          id: 'v_' + normKey.replace(/\D/g, ''),
          name: v.name && !v.name.startsWith('LID:') ? v.name : normKey,
          company: v.company || '',
          phone: normKey,
          country: detectCountry(normKey),
          offersCount: v.total_offers || 1,
          lastSeenAt: v.last_seen_at || Date.now(),
          verified: (v.total_offers || 1) >= 3
        });
      }
    } catch (_) {}
  }

  // 2. Aggregate across all live messages in store to capture all active contacts
  try {
    const { recentMessages } = require('./store');
    if (Array.isArray(recentMessages)) {
      for (const m of recentMessages) {
        const phone = (m.sender_phone || m.sender_id || '').trim();
        if (!phone) continue;
        const existing = contactsMap.get(phone);
        const ts = m.occurred_at ? new Date(m.occurred_at).getTime() : (m.timestamp || Date.now());
        const validName = m.sender_name && !m.sender_name.startsWith('+') && !m.sender_name.startsWith('LID:')
          ? m.sender_name
          : (existing?.name || phone);
        const company = m.chat_name || existing?.company || '';

        if (existing) {
          existing.offersCount++;
          if (ts > existing.lastSeenAt) existing.lastSeenAt = ts;
          if (validName && validName !== phone) existing.name = validName;
          if (m.chat_name && !existing.company) existing.company = m.chat_name;
          if (existing.offersCount >= 3) existing.verified = true;
        } else {
          contactsMap.set(phone, {
            id: 'c_' + phone.replace(/\D/g, ''),
            name: validName,
            company: company,
            phone: phone,
            country: detectCountry(phone),
            offersCount: 1,
            lastSeenAt: ts,
            verified: false
          });
        }
      }
    }
  } catch (_) {}

  // 3. Format relative time and sort by recency & activity
  const vendorsList = Array.from(contactsMap.values())
    .map(v => ({
      ...v,
      lastSeen: formatRelativeTime(v.lastSeenAt)
    }))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ status: 'ok', count: vendorsList.length, vendors: vendorsList }));
}

function handleInsightsGet(req, res) {
  const db = getTradingDb(req);
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
  const db = getTradingDb(req);
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
  handleNewsSeed,
  handleVendorsGet,
  handleInsightsGet,
  handlePitchPost,
  handleExecutiveBriefGet,
  handleArbitrageGet
};
