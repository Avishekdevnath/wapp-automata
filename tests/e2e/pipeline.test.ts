import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createApplication, ApplicationContext } from '../../src';
import { MockWhatsAppAdapter } from '../../src/adapter';
import { verifyHmacSignature } from '../../src/webhook/signer';
import { AppConfig } from '../../src/config';

describe('Phase 11 End-to-End Pipeline Integration Tests', () => {
  let server: http.Server;
  let serverUrl: string;
  let serverStatusCode = 200;
  const webhookSecret = 'test_webhook_secret_key_12345';

  interface ReceivedWebhook {
    headers: http.IncomingHttpHeaders;
    body: string;
    payload: any;
  }

  let receivedWebhooks: ReceivedWebhook[] = [];

  let tempDir: string;
  let dbPath: string;
  let adapter: MockWhatsAppAdapter;
  let app: ApplicationContext;

  before(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        let payload: any = null;
        try {
          payload = JSON.parse(body);
        } catch {
          // ignore
        }

        receivedWebhooks.push({
          headers: req.headers,
          body,
          payload
        });

        res.writeHead(serverStatusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: serverStatusCode }));
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wapp-e2e-'));
    dbPath = path.join(tempDir, 'e2e_queue.db');
    receivedWebhooks = [];
    serverStatusCode = 200;

    adapter = new MockWhatsAppAdapter();

    const config: AppConfig = {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error', // quiet logs during e2e runs
      SQLITE_DB_PATH: dbPath,
      SESSION_DATA_PATH: path.join(tempDir, '.session'),
      WEBHOOK_URL: serverUrl,
      WEBHOOK_SECRET: webhookSecret,
      WEBHOOK_TIMEOUT_MS: 3000,
      WEBHOOK_MAX_RETRIES: 5,
      POLL_INTERVAL_MS: 50,
      BATCH_SIZE: 50
    };

    app = createApplication({ config, adapter });
  });

  afterEach(async () => {
    await app.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createRawMessageEvent = (id: string, text: string) => ({
    key: {
      id,
      remoteJid: '120363025512345678@g.us',
      fromMe: false,
      participant: '447700900123@s.whatsapp.net'
    },
    message: {
      conversation: text
    },
    messageTimestamp: 1727915000,
    pushName: 'Test Sender'
  });

  it('should ingest a burst of 100 messages, persist to SQLite, and deliver all 100 with valid HMAC signatures', async () => {
    await app.start();

    // Ingest 100 messages via WhatsApp adapter
    const totalMessages = 100;
    for (let i = 1; i <= totalMessages; i++) {
      const id = `wamid_burst_${String(i).padStart(3, '0')}`;
      await adapter.emitRawMessage(createRawMessageEvent(id, `Burst message item #${i}`));
    }

    // Wait until worker processes all 100 messages
    const startTime = Date.now();
    while (receivedWebhooks.length < totalMessages && Date.now() - startTime < 10000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    assert.equal(receivedWebhooks.length, totalMessages);

    // Verify all 100 messages have valid HMAC signatures
    for (const item of receivedWebhooks) {
      const sigHeader = item.headers['x-collector-signature'] as string;
      assert.ok(sigHeader, 'Missing X-Collector-Signature header');
      const isValid = verifyHmacSignature(item.body, webhookSecret, sigHeader);
      assert.equal(isValid, true, 'HMAC signature verification failed');

      assert.equal(item.headers['x-collector-event'], 'whatsapp.message.received');
      assert.equal(item.headers['x-collector-version'], '1.0');
      assert.ok(item.payload.message.message_id.startsWith('wamid_burst_'));
    }

    // Verify SQLite records are all marked as delivered
    const depth = app.queueRepo.getQueueDepth();
    assert.equal(depth.delivered, totalMessages);
    assert.equal(depth.pending, 0);
    assert.equal(depth.delivering, 0);

    // Verify metric counters
    const counters = app.metrics.getCounters();
    assert.equal(counters.ingested, totalMessages);
    assert.equal(counters.delivered, totalMessages);
  });

  it('should ignore duplicate messages and avoid redundant webhook dispatches', async () => {
    await app.start();

    // 1. Ingest initial 20 messages
    for (let i = 1; i <= 20; i++) {
      const id = `wamid_dedup_${i}`;
      await adapter.emitRawMessage(createRawMessageEvent(id, `Dedup test #${i}`));
    }

    // Wait for delivery of the 20 messages
    const startTime = Date.now();
    while (receivedWebhooks.length < 20 && Date.now() - startTime < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(receivedWebhooks.length, 20);

    // 2. Re-ingest the exact same 20 messages
    for (let i = 1; i <= 20; i++) {
      const id = `wamid_dedup_${i}`;
      await adapter.emitRawMessage(createRawMessageEvent(id, `Dedup test #${i}`));
    }

    // Allow time for any errant worker ticks
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify no additional webhook dispatches were made
    assert.equal(receivedWebhooks.length, 20);

    // Verify database still only has 20 total records
    const depth = app.queueRepo.getQueueDepth();
    assert.equal(depth.delivered, 20);
    assert.equal(depth.pending, 0);
  });

  it('should accumulate messages during webhook downtime and deliver all once online', async () => {
    // Start with server in failing 503 state
    serverStatusCode = 503;
    await app.start();

    // Ingest 5 messages
    for (let i = 1; i <= 5; i++) {
      const id = `wamid_downtime_${i}`;
      await adapter.emitRawMessage(createRawMessageEvent(id, `Downtime item #${i}`));
    }

    // Wait for worker to attempt delivery and schedule retries
    await new Promise((resolve) => setTimeout(resolve, 300));

    // All 5 should be scheduled for retry (status=pending, retry_count=1)
    const depthDuringOutage = app.queueRepo.getQueueDepth();
    assert.equal(depthDuringOutage.pending, 5);
    assert.equal(depthDuringOutage.delivered, 0);

    // Server recovers: return 200 OK
    serverStatusCode = 200;
    receivedWebhooks = [];

    // Advance retry timestamp so records are immediately eligible
    const records = app.queueRepo.fetchPending(10, Date.now() + 60000);
    for (const record of records) {
      app.db.prepare('UPDATE messages SET next_retry_at = 0 WHERE id = ?').run(record.id);
    }

    // Wait for worker to drain
    const startTime = Date.now();
    while (receivedWebhooks.length < 5 && Date.now() - startTime < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    assert.equal(receivedWebhooks.length, 5);
    const depthAfterRecovery = app.queueRepo.getQueueDepth();
    assert.equal(depthAfterRecovery.delivered, 5);
    assert.equal(depthAfterRecovery.pending, 0);
  });
});
