/**
 * Exponential Backoff with Randomized Jitter
 */

export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxJitterMs?: number;
}

const DEFAULT_BASE_DELAY_MS = 2000;    // 2 seconds
const DEFAULT_MAX_DELAY_MS = 900000;   // 15 minutes (900 seconds)
const DEFAULT_MAX_JITTER_MS = 1000;    // 1 second

/**
 * Calculates exponential backoff delay in milliseconds with randomized jitter.
 * Formula: min(maxDelay, baseDelay * 2^attempt) + randomJitter(0, maxJitter)
 */
export function calculateBackoffMs(attempt: number, options?: BackoffOptions): number {
  const baseDelay = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelay = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const maxJitter = options?.maxJitterMs ?? DEFAULT_MAX_JITTER_MS;

  const boundedAttempt = Math.max(0, Math.min(attempt, 30)); // Avoid integer overflow on 2^n
  const exponential = baseDelay * Math.pow(2, boundedAttempt);
  const cappedDelay = Math.min(maxDelay, exponential);

  const jitter = maxJitter > 0 ? Math.floor(Math.random() * (maxJitter + 1)) : 0;
  return cappedDelay + jitter;
}

/**
 * Returns fixed slow backoff for auth issues (default: 5 minutes + jitter).
 */
export function calculateAuthBackoffMs(options?: { authDelayMs?: number; maxJitterMs?: number }): number {
  const authDelay = options?.authDelayMs ?? 300000; // 5 minutes
  const maxJitter = options?.maxJitterMs ?? DEFAULT_MAX_JITTER_MS;
  const jitter = maxJitter > 0 ? Math.floor(Math.random() * (maxJitter + 1)) : 0;
  return authDelay + jitter;
}
