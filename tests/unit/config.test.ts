import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig, ConfigurationError } from '../../src/config/schema';

describe('Phase 2 Configuration Tests', () => {
  const validBaseEnv: Record<string, string> = {
    NODE_ENV: 'development',
    WEBHOOK_URL: 'https://example.com/api/webhook',
    WEBHOOK_SECRET: 'super_secret_shared_key_12345'
  };

  it('should successfully parse valid configuration with default values', () => {
    const config = parseConfig(validBaseEnv);

    assert.equal(config.NODE_ENV, 'development');
    assert.equal(config.LOG_LEVEL, 'info');
    assert.equal(config.SQLITE_DB_PATH, './data/collector.sqlite');
    assert.equal(config.SESSION_DATA_PATH, './.session');
    assert.equal(config.WEBHOOK_URL, 'https://example.com/api/webhook');
    assert.equal(config.WEBHOOK_SECRET, 'super_secret_shared_key_12345');
    assert.equal(config.WEBHOOK_TIMEOUT_MS, 10000);
    assert.equal(config.WEBHOOK_MAX_RETRIES, 10);
    assert.equal(config.POLL_INTERVAL_MS, 1000);
    assert.equal(config.BATCH_SIZE, 20);
    assert.equal(config.ALLOWED_CHATS, undefined);
  });

  it('should parse custom overrides for optional settings', () => {
    const customEnv: Record<string, string> = {
      ...validBaseEnv,
      LOG_LEVEL: 'debug',
      SQLITE_DB_PATH: '/custom/path/db.sqlite',
      SESSION_DATA_PATH: '/custom/session',
      WEBHOOK_TIMEOUT_MS: '5000',
      WEBHOOK_MAX_RETRIES: '3',
      POLL_INTERVAL_MS: '500',
      BATCH_SIZE: '50',
      ALLOWED_CHATS: '12345@s.whatsapp.net, 67890-123@g.us'
    };

    const config = parseConfig(customEnv);
    assert.equal(config.LOG_LEVEL, 'debug');
    assert.equal(config.SQLITE_DB_PATH, '/custom/path/db.sqlite');
    assert.equal(config.SESSION_DATA_PATH, '/custom/session');
    assert.equal(config.WEBHOOK_TIMEOUT_MS, 5000);
    assert.equal(config.WEBHOOK_MAX_RETRIES, 3);
    assert.equal(config.POLL_INTERVAL_MS, 500);
    assert.equal(config.BATCH_SIZE, 50);
    assert.deepEqual(config.ALLOWED_CHATS, ['12345@s.whatsapp.net', '67890-123@g.us']);
  });

  it('should throw ConfigurationError when WEBHOOK_URL is missing', () => {
    const invalidEnv = { ...validBaseEnv };
    delete invalidEnv.WEBHOOK_URL;

    assert.throws(
      () => parseConfig(invalidEnv),
      (err: Error) => err instanceof ConfigurationError && err.message.includes('WEBHOOK_URL is required')
    );
  });

  it('should throw ConfigurationError when WEBHOOK_URL is malformed', () => {
    const invalidEnv = { ...validBaseEnv, WEBHOOK_URL: 'not-a-valid-url' };

    assert.throws(
      () => parseConfig(invalidEnv),
      (err: Error) => err instanceof ConfigurationError && err.message.includes('not a valid absolute URL')
    );
  });

  it('should throw ConfigurationError in production if WEBHOOK_URL is not HTTPS', () => {
    const prodHttpEnv = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      WEBHOOK_URL: 'http://insecure.example.com/webhook'
    };

    assert.throws(
      () => parseConfig(prodHttpEnv),
      (err: Error) => err instanceof ConfigurationError && err.message.includes('Production requires https://')
    );
  });

  it('should allow HTTP in development environment', () => {
    const devHttpEnv = {
      ...validBaseEnv,
      NODE_ENV: 'development',
      WEBHOOK_URL: 'http://localhost:3000/webhook'
    };

    const config = parseConfig(devHttpEnv);
    assert.equal(config.WEBHOOK_URL, 'http://localhost:3000/webhook');
  });

  it('should throw ConfigurationError when WEBHOOK_SECRET is missing', () => {
    const invalidEnv = { ...validBaseEnv };
    delete invalidEnv.WEBHOOK_SECRET;

    assert.throws(
      () => parseConfig(invalidEnv),
      (err: Error) => err instanceof ConfigurationError && err.message.includes('WEBHOOK_SECRET is required')
    );
  });

  it('should throw ConfigurationError when WEBHOOK_SECRET is shorter than 16 characters', () => {
    const invalidEnv = { ...validBaseEnv, WEBHOOK_SECRET: 'short_key_123' };

    assert.throws(
      () => parseConfig(invalidEnv),
      (err: Error) => err instanceof ConfigurationError && err.message.includes('at least 16 characters long')
    );
  });

  it('should throw ConfigurationError for non-positive integer values', () => {
    assert.throws(
      () => parseConfig({ ...validBaseEnv, BATCH_SIZE: '0' }),
      (err: Error) => err instanceof ConfigurationError && err.message.includes('BATCH_SIZE')
    );

    assert.throws(
      () => parseConfig({ ...validBaseEnv, WEBHOOK_TIMEOUT_MS: '-500' }),
      (err: Error) => err instanceof ConfigurationError && err.message.includes('WEBHOOK_TIMEOUT_MS')
    );

    assert.throws(
      () => parseConfig({ ...validBaseEnv, WEBHOOK_MAX_RETRIES: 'abc' }),
      (err: Error) => err instanceof ConfigurationError && err.message.includes('WEBHOOK_MAX_RETRIES')
    );
  });
});
