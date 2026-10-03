/**
 * Structured JSON Logger with Sensitive Data Redaction
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const SENSITIVE_KEY_REGEX = /secret|token|creds|password|authorization|private_key|api_key/i;

/**
 * Recursively scans an object/array and masks sensitive values with "[REDACTED]".
 */
export function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack
    };
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactSensitiveData(value);
    } else if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  context?: unknown;
}

export class Logger {
  private level: LogLevel;
  private moduleName: string;

  constructor(moduleName: string, level: LogLevel = 'info') {
    this.moduleName = moduleName;
    this.level = level;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public forModule(subModule: string): Logger {
    return new Logger(`${this.moduleName}:${subModule}`, this.level);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private emit(level: LogLevel, message: string, context?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      module: this.moduleName,
      message
    };

    if (context !== undefined) {
      entry.context = redactSensitiveData(context);
    }

    const serialized = JSON.stringify(entry);

    if (level === 'warn' || level === 'error') {
      process.stderr.write(serialized + '\n');
    } else {
      process.stdout.write(serialized + '\n');
    }
  }

  public debug(message: string, context?: unknown): void {
    this.emit('debug', message, context);
  }

  public info(message: string, context?: unknown): void {
    this.emit('info', message, context);
  }

  public warn(message: string, context?: unknown): void {
    this.emit('warn', message, context);
  }

  public error(message: string, context?: unknown): void {
    this.emit('error', message, context);
  }
}

/** Root application logger singleton */
export const rootLogger = new Logger('wapp-automata');
