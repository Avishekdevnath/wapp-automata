/**
 * Wholesale Telecom Routes API Handlers
 * - GET /api/routes: Filter, sort, paginate, compute aggregate stats
 * - POST /api/routes: Manually post wholesale voice route
 * - POST /api/routes/seed: Re-seed authentic benchmark routes
 * - GET /api/export/routes: Export full rate sheet to CSV
 */
const { getTradingDb } = require('./db');
const { seedBenchmarkRoutes } = require('../benchmark-data');

function handleRoutesGet(req, res, parsedUrl) {
  const db = getTradingDb();
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }

  const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
  const country = (parsedUrl.searchParams.get('country') || '').trim();
  const type = (parsedUrl.searchParams.get('type') || '').trim();
  const pulse = (parsedUrl.searchParams.get('pulse') || '').trim();
  const intent = (parsedUrl.searchParams.get('intent') || '').trim().toUpperCase();
  const sort = (parsedUrl.searchParams.get('sort') || 'price_asc').trim();
  const limit = Math.min(parseInt(parsedUrl.searchParams.get('limit') || '100', 10), 200);
  const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

  let where = [];
  let params = [];

  if (q) {
    where.push('(LOWER(country) LIKE ? OR LOWER(vendor_name) LIKE ? OR LOWER(COALESCE(company_name,"")) LIKE ? OR LOWER(COALESCE(quality_notes,"")) LIKE ? OR LOWER(COALESCE(raw_text,"")) LIKE ?)');
    const wild = `%${q}%`;
    params.push(wild, wild, wild, wild, wild);
  }
  if (country) {
    where.push('LOWER(country) = LOWER(?)');
    params.push(country);
  }
  if (type) {
    where.push('LOWER(route_type) = LOWER(?)');
    params.push(type);
  }
  if (pulse) {
    where.push('billing_pulse = ?');
    params.push(pulse);
  }
  if (intent) {
    where.push('intent = ?');
    params.push(intent);
  }

  let orderClause = 'ORDER BY created_at DESC';
  if (sort === 'price_asc') {
    orderClause = 'ORDER BY CASE WHEN rate_per_min IS NULL THEN 1 ELSE 0 END, rate_per_min ASC, created_at DESC';
  } else if (sort === 'price_desc') {
    orderClause = 'ORDER BY rate_per_min DESC, created_at DESC';
  } else if (sort === 'country_asc') {
    orderClause = 'ORDER BY country ASC, created_at DESC';
  } else if (sort === 'date_desc' || sort === 'newest') {
    orderClause = 'ORDER BY created_at DESC';
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM route_ticks ${whereClause}`).get(...params);
  const rows = db.prepare(`
    SELECT * FROM route_ticks 
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Compute Active Route KPI summary stats
  const totalAll = db.prepare('SELECT COUNT(*) as c FROM route_ticks').get()?.c || 0;
  const floorRow = db.prepare('SELECT MIN(rate_per_min) as min_rate FROM route_ticks WHERE rate_per_min IS NOT NULL AND rate_per_min > 0').get();
  const wtsRow = db.prepare("SELECT COUNT(*) as c FROM route_ticks WHERE intent = 'WTS'").get()?.c || 0;
  const wtbRow = db.prepare("SELECT COUNT(*) as c FROM route_ticks WHERE intent = 'WTB'").get()?.c || 0;
  const fasRow = db.prepare('SELECT COUNT(*) as c FROM route_ticks WHERE fas_free = 1').get()?.c || 0;
  const destRow = db.prepare('SELECT COUNT(DISTINCT country) as c FROM route_ticks').get()?.c || 0;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    status: 'ok',
    total: countRow ? countRow.total : 0,
    stats: {
      total: totalAll,
      floorRate: floorRow?.min_rate || null,
      wtsCount: wtsRow,
      wtbCount: wtbRow,
      fasFreeCount: fasRow,
      destCount: destRow
    },
    routes: rows
  }));
}

function handleRoutesPost(req, res) {
  const db = getTradingDb();
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (!data.country || !data.route_type) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Country and route_type are required' }));
      }
      const routeId = `rt_man_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = Date.now();
      db.prepare(`
        INSERT INTO route_ticks (
          id, message_id, vendor_name, vendor_phone, company_name,
          country, route_type, billing_pulse, rate_per_min, ani_pass,
          quality_notes, fas_free, intent, raw_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        routeId,
        `manual_${now}`,
        data.vendor_name || 'Terminal Trader',
        data.vendor_phone || '+8801516539430',
        data.company_name || 'Direct Wholesale',
        data.country,
        data.route_type,
        data.billing_pulse || '1/1',
        data.rate_per_min ? parseFloat(data.rate_per_min) : null,
        data.ani_pass || null,
        data.quality_notes || null,
        data.fas_free ? 1 : 0,
        data.intent || 'WTS',
        data.raw_text || `${data.country} ${data.route_type} (${data.billing_pulse || '1/1'}) manual entry`,
        now
      );

      if (data.vendor_phone) {
        db.prepare(`
          INSERT INTO vendors (phone, name, company, total_offers, last_seen_at)
          VALUES (?, ?, ?, 1, ?)
          ON CONFLICT(phone) DO UPDATE SET
            name = COALESCE(excluded.name, vendors.name),
            company = COALESCE(excluded.company, vendors.company),
            total_offers = vendors.total_offers + 1,
            last_seen_at = excluded.last_seen_at
        `).run(data.vendor_phone, data.vendor_name || 'Terminal Trader', data.company_name || 'Direct Wholesale', now);
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', id: routeId }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  });
}

function handleRoutesSeed(req, res) {
  const db = getTradingDb();
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  const count = seedBenchmarkRoutes(db, true);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ status: 'ok', seeded: count }));
}

function handleRoutesExport(req, res) {
  const db = getTradingDb();
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database unavailable' }));
  }
  const rows = db.prepare('SELECT * FROM route_ticks ORDER BY created_at DESC LIMIT 2000').all();
  
  let csv = 'ID,Date,Country,Route Type,Pulse,Rate USD,FAS Free,Vendor Name,Vendor Phone,Company,Quality Notes,Intent\r\n';
  for (const r of rows) {
    const dateStr = new Date(r.created_at).toISOString();
    const esc = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
    csv += `${esc(r.id)},${esc(dateStr)},${esc(r.country)},${esc(r.route_type)},${esc(r.billing_pulse)},${esc(r.rate_per_min || '')},${esc(r.fas_free ? 'YES' : 'NO')},${esc(r.vendor_name)},${esc(r.vendor_phone)},${esc(r.company_name)},${esc(r.quality_notes)},${esc(r.intent)}\r\n`;
  }

  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="telecom_routes_${new Date().toISOString().slice(0, 10)}.csv"`
  });
  return res.end(csv);
}

module.exports = {
  handleRoutesGet,
  handleRoutesPost,
  handleRoutesSeed,
  handleRoutesExport
};
