import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDeliveryResult } from '../../src/webhook/classifier';
import { WebhookDeliveryResult } from '../../src/webhook/interface';

describe('Phase 8 Delivery Response Classifier Tests', () => {
  const baseResult: WebhookDeliveryResult = {
    success: false,
    deliveryId: 'del_test_123'
  };

  it('should classify HTTP 2xx as success', () => {
    const r200 = classifyDeliveryResult({ ...baseResult, success: true, statusCode: 200 }, 1, 10);
    assert.equal(r200.disposition, 'success');

    const r204 = classifyDeliveryResult({ ...baseResult, success: true, statusCode: 204 }, 1, 10);
    assert.equal(r204.disposition, 'success');
  });

  it('should classify HTTP 400 and 422 as terminal permanent failure', () => {
    const r400 = classifyDeliveryResult({ ...baseResult, statusCode: 400, responseBody: 'Bad JSON' }, 1, 10);
    assert.equal(r400.disposition, 'fail_permanent');

    const r422 = classifyDeliveryResult({ ...baseResult, statusCode: 422, responseBody: 'Unprocessable Entity' }, 1, 10);
    assert.equal(r422.disposition, 'fail_permanent');
  });

  it('should classify HTTP 401 and 403 as auth retry', () => {
    const r401 = classifyDeliveryResult({ ...baseResult, statusCode: 401 }, 1, 10);
    assert.equal(r401.disposition, 'retry_auth');

    const r403 = classifyDeliveryResult({ ...baseResult, statusCode: 403 }, 1, 10);
    assert.equal(r403.disposition, 'retry_auth');
  });

  it('should retry HTTP 404 up to 2 attempts and fail on 3rd attempt', () => {
    const attempt1 = classifyDeliveryResult({ ...baseResult, statusCode: 404 }, 1, 10);
    assert.equal(attempt1.disposition, 'retry_transient');

    const attempt2 = classifyDeliveryResult({ ...baseResult, statusCode: 404 }, 2, 10);
    assert.equal(attempt2.disposition, 'retry_transient');

    const attempt3 = classifyDeliveryResult({ ...baseResult, statusCode: 404 }, 3, 10);
    assert.equal(attempt3.disposition, 'fail_permanent');
  });

  it('should classify HTTP 5xx, 429, and network errors as transient retry', () => {
    const r500 = classifyDeliveryResult({ ...baseResult, statusCode: 500 }, 1, 10);
    assert.equal(r500.disposition, 'retry_transient');

    const r503 = classifyDeliveryResult({ ...baseResult, statusCode: 503 }, 1, 10);
    assert.equal(r503.disposition, 'retry_transient');

    const r429 = classifyDeliveryResult({ ...baseResult, statusCode: 429 }, 1, 10);
    assert.equal(r429.disposition, 'retry_transient');

    const networkErr = classifyDeliveryResult({ ...baseResult, errorMessage: 'ETIMEDOUT' }, 1, 10);
    assert.equal(networkErr.disposition, 'retry_transient');
  });

  it('should mark permanent failure when current attempt reaches maxRetries', () => {
    const exceeded = classifyDeliveryResult({ ...baseResult, statusCode: 500 }, 10, 10);
    assert.equal(exceeded.disposition, 'fail_permanent');
    assert.ok(exceeded.reason.includes('Exceeded maximum retry attempts'));
  });
});
