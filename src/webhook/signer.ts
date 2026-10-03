import crypto from 'node:crypto';

export interface SignatureHeaderBundle {
  signature: string;
  timestamp: string;
}

/**
 * Computes an HMAC SHA-256 signature over a UTF-8 string payload.
 * Returns in format 'sha256=<hex_digest>'.
 */
export function computeHmacSignature(payload: string, secret: string): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  return `sha256=${digest}`;
}

/**
 * Verifies an HMAC SHA-256 signature using timing-safe buffer comparison.
 */
export function verifyHmacSignature(payload: string, secret: string, headerSignature: string): boolean {
  if (!headerSignature || !headerSignature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = computeHmacSignature(payload, secret);
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const actualBuffer = Buffer.from(headerSignature, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Verifies that a request timestamp is within the allowable clock drift window (default: 5 minutes).
 */
export function isTimestampValid(
  timestampMs: number,
  nowMs: number = Date.now(),
  maxDriftMs: number = 300000
): boolean {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return false;
  }
  return Math.abs(nowMs - timestampMs) <= maxDriftMs;
}
