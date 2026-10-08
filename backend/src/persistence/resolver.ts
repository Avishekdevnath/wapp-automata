import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseConnection } from './connection';
import { runMigrations } from './migrations';

// Determine root data directory
function getDataDirectory(): string {
  if (process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)) {
    return process.env.DATA_DIR;
  }
  if (fs.existsSync('/opt/wapp-automata/data')) {
    return '/opt/wapp-automata/data';
  }
  // Try walking up to project root
  let cur = __dirname;
  while (cur && path.dirname(cur) !== cur) {
    if (fs.existsSync(path.join(cur, 'data'))) {
      return path.join(cur, 'data');
    }
    cur = path.dirname(cur);
  }
  return path.resolve(process.cwd(), 'data');
}

const DATA_DIR = getDataDirectory();
const ACCOUNTS_DIR = path.join(DATA_DIR, 'accounts');

// Connection Pool cache keyed by accountId
const connectionPool = new Map<string, Database.Database>();

/**
 * Sanitizes an incoming account ID to prevent path traversal.
 */
export function sanitizeAccountId(accountId?: string | null): string {
  if (!accountId || typeof accountId !== 'string') return 'default';
  const clean = accountId.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
  return clean || 'default';
}

/**
 * Resolves the absolute path for an account's SQLite database file.
 */
export function getAccountDatabasePath(accountId: string = 'default'): string {
  const cleanId = sanitizeAccountId(accountId);
  if (cleanId === 'default') {
    const collectorDbPath = process.env.SQLITE_DB_PATH || path.join(DATA_DIR, 'collector.sqlite');
    // If accounts/default.sqlite has app_settings, merge into collector.sqlite to preserve AI API keys
    const defaultLegacy = path.join(ACCOUNTS_DIR, 'default.sqlite');
    if (fs.existsSync(defaultLegacy) && fs.existsSync(collectorDbPath)) {
      try {
        const sqlite = require('better-sqlite3');
        const legacyDb = new sqlite(defaultLegacy, { readonly: true });
        const hasSettings = legacyDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'").get();
        if (hasSettings) {
          const settingsRows = legacyDb.prepare("SELECT key, value FROM app_settings").all();
          legacyDb.close();
          if (settingsRows.length > 0) {
            const targetDb = new sqlite(collectorDbPath);
            targetDb.exec(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)`);
            const insertStmt = targetDb.prepare(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`);
            for (const row of settingsRows) {
              insertStmt.run(row.key, row.value);
            }
            targetDb.close();
          }
        } else {
          legacyDb.close();
        }
      } catch (_) {}
    }
    return collectorDbPath;
  }

  if (!fs.existsSync(ACCOUNTS_DIR)) {
    fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
  }

  return path.join(ACCOUNTS_DIR, `${cleanId}.sqlite`);
}

/**
 * Resolves or instantiates an optimized, migrated SQLite connection for a given account.
 * Guarantees atomic physical silo isolation.
 */
export function getAccountDatabase(accountId: string = 'default'): Database.Database {
  const cleanId = sanitizeAccountId(accountId);

  // Return existing active connection from pool
  const cached = connectionPool.get(cleanId);
  if (cached && cached.open) {
    return cached;
  }

  const dbPath = getAccountDatabasePath(cleanId);
  const db = createDatabaseConnection({ dbPath });

  // Automatically apply baseline tables (messages, route_ticks, market_news, vendors)
  try {
    runMigrations(db);
  } catch (err: any) {
    console.error(`[Account Resolver] Failed to run migrations for account "${cleanId}":`, err.message);
  }

  connectionPool.set(cleanId, db);
  return db;
}

/**
 * Closes an individual account's database connection.
 */
export function closeAccountDatabase(accountId: string): boolean {
  const cleanId = sanitizeAccountId(accountId);
  const db = connectionPool.get(cleanId);
  if (db) {
    try {
      if (db.open) db.close();
    } catch {}
    connectionPool.delete(cleanId);
    return true;
  }
  return false;
}

/**
 * Closes all active database connections in the pool (for graceful shutdown).
 */
export function closeAllDatabases(): void {
  for (const [id, db] of connectionPool.entries()) {
    try {
      if (db.open) db.close();
    } catch {}
  }
  connectionPool.clear();
}

/**
 * Lists all registered account IDs that currently have a physical database.
 */
export function listAccountIds(): string[] {
  if (!fs.existsSync(ACCOUNTS_DIR)) {
    return ['default'];
  }

  const files = fs.readdirSync(ACCOUNTS_DIR);
  const accounts = files
    .filter((f) => f.endsWith('.sqlite'))
    .map((f) => f.replace(/\.sqlite$/, ''));

  if (!accounts.includes('default')) {
    accounts.unshift('default');
  }

  return Array.from(new Set(accounts));
}
