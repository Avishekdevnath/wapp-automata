import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBackoffMs, calculateAuthBackoffMs } from '../../src/worker/backoff';

describe('Phase 8 Backoff Calculation Tests', () => {
  it('should calculate exponential progression with zero jitter', () => {
    const opts = { baseDelayMs: 1000, maxDelayMs: 60000, maxJitterMs: 0 };

    assert.equal(calculateBackoffMs(0, opts), 1000);  // 1000 * 2^0
    assert.equal(calculateBackoffMs(1, opts), 2000);  // 1000 * 2^1
    assert.equal(calculateBackoffMs(2, opts), 4000);  // 1000 * 2^2
    assert.equal(calculateBackoffMs(3, opts), 8000);  // 1000 * 2^3
    assert.equal(calculateBackoffMs(4, opts), 16000); // 1000 * 2^4
  });

  it('should cap exponential backoff at maxDelayMs', () => {
    const opts = { baseDelayMs: 2000, maxDelayMs: 30000, maxJitterMs: 0 };

    // 2000 * 2^10 = 2,048,000 > 30000
    const delay = calculateBackoffMs(10, opts);
    assert.equal(delay, 30000);
  });

  it('should bound jitter within specified maxJitterMs', () => {
    const opts = { baseDelayMs: 1000, maxDelayMs: 10000, maxJitterMs: 500 };

    for (let i = 0; i < 50; i++) {
      const delay = calculateBackoffMs(0, opts);
      assert.ok(delay >= 1000, `Delay ${delay} should be >= 1000`);
      assert.ok(delay <= 1500, `Delay ${delay} should be <= 1500`);
    }
  });

  it('should calculate auth backoff accurately', () => {
    const authDelay = calculateAuthBackoffMs({ authDelayMs: 300000, maxJitterMs: 0 });
    assert.equal(authDelay, 300000);
  });
});
