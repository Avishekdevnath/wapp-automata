import { WebhookDeliveryResult } from './interface';

export type DeliveryDisposition =
  | 'success'
  | 'retry_transient'
  | 'retry_auth'
  | 'fail_permanent';

export interface ClassificationDetails {
  disposition: DeliveryDisposition;
  reason: string;
}

/**
 * Classifies a webhook delivery result according to the formal HTTP response contract.
 */
export function classifyDeliveryResult(
  result: WebhookDeliveryResult,
  currentAttempt: number,
  maxRetries: number = 10
): ClassificationDetails {
  // 1. Success (HTTP 2xx)
  if (result.success || (result.statusCode !== undefined && result.statusCode >= 200 && result.statusCode < 300)) {
    return {
      disposition: 'success',
      reason: `HTTP ${result.statusCode ?? 200} OK`
    };
  }

  // 2. Max Retries Exceeded -> Terminal Failure
  if (currentAttempt >= maxRetries) {
    return {
      disposition: 'fail_permanent',
      reason: `Exceeded maximum retry attempts (${currentAttempt}/${maxRetries}). Last status: ${result.statusCode ?? 'NETWORK_ERROR'}`
    };
  }

  const status = result.statusCode;

  // 3. Network or Timeout Failure -> Transient Retry
  if (status === undefined) {
    return {
      disposition: 'retry_transient',
      reason: result.errorMessage || 'Network transport failure or timeout'
    };
  }

  // 4. Client Validation Errors (HTTP 400, 422) -> Terminal Failure
  if (status === 400 || status === 422) {
    return {
      disposition: 'fail_permanent',
      reason: `Non-retryable client validation error (HTTP ${status}): ${result.responseBody || 'Bad Request'}`
    };
  }

  // 5. Authentication Errors (HTTP 401, 403) -> Slow Auth Retry
  if (status === 401 || status === 403) {
    return {
      disposition: 'retry_auth',
      reason: `Authentication failure (HTTP ${status}); scheduling slow backoff retry to tolerate secret rotation.`
    };
  }

  // 6. Not Found (HTTP 404) -> Fail after 3 attempts
  if (status === 404) {
    if (currentAttempt >= 3) {
      return {
        disposition: 'fail_permanent',
        reason: 'Webhook endpoint returned HTTP 404 Not Found after 3 attempts.'
      };
    }
    return {
      disposition: 'retry_transient',
      reason: `HTTP 404 Not Found (attempt ${currentAttempt}/3)`
    };
  }

  // 7. Rate Limiting / Timeout (HTTP 408, 429) -> Transient Retry
  if (status === 408 || status === 429) {
    return {
      disposition: 'retry_transient',
      reason: `Rate limited or request timeout (HTTP ${status})`
    };
  }

  // 8. Server Errors (HTTP 5xx) -> Transient Retry
  if (status >= 500 && status < 600) {
    return {
      disposition: 'retry_transient',
      reason: `Transient server error (HTTP ${status})`
    };
  }

  // 9. Other 4xx Client Errors (405, 413, etc.) -> Terminal Failure
  if (status >= 400 && status < 500) {
    return {
      disposition: 'fail_permanent',
      reason: `Terminal client error (HTTP ${status})`
    };
  }

  // Fallback for unexpected status codes
  return {
    disposition: 'retry_transient',
    reason: `Unexpected status code: HTTP ${status}`
  };
}
