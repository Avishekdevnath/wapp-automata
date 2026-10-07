import { loadDotEnv } from './env-loader';
import { AppConfig, parseConfig } from './schema';

export * from './schema';

let cachedConfig: AppConfig | null = null;

/**
 * Loads, validates, and freezes the singleton application configuration.
 * Fails fast by throwing ConfigurationError if validation fails.
 */
export function getConfig(overrideEnv?: Record<string, string | undefined>): AppConfig {
  if (overrideEnv) {
    return parseConfig(overrideEnv);
  }

  if (cachedConfig) {
    return cachedConfig;
  }

  // Load .env file into process.env if present
  loadDotEnv();

  // Parse and freeze
  const parsed = parseConfig(process.env);
  cachedConfig = Object.freeze(parsed);
  return cachedConfig;
}

/**
 * Reset cached configuration (primarily for unit tests).
 */
export function resetConfig(): void {
  cachedConfig = null;
}
