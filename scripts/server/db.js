/**
 * SQLite Database Access & Migrations for Telecom Intelligence
 */
const { SQLITE_FILE } = require('./config');
const { seedBenchmarkRoutes } = require('../benchmark-data');

let tradingDb = null;

function getTradingDb() {
  if (tradingDb) return tradingDb;
  try {
    const Database = require('better-sqlite3');
    const db = new Database(SQLITE_FILE);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.exec(`
      CREATE TABLE IF NOT EXISTS route_ticks (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        vendor_name TEXT,
        vendor_phone TEXT NOT NULL,
        company_name TEXT,
        country TEXT NOT NULL,
        route_type TEXT NOT NULL,
        billing_pulse TEXT DEFAULT '1/1',
        rate_per_min REAL,
        ani_pass TEXT,
        quality_notes TEXT,
        fas_free INTEGER DEFAULT 1,
        intent TEXT DEFAULT 'WTS',
        raw_text TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_routes_dest ON route_ticks (country, route_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_routes_price ON route_ticks (country, rate_per_min);
      CREATE INDEX IF NOT EXISTS idx_routes_created ON route_ticks (created_at DESC);

      CREATE TABLE IF NOT EXISTS market_news (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        category TEXT NOT NULL,
        headline TEXT NOT NULL,
        affected_countries TEXT,
        urgency TEXT DEFAULT 'MEDIUM',
        raw_text TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_news_created ON market_news (created_at DESC);

      CREATE TABLE IF NOT EXISTS vendors (
        phone TEXT PRIMARY KEY,
        name TEXT,
        company TEXT,
        avatar_url TEXT,
        total_offers INTEGER DEFAULT 1,
        last_seen_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vendor_avatars (
        phone TEXT PRIMARY KEY,
        avatar_url TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_tasks (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        sender_name TEXT,
        sender_phone TEXT,
        chat_name TEXT,
        chat_type TEXT,
        raw_text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        priority INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        next_retry_at INTEGER DEFAULT 0,
        error_message TEXT,
        latency_ms INTEGER DEFAULT 0,
        result_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ai_tasks_queue ON ai_tasks (status, next_retry_at, priority DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_tasks_hash ON ai_tasks (content_hash);
      CREATE INDEX IF NOT EXISTS idx_ai_tasks_created ON ai_tasks (created_at DESC);
    `);

    // Safe schema migrations for FAS & Fraud Risk Scorer
    try { db.exec(`ALTER TABLE route_ticks ADD COLUMN fraud_risk_score INTEGER DEFAULT 0;`); } catch (_) {}
    try { db.exec(`ALTER TABLE route_ticks ADD COLUMN fraud_risk_level TEXT DEFAULT 'LOW';`); } catch (_) {}
    try { db.exec(`ALTER TABLE route_ticks ADD COLUMN fraud_flags TEXT;`); } catch (_) {}

    // Deduplicate route_ticks to purge historical duplicate inflation
    try {
      db.exec(`
        DELETE FROM route_ticks 
        WHERE rowid NOT IN (
          SELECT MAX(rowid) 
          FROM route_ticks 
          GROUP BY country, route_type, intent, vendor_phone, billing_pulse, rate_per_min
        );
      `);
    } catch (_) {}

    tradingDb = db;
    seedBenchmarkRoutes(db);
    return db;
  } catch (err) {
    console.error('Failed to initialize trading SQLite DB:', err.message);
    return null;
  }
}

function saveParsedTelecom(db, parsed, record) {
  if (!db || !parsed) return;
  const { evaluateRouteFraudRisk } = require('./fraud-detector');
  const now = record.created_at ? new Date(record.created_at).getTime() : Date.now();
  const insertRoute = db.prepare(`
    INSERT OR IGNORE INTO route_ticks (
      id, message_id, vendor_name, vendor_phone, company_name,
      country, route_type, billing_pulse, rate_per_min, ani_pass,
      quality_notes, fas_free, intent, raw_text, fraud_risk_score,
      fraud_risk_level, fraud_flags, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertVendor = db.prepare(`
    INSERT INTO vendors (phone, name, company, total_offers, last_seen_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(phone) DO UPDATE SET
      name = COALESCE(excluded.name, vendors.name),
      company = COALESCE(excluded.company, vendors.company),
      total_offers = vendors.total_offers + 1,
      last_seen_at = excluded.last_seen_at
  `);

  db.transaction(() => {
    if (Array.isArray(parsed.routes)) {
      for (const r of parsed.routes) {
        const routeId = `rt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const fraud = evaluateRouteFraudRisk({
          country: r.country,
          route_type: r.route_type,
          billing_pulse: r.billing_pulse,
          rate_per_min: r.rate_per_min,
          ani_pass: r.ani_pass,
          quality_notes: r.quality_notes,
          raw_text: r.raw_text || record.text
        });

        insertRoute.run(
          routeId,
          record.id || `msg_${Date.now()}`,
          r.vendor_name || record.sender_name || 'Vendor',
          record.sender_phone || r.vendor_phone || 'unknown',
          r.company_name || parsed.company || null,
          r.country,
          r.route_type,
          r.billing_pulse || '1/1',
          r.rate_per_min || null,
          r.ani_pass || null,
          r.quality_notes || null,
          r.fas_free ? 1 : 0,
          r.intent || 'WTS',
          r.raw_text || null,
          fraud.risk_score,
          fraud.risk_level,
          JSON.stringify(fraud.flags),
          now
        );
      }
    }

    if (record.sender_phone) {
      upsertVendor.run(
        record.sender_phone,
        record.sender_name || 'Vendor',
        parsed.company || null,
        now
      );
    }

    if (parsed.news) {
      const newsId = `news_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      db.prepare(`
        INSERT OR IGNORE INTO market_news (
          id, message_id, category, headline, affected_countries, urgency, raw_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newsId,
        record.id || `msg_${Date.now()}`,
        parsed.news.category,
        parsed.news.headline,
        parsed.news.affected_countries,
        parsed.news.urgency,
        parsed.news.raw_text,
        now
      );
    }
  })();
}

function backfillHistoricalTelecomData(recentMessages) {
  try {
    const db = getTradingDb();
    if (!db) return;
    const count = db.prepare('SELECT COUNT(*) as c FROM route_ticks').get()?.c || 0;
    if (count === 0 && recentMessages && recentMessages.length > 0) {
      const { parseTelecomMessage } = require('../telecom-parser');
      console.log(`🔍 [Telecom Backfill] Seeding routes from ${recentMessages.length} existing messages...`);
      for (const msg of recentMessages) {
        if (msg.text) {
          const parsed = parseTelecomMessage(msg.text, msg.sender_phone, msg.sender_name);
          if (parsed && parsed.isTelecom) {
            saveParsedTelecom(db, parsed, msg);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Telecom Backfill] Warning:', err.message);
  }
}

module.exports = {
  getTradingDb,
  saveParsedTelecom,
  backfillHistoricalTelecomData
};
