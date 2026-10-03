import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebhookClient } from '../../src/webhook/client';
import { verifyHmacSignature, isTimestampValid } from '../../src/webhook/signer';
import { QueueRecord } from '../../src/queue/interface';

describe('Phase 7 Webhook Client Integration Tests', () => {
  let server: http.Server;
  let serverUrl: string;
  const testSecret = 'webhook_super_secret_testing_key';

  let lastReceivedHeaders: http.IncomingHttpHeaders = {};
  let lastReceivedBody: string = '';
  let serverResponseCode = 200;
  let serverResponseDelayMs = 0;

  before(async () => {
    server = http.createServer((req, res) => {
      lastReceivedHeaders = req.headers;
      const chunks: Buffer[] = [];

      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        lastReceivedBody = Buffer.concat(chunks).toString('utf8');

        setTimeout(() => {
          res.writeHead(serverResponseCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ acknowledged: true, code: serverResponseCode }));
        }, serverResponseDelayMs);
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

  const sampleRecord: QueueRecord = {
    id: 'wamid_integration_001',
    chat_id: '120363025512345678@g.us',
    sender_id: '447700900123@s.whatsapp.net',
    chat_type: 'group',
    source_name: 'Market Group',
    message_timestamp: 1727915000,
    message_text: 'Wheat: $240/MT',
    has_media: 0,
    media_type: null,
    media_metadata: null,
    raw_payload: JSON.stringify({ key: { id: 'wamid_integration_001' }, text: 'Wheat: $240/MT' }),
    status: 'delivering',
    retry_count: 0,
    next_retry_at: 0,
    last_attempt_at: 1727915100000,
    last_http_status: null,
    last_error: null,
    delivered_at: null,
    created_at: 1727915050000,
    updated_at: 1727915100000
  };

  it('should dispatch valid HTTP POST with required headers and verified HMAC signature', async () => {
    serverResponseCode = 200;
    serverResponseDelayMs = 0;

    const client = new WebhookClient({
      url: serverUrl,
      secret: testSecret,
      timeoutMs: 5000
    });

    const result = await client.deliver(sampleRecord);

    assert.equal(result.success, true);
    assert.equal(result.statusCode, 200);
    assert.ok(result.deliveryId.startsWith('del_'));

    // Verify headers received by server
    assert.equal(lastReceivedHeaders['content-type'], 'application/json; charset=utf-8');
    assert.equal(lastReceivedHeaders['user-agent'], 'WhatsApp-Raw-Collector/1.0.0');
    assert.equal(lastReceivedHeaders['x-collector-event'], 'whatsapp.message.received');
    assert.equal(lastReceivedHeaders['x-collector-version'], '1.0');
    assert.equal(lastReceivedHeaders['x-collector-delivery-id'], result.deliveryId);

    // Verify HMAC Signature on server side
    const receivedSig = lastReceivedHeaders['x-collector-signature'] as string;
    assert.ok(typeof receivedSig === 'string');
    const isSigValid = verifyHmacSignature(lastReceivedBody, testSecret, receivedSig);
    assert.equal(isSigValid, true, 'HMAC signature should be cryptographically valid');

    // Verify Timestamp on server side
    const receivedTs = Number(lastReceivedHeaders['x-collector-timestamp']);
    assert.equal(isTimestampValid(receivedTs), true);

    // Verify JSON Payload body structure
    const parsedPayload = JSON.parse(lastReceivedBody);
    assert.equal(parsedPayload.event, 'whatsapp.message.received');
    assert.equal(parsedPayload.version, '1.0');
    assert.equal(parsedPayload.attempt, 1);
    assert.equal(parsedPayload.message.message_id, 'wamid_integration_001');
    assert.equal(parsedPayload.message.text, 'Wheat: $240/MT');
    assert.equal(parsedPayload.message.chat_name, 'Market Group');
  });

  it('should capture HTTP error responses accurately', async () => {
    serverResponseCode = 503;
    serverResponseDelayMs = 0;

    const client = new WebhookClient({
      url: serverUrl,
      secret: testSecret,
      timeoutMs: 5000
    });

    const result = await client.deliver(sampleRecord);

    assert.equal(result.success, false);
    assert.equal(result.statusCode, 503);
    assert.ok(result.responseBody?.includes('503'));
  });

  it('should handle request timeout and abort cleanly', async () => {
    serverResponseCode = 200;
    serverResponseDelayMs = 300; // Delay longer than client timeout

    const client = new WebhookClient({
      url: serverUrl,
      secret: testSecret,
      timeoutMs: 50 // Short 50ms timeout
    });

    const result = await client.deliver(sampleRecord);

    assert.equal(result.success, false);
    assert.ok(result.errorMessage?.includes('timed out'));
  });
});
