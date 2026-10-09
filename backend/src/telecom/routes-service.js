import { getDb } from '../storage/db.js';
import { parseTelecomMessage } from './parser.js';
import { evaluateRouteFraudRisk } from './fraud-service.js';

export function getRoutes(options = {}) {
  const db = getDb();
  const q = (options.q || '').trim().toLowerCase();
  const country = (options.country || '').trim();
  const type = (options.type || '').trim();
  const pulse = (options.pulse || '').trim();
  const intent = (options.intent || '').trim().toUpperCase();
  const sort = (options.sort || 'date_desc').trim();
  const limit = Math.min(parseInt(options.limit || '100', 10), 500);
  const offset = parseInt(options.offset || '0', 10);

  const where = [];
  const params = [];

  if (q) {
    where.push("(LOWER(country) LIKE ? OR LOWER(vendor_name) LIKE ? OR LOWER(COALESCE(company_name, '')) LIKE ? OR LOWER(COALESCE(raw_text, '')) LIKE ?)");
    const wild = `%${q}%`;
    params.push(wild, wild, wild, wild);
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
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM route_ticks ${whereClause}`).get(...params);
  const rows = db.prepare(`
    SELECT * FROM route_ticks 
    ${whereClause} 
    ${orderClause} 
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Enrich with fraud badges
  const enriched = rows.map(r => {
    const fraud = evaluateRouteFraudRisk(r);
    return {
      ...r,
      fraud_risk_level: fraud.riskLevel,
      fraud_badge: fraud.badge,
      fraud_score: fraud.riskScore
    };
  });

  return {
    total: countRow ? countRow.total : 0,
    routes: enriched
  };
}

export function createRoute(data) {
  const db = getDb();
  if (!data.country || !data.route_type) {
    throw new Error('Country and route_type are required');
  }

  const routeId = `rt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const rate = data.rate_per_min ? parseFloat(data.rate_per_min) : null;

  db.prepare(`
    INSERT INTO route_ticks (
      id, message_id, vendor_name, vendor_phone, company_name,
      country, route_type, billing_pulse, rate_per_min, ani_pass,
      quality_notes, fas_free, intent, raw_text, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    routeId,
    `man_${now}`,
    data.vendor_name || 'Direct Carrier',
    data.vendor_phone || 'Direct Interconnect',
    data.company_name || null,
    data.country,
    data.route_type,
    data.billing_pulse || '1/1',
    rate,
    data.ani_pass || null,
    data.quality_notes || null,
    data.fas_free ? 1 : 0,
    data.intent || 'WTS',
    data.raw_text || `${data.country} ${data.route_type} manual entry`,
    now
  );

  if (data.vendor_phone) {
    db.prepare(`
      INSERT INTO vendors (phone, name, company, total_offers, last_seen_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(phone) DO UPDATE SET
        total_offers = total_offers + 1,
        last_seen_at = excluded.last_seen_at
    `).run(data.vendor_phone, data.vendor_name || 'Carrier', data.company_name || null, now);
  }

  return { id: routeId, ...data };
}

export function deleteRoute(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM route_ticks WHERE id = ?').run(id);
  return info.changes > 0;
}

export function clearAllRoutes() {
  const db = getDb();
  const info = db.prepare('DELETE FROM route_ticks').run();
  return info.changes;
}

export function reparseHistoricalMessages(batchLimit = 5000) {
  const db = getDb();
  const messages = db.prepare(`
    SELECT id, message_text, sender_phone, sender_name, timestamp 
    FROM caught_messages 
    WHERE message_text IS NOT NULL AND message_text != ''
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(batchLimit);

  let newRoutes = 0;
  let newNews = 0;

  const insertRoute = db.prepare(`
    INSERT OR IGNORE INTO route_ticks (
      id, message_id, vendor_name, vendor_phone, company_name,
      country, route_type, billing_pulse, rate_per_min, ani_pass,
      quality_notes, fas_free, intent, raw_text, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertNews = db.prepare(`
    INSERT OR IGNORE INTO market_news (
      id, message_id, category, headline, affected_countries, urgency, raw_text, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const runTx = db.transaction((msgs) => {
    for (const m of msgs) {
      const parsed = parseTelecomMessage(m.message_text, m.sender_phone, m.sender_name);
      if (!parsed.isTelecom) continue;

      if (parsed.routes && parsed.routes.length > 0) {
        for (let idx = 0; idx < parsed.routes.length; idx++) {
          const r = parsed.routes[idx];
          const rId = `rt_h_${m.id}_${idx}`;
          insertRoute.run(
            rId,
            m.id,
            r.vendor_name,
            r.vendor_phone,
            r.company_name,
            r.country,
            r.route_type,
            r.billing_pulse,
            r.rate_per_min,
            r.ani_pass,
            r.quality_notes,
            r.fas_free,
            r.intent,
            r.raw_text,
            m.timestamp
          );
          newRoutes++;
        }
      }

      if (parsed.news) {
        const nId = `news_h_${m.id}`;
        insertNews.run(
          nId,
          m.id,
          parsed.news.category,
          parsed.news.headline,
          parsed.news.affected_countries,
          parsed.news.urgency,
          parsed.news.raw_text,
          m.timestamp
        );
        newNews++;
      }
    }
  });

  runTx(messages);
  return { scanned: messages.length, newRoutes, newNews };
}

/**
 * Record live incoming telecom message routes with smart anti-spam deduplication.
 * Prevents duplicate spam from the same vendor within a 2-hour window, while never
 * missing unique routes or price updates.
 */
export function recordLiveMessageRoutes(message) {
  if (!message || !message.message_text) return { newRoutes: 0 };
  const parsed = parseTelecomMessage(
    message.message_text,
    message.sender_phone || '',
    message.sender_name || ''
  );
  if (!parsed.isTelecom || !parsed.routes || parsed.routes.length === 0) {
    return { newRoutes: 0 };
  }

  const db = getDb();
  let addedCount = 0;
  const now = message.timestamp || Date.now();
  const SPAM_WINDOW_MS = 2 * 60 * 60 * 1000; // 2-hour anti-spam duplicate window

  const checkExisting = db.prepare(`
    SELECT id, rate_per_min, intent, created_at FROM route_ticks
    WHERE vendor_phone = ? AND country = ? AND route_type = ? AND intent = ?
    ORDER BY created_at DESC LIMIT 1
  `);

  const updateTime = db.prepare(`
    UPDATE route_ticks SET created_at = ?, message_id = ?, raw_text = ? WHERE id = ?
  `);

  const insertStmt = db.prepare(`
    INSERT INTO route_ticks (
      id, message_id, vendor_name, vendor_phone, company_name,
      country, route_type, billing_pulse, rate_per_min, ani_pass,
      quality_notes, fas_free, intent, raw_text, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateVendor = db.prepare(`
    INSERT INTO vendors (phone, name, company, total_offers, last_seen_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(phone) DO UPDATE SET
      name = COALESCE(excluded.name, vendors.name),
      company = COALESCE(excluded.company, vendors.company),
      total_offers = total_offers + 1,
      last_seen_at = excluded.last_seen_at
  `);

  const runTx = db.transaction(() => {
    for (let idx = 0; idx < parsed.routes.length; idx++) {
      const r = parsed.routes[idx];
      if (!r.country || !r.route_type) continue;

      const vendorPhone = r.vendor_phone || message.sender_phone || 'Direct Interconnect';
      const rIntent = r.intent || 'WTS';
      const existing = checkExisting.get(vendorPhone, r.country, r.route_type, rIntent);

      if (existing) {
        const isSameRate = Math.abs((existing.rate_per_min || 0) - (r.rate_per_min || 0)) < 0.00001;
        const isWithinWindow = (now - existing.created_at) < SPAM_WINDOW_MS;

        if (isSameRate && isWithinWindow) {
          // Identical quote within 2h - refresh timestamp to show it's active, but prevent spam rows
          updateTime.run(now, message.id, r.raw_text, existing.id);
          continue;
        }
      }

      // Unique route offer or price change - record new tick
      const rId = `rt_${now}_${Math.random().toString(36).slice(2, 6)}_${idx}`;
      insertStmt.run(
        rId,
        message.id,
        r.vendor_name || message.sender_name || 'Carrier Partner',
        vendorPhone,
        r.company_name || parsed.company || null,
        r.country,
        r.route_type,
        r.billing_pulse || '1/1',
        r.rate_per_min,
        r.ani_pass || null,
        r.quality_notes || null,
        r.fas_free ? 1 : 0,
        r.intent || 'WTS',
        r.raw_text || message.message_text,
        now
      );
      addedCount++;

      if (vendorPhone && vendorPhone !== 'Direct Interconnect') {
        try {
          updateVendor.run(
            vendorPhone,
            r.vendor_name || message.sender_name || 'Carrier',
            r.company_name || parsed.company || null,
            now
          );
        } catch (_) {}
      }
    }
  });

  runTx();
  return { newRoutes: addedCount };
}
