/**
 * SQLite Database Access & Migrations for Telecom Intelligence
 */
const { SQLITE_FILE } = require('./config');
let persistence;
try {
  persistence = require('../persistence');
} catch (_) {
  persistence = require('../../dist/persistence');
}
const { getAccountDatabase, sanitizeAccountId } = persistence;

const initializedDbs = new Set();

function getTradingDb(target) {
  let accountId = 'default';
  if (typeof target === 'string') {
    accountId = target;
  } else if (target && typeof target === 'object') {
    const header = target.headers ? target.headers['x-account-id'] : null;
    if (header && typeof header === 'string') {
      accountId = header;
    }
  }
  const cleanId = sanitizeAccountId(accountId);
  const db = getAccountDatabase(cleanId);
  if (initializedDbs.has(cleanId)) {
    return db;
  }
  try {
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

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
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

    try { db.exec(`ALTER TABLE route_ticks ADD COLUMN fraud_risk_score INTEGER DEFAULT 0;`); } catch (_) {}
    try { db.exec(`ALTER TABLE route_ticks ADD COLUMN fraud_risk_level TEXT DEFAULT 'LOW';`); } catch (_) {}
    try { db.exec(`ALTER TABLE route_ticks ADD COLUMN fraud_flags TEXT;`); } catch (_) {}

    // Clean slate standard: Never auto-seed dummy records into databases
    initializedDbs.add(cleanId);
  } catch (err) {
    console.warn('[getTradingDb] Table setup warning:', err.message);
  }
  return db;
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
      console.log(`🔍 [Telecom Backfill] Scanning ${recentMessages.length} existing messages for authentic wholesale routes...`);
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

function reparseAllMessagesFromDb(db) {
  if (!db) db = getTradingDb();
  if (!db) return { routesParsed: 0, vendorsCreated: 0 };
  const { parseTelecomMessage } = require('../telecom-parser');
  let count = 0;

  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get();
    if (!tableCheck) return { routesParsed: 0, vendorsCreated: 0 };

    const rows = db.prepare("SELECT id, sender_id, source_name, message_text, created_at FROM messages WHERE message_text IS NOT NULL AND trim(message_text) != ''").all();
    for (const r of rows) {
      let senderPhone = '';
      if (r.sender_id.includes('@s.whatsapp.net')) {
        senderPhone = '+' + r.sender_id.split('@')[0].split(':')[0];
      }
      const parsed = parseTelecomMessage(r.message_text, senderPhone, r.source_name);
      if (parsed && parsed.isTelecom) {
        saveParsedTelecom(db, parsed, {
          id: r.id,
          sender_name: r.source_name || parsed.vendor_name,
          sender_phone: senderPhone,
          text: r.message_text,
          created_at: r.created_at
        });
        count++;
      }
    }
  } catch (err) {
    console.warn('[Reparse Telecom] Error:', err.message);
  }
  return { parsedCount: count };
}

/**
/**
 * Automated SQLite Log Retention (ADR-013 Lifetime Raw Text Storage)
 * Prunes bulky raw_payload envelopes older than retentionDays (30d).
 * Never deletes raw messages rows unless deleteDelivered is explicitly true (default: false).
 * Never touches parsed routes (route_ticks) or vendors!
 */
function pruneRawPayloads(db, retentionDays = 30, deleteDelivered = false) {
  if (!db) return { prunedPayloads: 0, deletedOldMessages: 0 };
  const cutoffMs = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  const delCutoffMs = Date.now() - (retentionDays * 2 * 24 * 60 * 60 * 1000);

  try {
    let prunedCount = 0;
    let deletedCount = 0;

    // Check if messages table exists
    const hasMessages = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get();
    if (hasMessages) {
      // 1. Delete delivered messages only if explicitly allowed (default: false to keep lifetime text)
      if (deleteDelivered) {
        const delStmt = db.prepare(`
          DELETE FROM messages
          WHERE created_at < ? AND status = 'delivered'
        `);
        const delRes = delStmt.run(delCutoffMs);
        deletedCount = delRes.changes;
      }

      // 2. Prune bulky raw payloads of remaining messages older than retention window (30d)
      const pruneStmt = db.prepare(`
        UPDATE messages
        SET raw_payload = '{"pruned":true}',
            updated_at = ?
        WHERE created_at < ? AND raw_payload != '{"pruned":true}' AND status != 'pending'
      `);
      const pruneRes = pruneStmt.run(Date.now(), cutoffMs);
      prunedCount = pruneRes.changes;

      try { db.pragma('incremental_vacuum(50)'); } catch (_) {}
    }

    return {
      prunedPayloads: prunedCount,
      deletedOldMessages: deletedCount,
      retentionDays
    };
  } catch (err) {
    console.warn('[SQLite Log Retention] Notice:', err.message);
    return { prunedPayloads: 0, deletedOldMessages: 0, error: err.message };
  }
}

/**
 * Checks whether recording 1-on-1 direct messages (DMs) is enabled.
 * Default is false (OFF).
 */
function isDmRecordingEnabled() {
  try {
    const db = getTradingDb();
    if (!db) return false;
    db.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`).run();
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'record_direct_messages'").get();
    return row?.value === 'true';
  } catch {
    return false;
  }
}

/**
 * Updates setting to record or ignore 1-on-1 direct messages (DMs).
 */
function setDmRecordingEnabled(enabled) {
  try {
    const db = getTradingDb();
    if (!db) return false;
    db.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`).run();
    db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('record_direct_messages', ?)`).run(enabled ? 'true' : 'false');
    return true;
  } catch (err) {
    console.error('Failed to update record_direct_messages setting:', err);
    return false;
  }
}

module.exports = {
  getTradingDb,
  saveParsedTelecom,
  backfillHistoricalTelecomData,
  reparseAllMessagesFromDb,
  pruneRawPayloads,
  isDmRecordingEnabled,
  setDmRecordingEnabled
};
