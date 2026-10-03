import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type Database from 'better-sqlite3';
import { createDatabaseConnection, runMigrations } from '../../src/persistence';
import { SQLiteQueueRepository } from '../../src/queue';
import { WebhookClient } from '../../src/webhook';
import { QueueWorker, createDeliveryHandler, QueueWatchdog } from '../../src/worker';
import { recoverStartupState, GracefulShutdownManager } from '../../src/lifecycle';
import { MockWhatsAppAdapter } from '../../src/adapter';
import { NormalizedEnvelope } from '../../src/normalizer';

describe('Phase 9 Crash Recovery & Lifecycle Integration Tests', () => {
  let server: http.Server;
  let serverUrl: string;
  let deliveredIds: string[] = [];

  let tempDir: string;
  let dbPath: string;
  let db: Database.Database;
  let repo: SQLiteQueueRepository;

  before(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.message?.message_id) {
            deliveredIds.push(parsed.message.message_id);
          }
        } catch {
          // ignore
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 200 }));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as { port: number };
        serverUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wapp-test-'));
    dbPath = path.join(tempDir, 'queue.db');
    db = createDatabaseConnection({ dbPath });
    runMigrations(db);
    repo = new SQLiteQueueRepository(db);
    deliveredIds = [];
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createSampleEnvelope = (id: string): NormalizedEnvelope => ({
    id,
    chatId: '120363025512345678@g.us',
    chatName: 'Test Group',
    chatType: 'group',
    senderId: '447700900123@s.whatsapp.net',
    senderName: 'Sender',
    timestamp: 1727915000,
    text: 'Produce update payload',
    hasMedia: false,
    media: null,
    replyTo: null,
    rawPayload: { key: { id } }
  });

  it('should recover stranded in-flight records at startup and process them to completion', async () => {
    // 1. Enqueue 5 messages
    const ids = ['crash_001', 'crash_002', 'crash_003', 'crash_004', 'crash_005'];
    for (const id of ids) {
      repo.enqueue(createSampleEnvelope(id));
    }

    // 2. Mark them as delivering (simulating crash while in-flight)
    const claimed = repo.markDelivering(ids, 1000);
    assert.equal(claimed, 5);

    // Verify all are in 'delivering' status
    const depthBefore = repo.getQueueDepth();
    assert.equal(depthBefore.delivering, 5);
    assert.equal(depthBefore.pending, 0);

    // 3. Simulate process crash & restart: run startup recovery
    const recovered = recoverStartupState(repo, { nowMs: 2000 });
    assert.equal(recovered, 5);

    const depthAfterRecovery = repo.getQueueDepth();
    assert.equal(depthAfterRecovery.delivering, 0);
    assert.equal(depthAfterRecovery.pending, 5);

    // 4. Spin up worker and verify all 5 are delivered
    const webhookClient = new WebhookClient({
      url: serverUrl,
      secret: 'recovery_test_secret_123',
      timeoutMs: 3000
    });

    const handler = createDeliveryHandler(repo, webhookClient);
    const worker = new QueueWorker(repo, handler);

    const processed = await worker.tick(3000);
    assert.equal(processed, 5);
    assert.equal(deliveredIds.length, 5);

    const depthFinal = repo.getQueueDepth();
    assert.equal(depthFinal.delivered, 5);
    assert.equal(depthFinal.pending, 0);
    assert.equal(depthFinal.delivering, 0);
  });

  it('should reset stale delivering records during watchdog checks while leaving fresh ones untouched', () => {
    const now = 200_000;
    const staleThreshold = 60_000;

    // Record 1: Stale (last attempt 70s ago)
    repo.enqueue(createSampleEnvelope('watchdog_stale_1'));
    repo.markDelivering(['watchdog_stale_1'], now - 70_000);

    // Record 2: Fresh (last attempt 15s ago)
    repo.enqueue(createSampleEnvelope('watchdog_fresh_1'));
    repo.markDelivering(['watchdog_fresh_1'], now - 15_000);

    const watchdog = new QueueWatchdog(repo, {
      staleThresholdMs: staleThreshold,
      nowProvider: () => now
    });

    // Run watchdog check
    const recovered = watchdog.check(now);
    assert.equal(recovered, 1);

    const staleRecord = repo.findById('watchdog_stale_1');
    assert.ok(staleRecord !== null);
    assert.equal(staleRecord.status, 'pending');

    const freshRecord = repo.findById('watchdog_fresh_1');
    assert.ok(freshRecord !== null);
    assert.equal(freshRecord.status, 'delivering');
  });

  it('should execute graceful shutdown closing adapter, worker, watchdog, and database', async () => {
    const adapter = new MockWhatsAppAdapter();
    await adapter.start();
    assert.equal(adapter.getStatus().state, 'authenticated');

    const webhookClient = new WebhookClient({
      url: serverUrl,
      secret: 'shutdown_test_secret_123'
    });
    const handler = createDeliveryHandler(repo, webhookClient);
    const worker = new QueueWorker(repo, handler);
    worker.start();
    assert.equal(worker.isRunning(), true);

    const watchdog = new QueueWatchdog(repo, { checkIntervalMs: 10_000 });
    watchdog.start();
    assert.equal(watchdog.active, true);

    const shutdownManager = new GracefulShutdownManager(
      { adapter, worker, watchdog, db },
      { timeoutMs: 5000, exitProcess: false }
    );

    // Trigger shutdown
    await shutdownManager.shutdown('SIGINT');

    assert.equal(shutdownManager.inProgress, true);
    assert.equal(adapter.getStatus().state, 'disconnected');
    assert.equal(worker.isRunning(), false);
    assert.equal(watchdog.active, false);
    assert.equal(db.open, false);
  });
});
