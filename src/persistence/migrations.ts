import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema: messages table and queue indexes',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          chat_type TEXT NOT NULL,
          source_name TEXT,
          message_timestamp INTEGER NOT NULL,
          message_text TEXT NOT NULL,
          has_media INTEGER NOT NULL DEFAULT 0,
          media_type TEXT,
          media_metadata TEXT,
          raw_payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_retry_at INTEGER NOT NULL DEFAULT 0,
          last_attempt_at INTEGER,
          last_http_status INTEGER,
          last_error TEXT,
          delivered_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_messages_queue_poll 
        ON messages (status, next_retry_at, created_at);

        CREATE INDEX IF NOT EXISTS idx_messages_stale_recovery 
        ON messages (status, last_attempt_at);

        CREATE INDEX IF NOT EXISTS idx_messages_chat_source 
        ON messages (chat_id, message_timestamp);
      `);
    }
  },
  {
    version: 2,
    description: 'Wholesale telecom trading tables: route_ticks, market_news, vendors',
    up: (db) => {
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

        CREATE INDEX IF NOT EXISTS idx_routes_dest 
        ON route_ticks (country, route_type, created_at);

        CREATE INDEX IF NOT EXISTS idx_routes_price 
        ON route_ticks (country, rate_per_min);

        CREATE INDEX IF NOT EXISTS idx_routes_created 
        ON route_ticks (created_at DESC);

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

        CREATE INDEX IF NOT EXISTS idx_news_created 
        ON market_news (created_at DESC);

        CREATE TABLE IF NOT EXISTS vendors (
          phone TEXT PRIMARY KEY,
          name TEXT,
          company TEXT,
          total_offers INTEGER DEFAULT 1,
          last_seen_at INTEGER NOT NULL
        );
      `);
    }
  }
];

/**
 * Initializes the schema version tracker and executes any pending migrations.
 * Guaranteed atomic inside an immediate transaction.
 */
export function runMigrations(db: Database.Database): number {
  // Ensure schema versions metadata table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_versions (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const currentVersionRow = db
    .prepare('SELECT MAX(version) as maxVersion FROM _schema_versions')
    .get() as { maxVersion: number | null };

  const currentVersion = currentVersionRow?.maxVersion ?? 0;
  let appliedCount = 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      const applyMigration = db.transaction(() => {
        migration.up(db);
        db.prepare(`
          INSERT INTO _schema_versions (version, description, applied_at)
          VALUES (?, ?, ?)
        `).run(migration.version, migration.description, Date.now());
      });

      applyMigration();
      appliedCount++;
    }
  }

  return appliedCount;
}

/**
 * Returns current database schema version.
 */
export function getCurrentSchemaVersion(db: Database.Database): number {
  try {
    const row = db
      .prepare('SELECT MAX(version) as maxVersion FROM _schema_versions')
      .get() as { maxVersion: number | null };
    return row?.maxVersion ?? 0;
  } catch {
    return 0;
  }
}
