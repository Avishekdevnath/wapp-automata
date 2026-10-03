import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type Database from 'better-sqlite3';
import { createDatabaseConnection, runMigrations } from '../../src/persistence';
import { SQLiteQueueRepository } from '../../src/queue/repository';
import { NormalizedEnvelope } from '../../src/normalizer/types';

describe('Phase 5 Queue Repository Integration Tests', () => {
  let db: Database.Database;
  let repo: SQLiteQueueRepository;

  const sampleEnvelope: NormalizedEnvelope = {
    id: 'wamid_test_001',
    chatId: '120363025512345678@g.us',
    chatName: 'Test Group',
    chatType: 'group',
    senderId: '447700900123@s.whatsapp.net',
    senderName: 'Alice',
    timestamp: 1727915000,
    text: 'Raw message content',
    hasMedia: false,
    media: null,
    replyTo: null,
    rawPayload: { key: { id: 'wamid_test_001' }, text: 'Raw message content' }
  };

  beforeEach(() => {
    db = createDatabaseConnection({ dbPath: ':memory:' });
    runMigrations(db);
    repo = new SQLiteQueueRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should enqueue a new normalized message successfully', () => {
    const inserted = repo.enqueue(sampleEnvelope);
    assert.equal(inserted, true);

    const record = repo.findById('wamid_test_001');
    assert.ok(record !== null);
    assert.equal(record.id, 'wamid_test_001');
    assert.equal(record.chat_id, '120363025512345678@g.us');
    assert.equal(record.status, 'pending');
    assert.equal(record.retry_count, 0);
    assert.equal(record.next_retry_at, 0);
    assert.equal(record.message_text, 'Raw message content');
  });

  it('should ignore duplicate message IDs (idempotent enqueue)', () => {
    const firstInsert = repo.enqueue(sampleEnvelope);
    assert.equal(firstInsert, true);

    // Duplicate attempt with modified text
    const duplicateEnvelope = { ...sampleEnvelope, text: 'Modified duplicate attempt' };
    const secondInsert = repo.enqueue(duplicateEnvelope);
    assert.equal(secondInsert, false, 'Duplicate insert should return false');

    // Verify row count is strictly 1 and original text is preserved
    const record = repo.findById('wamid_test_001');
    assert.ok(record !== null);
    assert.equal(record.message_text, 'Raw message content');

    const depth = repo.getQueueDepth();
    assert.equal(depth.pending, 1);
  });

  it('should fetch pending messages ordered chronologically', () => {
    const msg1: NormalizedEnvelope = { ...sampleEnvelope, id: 'id_1', timestamp: 100 };
    const msg2: NormalizedEnvelope = { ...sampleEnvelope, id: 'id_2', timestamp: 200 };
    const msg3: NormalizedEnvelope = { ...sampleEnvelope, id: 'id_3', timestamp: 300 };

    repo.enqueue(msg1);
    repo.enqueue(msg2);
    repo.enqueue(msg3);

    const pending = repo.fetchPending(2);
    assert.equal(pending.length, 2);
    assert.equal(pending[0].id, 'id_1');
    assert.equal(pending[1].id, 'id_2');
  });

  it('should transition status from pending to delivering atomically', () => {
    repo.enqueue(sampleEnvelope);

    const claimedCount = repo.markDelivering(['wamid_test_001'], 1727915555000);
    assert.equal(claimedCount, 1);

    const record = repo.findById('wamid_test_001');
    assert.ok(record !== null);
    assert.equal(record.status, 'delivering');
    assert.equal(record.last_attempt_at, 1727915555000);

    // A second claim attempt should affect 0 rows because status is no longer pending
    const secondClaim = repo.markDelivering(['wamid_test_001'], 1727915555000);
    assert.equal(secondClaim, 0);
  });

  it('should mark message delivered successfully', () => {
    repo.enqueue(sampleEnvelope);
    repo.markDelivering(['wamid_test_001']);
    repo.markDelivered('wamid_test_001', 1727916000000);

    const record = repo.findById('wamid_test_001');
    assert.ok(record !== null);
    assert.equal(record.status, 'delivered');
    assert.equal(record.delivered_at, 1727916000000);
  });

  it('should schedule retry for transient failures', () => {
    repo.enqueue(sampleEnvelope);
    repo.markDelivering(['wamid_test_001']);

    const retryAt = Date.now() + 5000;
    repo.markRetry('wamid_test_001', retryAt, 503, 'Service Unavailable', Date.now());

    const record = repo.findById('wamid_test_001');
    assert.ok(record !== null);
    assert.equal(record.status, 'pending');
    assert.equal(record.retry_count, 1);
    assert.equal(record.next_retry_at, retryAt);
    assert.equal(record.last_http_status, 503);
    assert.equal(record.last_error, 'Service Unavailable');
  });

  it('should mark message failed for permanent errors', () => {
    repo.enqueue(sampleEnvelope);
    repo.markDelivering(['wamid_test_001']);

    repo.markFailed('wamid_test_001', 400, 'Bad Request', Date.now());

    const record = repo.findById('wamid_test_001');
    assert.ok(record !== null);
    assert.equal(record.status, 'failed');
    assert.equal(record.last_http_status, 400);
    assert.equal(record.last_error, 'Bad Request');
  });

  it('should recover stale delivering messages on startup', () => {
    repo.enqueue(sampleEnvelope);
    repo.markDelivering(['wamid_test_001'], 1000);

    // Simulate process crash: row remains in 'delivering'
    const depthBefore = repo.getQueueDepth();
    assert.equal(depthBefore.delivering, 1);

    // Boot recovery: reset all delivering rows
    const recoveredCount = repo.recoverStaleProcessing(0);
    assert.equal(recoveredCount, 1);

    const depthAfter = repo.getQueueDepth();
    assert.equal(depthAfter.pending, 1);
    assert.equal(depthAfter.delivering, 0);

    const record = repo.findById('wamid_test_001');
    assert.ok(record !== null);
    assert.equal(record.status, 'pending');
  });
});
