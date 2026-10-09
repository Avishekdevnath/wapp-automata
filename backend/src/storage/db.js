import Database from 'better-sqlite3';
import { getAccountPaths, getActiveAccountId, setActiveAccountId } from './account.js';
import { ensureKnowledgeBase } from './knowledge-base.js';

let activeDbInstance = null;
let currentDbAccountId = null;

/**
 * Initialize SQLite schemas and indexes on an open database handle.
 */
function initializeSchemas(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    -- 1. Ingested Messages Table
    CREATE TABLE IF NOT EXISTS caught_messages (
      id TEXT PRIMARY KEY,
      remote_jid TEXT NOT NULL,
      chat_name TEXT,
      chat_type TEXT NOT NULL,
      sender_jid TEXT NOT NULL,
      sender_phone TEXT,
      sender_name TEXT,
      message_text TEXT NOT NULL,
      has_media INTEGER DEFAULT 0,
      media_type TEXT,
      is_from_me INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL,
      raw_json TEXT NOT NULL,
      quoted_message_id TEXT,
      quoted_sender_jid TEXT,
      quoted_sender_name TEXT,
      quoted_text TEXT,
      is_edited INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_caught_ts ON caught_messages (timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_caught_chat ON caught_messages (remote_jid);
    CREATE INDEX IF NOT EXISTS idx_caught_sender ON caught_messages (sender_phone);
    CREATE INDEX IF NOT EXISTS idx_caught_chat_ts ON caught_messages (remote_jid, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_caught_quoted ON caught_messages (quoted_message_id);
    CREATE INDEX IF NOT EXISTS idx_caught_sender_jid ON caught_messages (sender_jid);
    CREATE INDEX IF NOT EXISTS idx_caught_quoted_sender_jid ON caught_messages (quoted_sender_jid);

    -- 2. LID to Real Phone Mappings
    CREATE TABLE IF NOT EXISTS lid_mappings (
      lid TEXT PRIMARY KEY,
      phone_jid TEXT NOT NULL,
      display_name TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_lid_phone ON lid_mappings (phone_jid);

    -- 2b. WhatsApp Groups Directory
    CREATE TABLE IF NOT EXISTS whatsapp_groups (
      jid TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      owner TEXT,
      creation INTEGER,
      description TEXT,
      participants_count INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_groups_subject ON whatsapp_groups (subject);

    -- 3. Telecom Wholesale Route Ticks
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

    -- 4. Telecom Market News Feed
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
    CREATE INDEX IF NOT EXISTS idx_news_urgency ON market_news (urgency, created_at DESC);

    -- 5. Vendor Profiles Directory
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

    -- 6. System Settings Key-Value Store
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Runtime column safety checks
  const columnsToMigrate = [
    ['quoted_message_id', 'TEXT'],
    ['quoted_sender_jid', 'TEXT'],
    ['quoted_sender_name', 'TEXT'],
    ['quoted_text', 'TEXT'],
    ['is_edited', 'INTEGER DEFAULT 0'],
    ['is_deleted', 'INTEGER DEFAULT 0']
  ];
  for (const [col, colType] of columnsToMigrate) {
    try {
      db.prepare(`ALTER TABLE caught_messages ADD COLUMN ${col} ${colType}`).run();
    } catch (_) {}
  }

  // Initialize and seed Knowledge Base if empty
  try {
    ensureKnowledgeBase(db);
  } catch (err) {
    console.error('Failed to ensure Knowledge Base schema:', err.message);
  }
}

/**
 * Get or open the SQLite database connection for the active account.
 */
export function getDb(targetAccountId = null) {
  if (targetAccountId && targetAccountId !== getActiveAccountId()) {
    setActiveAccountId(targetAccountId);
  }
  const accountId = getActiveAccountId();

  if (activeDbInstance && currentDbAccountId === accountId) {
    return activeDbInstance;
  }

  // If a different account is active, close the previous connection cleanly
  if (activeDbInstance) {
    try {
      activeDbInstance.pragma('wal_checkpoint(TRUNCATE)');
      activeDbInstance.close();
    } catch (err) {
      console.warn(`[DB] Error closing previous DB (${currentDbAccountId}):`, err.message);
    }
    activeDbInstance = null;
    currentDbAccountId = null;
  }

  const paths = getAccountPaths(accountId);
  console.log(`[DB] Opening SQLite database for [${accountId}] at: ${paths.dbPath}`);
  
  const db = new Database(paths.dbPath);
  initializeSchemas(db);

  activeDbInstance = db;
  currentDbAccountId = accountId;

  return db;
}

/**
 * Safely close the active database connection.
 */
export function closeDb() {
  if (activeDbInstance) {
    try {
      activeDbInstance.pragma('wal_checkpoint(TRUNCATE)');
      activeDbInstance.close();
      console.log(`[DB] Closed connection for [${currentDbAccountId}]`);
    } catch (err) {
      console.error('[DB] Error during close:', err.message);
    } finally {
      activeDbInstance = null;
      currentDbAccountId = null;
    }
  }
}
