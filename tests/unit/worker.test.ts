import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type Database from 'better-sqlite3';
import { createDatabaseConnection, runMigrations } from '../../src/persistence';
import { SQLiteQueueRepository } from '../../src/queue';
import { QueueWorker } from '../../src/worker';
import { NormalizedEnvelope } from '../../src/normalizer';
import { QueueRecord } from '../../src/queue/interface';

describe('Phase 6 Queue Worker Engine Tests', () => {
  let db: Database.Database;
  let repo: SQLiteQueueRepository;

  const createSampleEnvelope = (id: string, text: string = 'Sample text'): NormalizedEnvelope => ({
    id,
    chatId: '120363025512345678@g.us',
    chatName: 'Test Group',
    chatType: 'group',
    senderId: '447700900123@s.whatsapp.net',
    senderName: 'Sender',
    timestamp: 1727915000,
    text,
    hasMedia: false,
    media: null,
    replyTo: null,
    rawPayload: { key: { id } }
  });

  beforeEach(() => {
    db = createDatabaseConnection({ dbPath: ':memory:' });
    runMigrations(db);
    repo = new SQLiteQueueRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should process pending messages via tick()', async () => {
    repo.enqueue(createSampleEnvelope('wamid_001'));
    repo.enqueue(createSampleEnvelope('wamid_002'));

    const deliveredIds: string[] = [];
    const worker = new QueueWorker(repo, async (record: QueueRecord) => {
      deliveredIds.push(record.id);
      repo.markDelivered(record.id);
    });

    const processed = await worker.tick();
    assert.equal(processed, 2);
    assert.deepEqual(deliveredIds, ['wamid_001', 'wamid_002']);

    const depth = repo.getQueueDepth();
    assert.equal(depth.pending, 0);
    assert.equal(depth.delivered, 2);
  });

  it('should respect batch size limit during tick()', async () => {
    for (let i = 1; i <= 5; i++) {
      repo.enqueue(createSampleEnvelope(`wamid_${i}`));
    }

    const processedIds: string[] = [];
    const worker = new QueueWorker(
      repo,
      async (record) => {
        processedIds.push(record.id);
        repo.markDelivered(record.id);
      },
      { batchSize: 3 }
    );

    const firstBatchCount = await worker.tick();
    assert.equal(firstBatchCount, 3);
    assert.equal(processedIds.length, 3);

    const secondBatchCount = await worker.tick();
    assert.equal(secondBatchCount, 2);
    assert.equal(processedIds.length, 5);
  });

  it('should ignore pending messages whose next_retry_at is in the future', async () => {
    repo.enqueue(createSampleEnvelope('wamid_eligible'));
    repo.enqueue(createSampleEnvelope('wamid_future'));

    // Schedule wamid_future for 1 hour from now
    const now = Date.now();
    repo.markDelivering(['wamid_future']);
    repo.markRetry('wamid_future', now + 3600000, 500, 'Server Error', now);

    const processedIds: string[] = [];
    const worker = new QueueWorker(repo, async (record) => {
      processedIds.push(record.id);
      repo.markDelivered(record.id);
    });

    const count = await worker.tick(now);
    assert.equal(count, 1);
    assert.deepEqual(processedIds, ['wamid_eligible']);

    const futureRecord = repo.findById('wamid_future');
    assert.ok(futureRecord !== null);
    assert.equal(futureRecord.status, 'pending');
    assert.equal(futureRecord.retry_count, 1);
  });

  it('should handle errors inside deliveryHandler without crashing tick()', async () => {
    repo.enqueue(createSampleEnvelope('wamid_fail'));
    repo.enqueue(createSampleEnvelope('wamid_ok'));

    const worker = new QueueWorker(repo, async (record) => {
      if (record.id === 'wamid_fail') {
        throw new Error('Simulated network drop');
      }
      repo.markDelivered(record.id);
    });

    const count = await worker.tick();
    assert.equal(count, 2);

    const failRecord = repo.findById('wamid_fail');
    assert.ok(failRecord !== null);
    // Was claimed as delivering
    assert.equal(failRecord.status, 'delivering');

    const okRecord = repo.findById('wamid_ok');
    assert.ok(okRecord !== null);
    assert.equal(okRecord.status, 'delivered');
  });

  it('should start and stop the background polling loop cleanly', async () => {
    const worker = new QueueWorker(
      repo,
      async (record) => {
        repo.markDelivered(record.id);
      },
      { pollIntervalMs: 50 }
    );

    assert.equal(worker.isRunning(), false);

    worker.start();
    assert.equal(worker.isRunning(), true);

    // Enqueue message while worker is running
    repo.enqueue(createSampleEnvelope('wamid_live'));

    // Wait for worker tick to process
    await new Promise((resolve) => setTimeout(resolve, 150));

    const record = repo.findById('wamid_live');
    assert.ok(record !== null);
    assert.equal(record.status, 'delivered');

    await worker.stop();
    assert.equal(worker.isRunning(), false);
  });
});
