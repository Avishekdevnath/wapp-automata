import { QueueRecord } from '../queue/interface';

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  errorMessage?: string;
  deliveryId: string;
}

export interface IWebhookClient {
  /**
   * Dispatches an HTTP(S) POST request to the configured webhook endpoint.
   * Signs payload with HMAC SHA-256 and attaches operational headers.
   */
  deliver(record: QueueRecord, attempt?: number): Promise<WebhookDeliveryResult>;
}

export interface WebhookClientOptions {
  url: string;
  secret?: string;
  timeoutMs?: number;
  userAgent?: string;
}
