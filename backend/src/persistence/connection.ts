import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export interface DatabaseConnectionOptions {
  dbPath: string;
  readonly?: boolean;
}

/**
 * Creates and configures an optimized, crash-safe SQLite database connection.
 * Applies WAL mode, synchronous=NORMAL, and busy_timeout=5000ms.
 */
export function createDatabaseConnection(options: DatabaseConnectionOptions): Database.Database {
  const { dbPath, readonly = false } = options;

  // Ensure parent directory exists for file-based databases
  if (dbPath !== ':memory:') {
    const parentDir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  const db = new Database(dbPath, { readonly });

  // Configure high-reliability WAL pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  return db;
}
