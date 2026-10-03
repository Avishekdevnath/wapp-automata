import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Logger, redactSensitiveData } from '../../src/logging/logger';

describe('Phase 2 Logger & Redaction Tests', () => {
  it('should redact sensitive keys recursively in objects and arrays', () => {
    const rawData = {
      user: 'john_doe',
      WEBHOOK_SECRET: 'super_secret_value_xyz',
      nested: {
        api_key: 'key_1234567890',
        normalField: 'hello',
        deepCredentials: {
          password: 'my_password_999'
        }
      },
      tokens: [
        { token: 'bearer_token_abc' },
        { label: 'public_info' }
      ]
    };

    const redacted = redactSensitiveData(rawData) as Record<string, unknown>;

    assert.equal(redacted.user, 'john_doe');
    assert.equal(redacted.WEBHOOK_SECRET, '[REDACTED]');

    const nested = redacted.nested as Record<string, unknown>;
    assert.equal(nested.api_key, '[REDACTED]');
    assert.equal(nested.normalField, 'hello');

    const deep = nested.deepCredentials as Record<string, unknown>;
    assert.equal(deep.password, '[REDACTED]');

    const tokens = redacted.tokens as Array<Record<string, unknown>>;
    assert.equal(tokens[0].token, '[REDACTED]');
    assert.equal(tokens[1].label, 'public_info');
  });

  it('should handle primitives, null, and undefined safely in redaction', () => {
    assert.equal(redactSensitiveData(null), null);
    assert.equal(redactSensitiveData(undefined), undefined);
    assert.equal(redactSensitiveData('regular text'), 'regular text');
    assert.equal(redactSensitiveData(12345), 12345);
    assert.equal(redactSensitiveData(true), true);
  });

  it('should format Error instances cleanly in redaction', () => {
    const err = new Error('Database failure');
    const redacted = redactSensitiveData(err) as Record<string, unknown>;

    assert.equal(redacted.name, 'Error');
    assert.equal(redacted.message, 'Database failure');
    assert.ok(typeof redacted.stack === 'string');
  });

  it('should format structured JSON output when emitting logs', () => {
    let capturedOutput = '';
    const originalWrite = process.stdout.write;

    try {
      // Intercept stdout
      process.stdout.write = (chunk: string | Uint8Array) => {
        capturedOutput += chunk.toString();
        return true;
      };

      const logger = new Logger('test-module', 'info');
      logger.info('Message processed successfully', {
        messageId: 'wamid_123',
        webhook_secret: 'leaked_secret_key'
      });

      assert.ok(capturedOutput.length > 0, 'Log output should not be empty');

      const parsed = JSON.parse(capturedOutput.trim());
      assert.equal(parsed.level, 'INFO');
      assert.equal(parsed.module, 'test-module');
      assert.equal(parsed.message, 'Message processed successfully');
      assert.equal(parsed.context.messageId, 'wamid_123');
      assert.equal(parsed.context.webhook_secret, '[REDACTED]');
      assert.ok(typeof parsed.timestamp === 'string');
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it('should respect configured log level threshold', () => {
    let capturedOutput = '';
    const originalWrite = process.stdout.write;

    try {
      process.stdout.write = (chunk: string | Uint8Array) => {
        capturedOutput += chunk.toString();
        return true;
      };

      const logger = new Logger('test-level', 'warn');
      logger.debug('This debug should not be printed');
      logger.info('This info should not be printed');

      assert.equal(capturedOutput, '', 'Debug and info should be suppressed at warn level');
    } finally {
      process.stdout.write = originalWrite;
    }
  });
});
