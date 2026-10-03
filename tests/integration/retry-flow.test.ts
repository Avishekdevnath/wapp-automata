import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type Database from 'better-sqlite3';
import { createDatabaseConnection, runMigrations } from '../../src/persistence';
import { SQLiteQueueRepository } from '../../src/queue';
import { WebhookClient } from '../../src/webhook';
import { QueueWorker, createDeliveryHandler } from '../../src/worker';
import { NormalizedEnvelope } from '../../src/normalizer';

describe('Phase 8 End-to-End Retry Flow Integration Tests', () => {
  let server: http.Server;
  let serverUrl: string;
  let serverResponseCode = 200;
  let serverHitCount = 0;

  let db: Database.Database;
  let repo: SQLiteQueueRepository;

  before(async () => {
    server = http.createServer((req, res) => {
      serverHitCount++;
      res.writeHead(serverResponseCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: serverResponseCode }));
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
    db = createDatabaseConnection({ dbPath: ':memory:' });
    runMigrations(db);
    repo = new SQLiteQueueRepository(db);
    serverHitCount = 0;
  });

  afterEach(() => {
    db.close();
  });

  const createSampleEnvelope = (id: string): NormalizedEnvelope => ({
    id,
    chatId: '120363025512345678@g.us',
    chatName: 'Test Group',
    chatType: 'group',
    senderId: '447700900123@s.whatsapp.net',
    senderName: 'Sender',
    timestamp: 1727915000,
    text: 'Produce update',
    hasMedia: false,
    media: null,
    replyTo: null,
    rawPayload: { key: { id } }
  });

  it('should retry on transient HTTP 503 and deliver successfully on next attempt', async () => {
    serverResponseCode = 503; // Initially failing

    const webhookClient = new WebhookClient({
      url: serverUrl,
      secret: 'retry_flow_secret_key_123',
      timeoutMs: 3000
    });

    let now = 1000000;
    const handler = createDeliveryHandler(repo, webhookClient, {
      maxRetries: 5,
      backoffOptions: { baseDelayMs: 100, maxDelayMs: 500, maxJitterMs: 0 },
      nowProvider: () => now
    });

    const worker = new QueueWorker(repo, handler);

    // Enqueue message
    repo.enqueue(createSampleEnvelope('wamid_retry_001'));

    // First attempt (fails with 503)
    const processedFirst = await worker.tick(now);
    assert.equal(processedFirst, 1);
    assert.equal(serverHitCount, 1);

    const recordAfterFirst = repo.findById('wamid_retry_001');
    assert.ok(recordAfterFirst !== null);
    assert.equal(recordAfterFirst.status, 'pending');
    assert.equal(recordAfterFirst.retry_count, 1);
    assert.equal(recordAfterFirst.last_http_status, 503);
    assert.equal(recordAfterFirst.next_retry_at, now + 100); // 100ms backoff

    // Second immediate attempt at now + 50ms should skip (next_retry_at in future)
    const skipped = await worker.tick(now + 50);
    assert.equal(skipped, 0);
    assert.equal(serverHitCount, 1);

    // Flip server to 200 OK and advance clock to now + 100ms
    serverResponseCode = 200;
    now = 1000100;
    const processedSecond = await worker.tick(now);
    assert.equal(processedSecond, 1);
    assert.equal(serverHitCount, 2);

    const recordFinal = repo.findById('wamid_retry_001');
    assert.ok(recordFinal !== null);
    assert.equal(recordFinal.status, 'delivered');
    assert.ok(recordFinal.delivered_at !== null);
  });

  it('should immediately fail permanent client error HTTP 400 without continuous retries', async () => {
    serverResponseCode = 400; // Permanent bad request

    const webhookClient = new WebhookClient({
      url: serverUrl,
      secret: 'retry_flow_secret_key_123',
      timeoutMs: 3000
    });

    const handler = createDeliveryHandler(repo, webhookClient, { maxRetries: 5 });
    const worker = new QueueWorker(repo, handler);

    repo.enqueue(createSampleEnvelope('wamid_perm_fail'));

    const processed = await worker.tick();
    assert.equal(processed, 1);
    assert.equal(serverHitCount, 1);

    const record = repo.findById('wamid_perm_fail');
    assert.ok(record !== null);
    assert.equal(record.status, 'failed');
    assert.equal(record.last_http_status, 400);
    assert.ok(record.last_error?.includes('Non-retryable client validation error'));

    // Subsequent ticks should ignore this failed record
    const secondTick = await worker.tick();
    assert.equal(secondTick, 0);
    assert.equal(serverHitCount, 1);
  });
});
