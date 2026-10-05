import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseConnection, runMigrations, getCurrentSchemaVersion } from '../../src/persistence';

describe('Phase 5 Persistence & Migrations Tests', () => {
  it('should initialize SQLite connection with required pragmas', () => {
    const tempDbPath = path.resolve(process.cwd(), 'data', 'test_persistence.sqlite');

    // Clean up if exists
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

    const db = createDatabaseConnection({ dbPath: tempDbPath });

    try {
      const journalMode = db.pragma('journal_mode', { simple: true });
      const busyTimeout = db.pragma('busy_timeout', { simple: true });
      const foreignKeys = db.pragma('foreign_keys', { simple: true });

      assert.equal(journalMode, 'wal');
      assert.equal(busyTimeout, 5000);
      assert.equal(foreignKeys, 1);
    } finally {
      db.close();
      // Clean up files
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      const walFile = `${tempDbPath}-wal`;
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
      const shmFile = `${tempDbPath}-shm`;
      if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
    }
  });

  it('should apply migrations atomically and record in _schema_versions', () => {
    const db = createDatabaseConnection({ dbPath: ':memory:' });

    try {
      assert.equal(getCurrentSchemaVersion(db), 0);

      const applied = runMigrations(db);
      assert.equal(applied, 2);
      assert.equal(getCurrentSchemaVersion(db), 2);

      // Verify messages table exists
      const tableCheck = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'")
        .get() as { name: string };
      assert.equal(tableCheck.name, 'messages');

      // Verify route_ticks table exists
      const routeCheck = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='route_ticks'")
        .get() as { name: string };
      assert.equal(routeCheck.name, 'route_ticks');

      // Verify re-running migrations does not re-apply
      const secondRun = runMigrations(db);
      assert.equal(secondRun, 0);
      assert.equal(getCurrentSchemaVersion(db), 2);
    } finally {
      db.close();
    }
  });
});
