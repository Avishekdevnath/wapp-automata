import crypto from 'node:crypto';
import { QueueRecord } from '../queue/interface';
import { IWebhookClient, WebhookClientOptions, WebhookDeliveryResult } from './interface';
import { computeHmacSignature } from './signer';
import { rootLogger } from '../logging';

const logger = rootLogger.forModule('webhook-client');

/**
 * Dispatches normalized messages to client HTTPS webhook endpoints.
 * Applies HMAC SHA-256 signatures, replay timestamp headers, and timeout protection.
 */
export class WebhookClient implements IWebhookClient {
  private url: string;
  private secret: string;
  private timeoutMs: number;
  private userAgent: string;

  constructor(options: WebhookClientOptions) {
    this.url = options.url;
    this.secret = options.secret;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.userAgent = options.userAgent ?? 'WhatsApp-Raw-Collector/1.0.0';
  }

  public async deliver(record: QueueRecord, attempt: number = record.retry_count + 1): Promise<WebhookDeliveryResult> {
    const deliveryId = `del_${crypto.randomUUID().replace(/-/g, '')}`;
    const dispatchTimeMs = Date.now();

    // Construct the canonical webhook event payload
    let rawPayloadObj: Record<string, unknown> = {};
    try {
      rawPayloadObj = JSON.parse(record.raw_payload);
    } catch {
      rawPayloadObj = { raw: record.raw_payload };
    }

    let mediaObj: Record<string, unknown> | null = null;
    if (record.has_media === 1) {
      if (record.media_metadata) {
        try {
          mediaObj = JSON.parse(record.media_metadata);
        } catch {
          mediaObj = { type: record.media_type || 'document', mimetype: null, file_name: null, file_size: null };
        }
      } else {
        mediaObj = { type: record.media_type || 'document', mimetype: null, file_name: null, file_size: null };
      }
    }

    // Extract sender name from raw payload if available
    const senderName = typeof rawPayloadObj.pushName === 'string' ? rawPayloadObj.pushName : null;

    const payload = {
      event: 'whatsapp.message.received',
      version: '1.0',
      delivery_id: deliveryId,
      attempt,
      occurred_at: new Date(record.message_timestamp * 1000).toISOString(),
      received_at: new Date(record.created_at).toISOString(),
      dispatched_at: new Date(dispatchTimeMs).toISOString(),
      message: {
        message_id: record.id,
        chat_id: record.chat_id,
        chat_name: record.source_name ?? null,
        chat_type: record.chat_type,
        sender_id: record.sender_id,
        sender_name: senderName,
        text: record.message_text,
        has_media: record.has_media === 1,
        media: mediaObj,
        reply_to: null,
        raw_payload: rawPayloadObj
      }
    };

    const bodyString = JSON.stringify(payload);
    const signature = computeHmacSignature(bodyString, this.secret);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': this.userAgent,
      'X-Collector-Signature': signature,
      'X-Collector-Timestamp': String(dispatchTimeMs),
      'X-Collector-Delivery-Id': deliveryId,
      'X-Collector-Event': 'whatsapp.message.received',
      'X-Collector-Version': '1.0'
    };

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      logger.debug('Dispatching webhook POST', {
        url: this.url,
        messageId: record.id,
        deliveryId,
        attempt
      });

      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: bodyString,
        signal: abortController.signal
      });

      clearTimeout(timeoutHandle);

      let responseText = '';
      try {
        responseText = await response.text();
      } catch {
        responseText = '';
      }

      const isSuccess = response.status >= 200 && response.status < 300;

      return {
        success: isSuccess,
        statusCode: response.status,
        responseBody: responseText.slice(0, 1000), // Bounded error capture
        deliveryId
      };
    } catch (error: unknown) {
      clearTimeout(timeoutHandle);

      let errorMessage = 'Unknown network error';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = `Webhook request timed out after ${this.timeoutMs}ms`;
        } else {
          errorMessage = error.message;
        }
      }

      logger.warn('Webhook delivery request failed', {
        messageId: record.id,
        deliveryId,
        error: errorMessage
      });

      return {
        success: false,
        errorMessage,
        deliveryId
      };
    }
  }
}
