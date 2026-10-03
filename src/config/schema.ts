/**
 * Application Configuration Schema & Validation
 */

export type NodeEnv = 'development' | 'production' | 'test';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  NODE_ENV: NodeEnv;
  LOG_LEVEL: LogLevel;
  SQLITE_DB_PATH: string;
  SESSION_DATA_PATH: string;
  WEBHOOK_URL: string;
  WEBHOOK_SECRET: string;
  WEBHOOK_TIMEOUT_MS: number;
  WEBHOOK_MAX_RETRIES: number;
  POLL_INTERVAL_MS: number;
  BATCH_SIZE: number;
  ALLOWED_CHATS?: string[];
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Validates and converts raw environment variables into typed AppConfig.
 * Throws ConfigurationError if any required setting is invalid or missing.
 */
export function parseConfig(env: Record<string, string | undefined>): AppConfig {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase() as NodeEnv;
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new ConfigurationError(`Invalid NODE_ENV "${env.NODE_ENV}". Must be 'development', 'production', or 'test'.`);
  }

  const logLevel = (env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    throw new ConfigurationError(`Invalid LOG_LEVEL "${env.LOG_LEVEL}". Must be 'debug', 'info', 'warn', or 'error'.`);
  }

  const webhookUrl = env.WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new ConfigurationError('WEBHOOK_URL is required but was not provided in environment.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    throw new ConfigurationError(`Invalid WEBHOOK_URL: "${webhookUrl}" is not a valid absolute URL.`);
  }

  if (nodeEnv === 'production' && parsedUrl.protocol !== 'https:') {
    throw new ConfigurationError(`Insecure WEBHOOK_URL: Production requires https://, got "${parsedUrl.protocol}".`);
  }

  const webhookSecret = env.WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new ConfigurationError('WEBHOOK_SECRET is required but was not provided in environment.');
  }
  if (webhookSecret.length < 16) {
    throw new ConfigurationError(`WEBHOOK_SECRET must be at least 16 characters long for security, got ${webhookSecret.length}.`);
  }

  const parsePositiveInt = (value: string | undefined, defaultVal: number, varName: string): number => {
    if (value === undefined || value.trim() === '') return defaultVal;
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
      throw new ConfigurationError(`Invalid ${varName}: Must be a positive integer, got "${value}".`);
    }
    return num;
  };

  const parseNonNegativeInt = (value: string | undefined, defaultVal: number, varName: string): number => {
    if (value === undefined || value.trim() === '') return defaultVal;
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0) {
      throw new ConfigurationError(`Invalid ${varName}: Must be a non-negative integer, got "${value}".`);
    }
    return num;
  };

  const webhookTimeoutMs = parsePositiveInt(env.WEBHOOK_TIMEOUT_MS, 10000, 'WEBHOOK_TIMEOUT_MS');
  const webhookMaxRetries = parseNonNegativeInt(env.WEBHOOK_MAX_RETRIES, 10, 'WEBHOOK_MAX_RETRIES');
  const pollIntervalMs = parsePositiveInt(env.POLL_INTERVAL_MS, 1000, 'POLL_INTERVAL_MS');
  const batchSize = parsePositiveInt(env.BATCH_SIZE, 20, 'BATCH_SIZE');

  let allowedChats: string[] | undefined;
  if (env.ALLOWED_CHATS && env.ALLOWED_CHATS.trim() !== '') {
    allowedChats = env.ALLOWED_CHATS.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
  }

  return {
    NODE_ENV: nodeEnv,
    LOG_LEVEL: logLevel,
    SQLITE_DB_PATH: env.SQLITE_DB_PATH?.trim() || './data/collector.sqlite',
    SESSION_DATA_PATH: env.SESSION_DATA_PATH?.trim() || './.session',
    WEBHOOK_URL: webhookUrl,
    WEBHOOK_SECRET: webhookSecret,
    WEBHOOK_TIMEOUT_MS: webhookTimeoutMs,
    WEBHOOK_MAX_RETRIES: webhookMaxRetries,
    POLL_INTERVAL_MS: pollIntervalMs,
    BATCH_SIZE: batchSize,
    ALLOWED_CHATS: allowedChats
  };
}
