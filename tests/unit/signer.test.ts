import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { computeHmacSignature, verifyHmacSignature, isTimestampValid } from '../../src/webhook/signer';

describe('Phase 7 Webhook HMAC Signer Tests', () => {
  const testSecret = 'super_secret_test_key_12345';
  const testPayload = JSON.stringify({ message: 'Hello Webhook', timestamp: 1727915000 });

  it('should compute valid HMAC SHA-256 signature with sha256= prefix', () => {
    const signature = computeHmacSignature(testPayload, testSecret);
    assert.ok(signature.startsWith('sha256='));

    const expectedHex = crypto.createHmac('sha256', testSecret).update(testPayload).digest('hex');
    assert.equal(signature, `sha256=${expectedHex}`);
  });

  it('should verify matching signatures successfully', () => {
    const signature = computeHmacSignature(testPayload, testSecret);
    const isValid = verifyHmacSignature(testPayload, testSecret, signature);
    assert.equal(isValid, true);
  });

  it('should reject tampered payload or incorrect secret', () => {
    const signature = computeHmacSignature(testPayload, testSecret);

    // Tampered payload
    const isTamperedValid = verifyHmacSignature(testPayload + ' ', testSecret, signature);
    assert.equal(isTamperedValid, false);

    // Wrong secret
    const isWrongSecretValid = verifyHmacSignature(testPayload, 'wrong_secret_key_12345', signature);
    assert.equal(isWrongSecretValid, false);

    // Malformed signature header
    assert.equal(verifyHmacSignature(testPayload, testSecret, 'invalid-header'), false);
  });

  it('should validate timestamp within 5-minute replay window', () => {
    const now = Date.now();

    // Exactly now
    assert.equal(isTimestampValid(now, now), true);

    // 2 minutes ago
    assert.equal(isTimestampValid(now - 120000, now), true);

    // 4 minutes 59 seconds ago
    assert.equal(isTimestampValid(now - 299000, now), true);

    // 5 minutes 1 second ago (expired)
    assert.equal(isTimestampValid(now - 301000, now), false);

    // 10 minutes ago (replay attack)
    assert.equal(isTimestampValid(now - 600000, now), false);

    // 6 minutes in future (excessive future clock drift)
    assert.equal(isTimestampValid(now + 360000, now), false);
  });
});
