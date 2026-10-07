import { IQueueRepository, QueueRecord } from '../queue/interface';
import { IWebhookClient } from '../webhook/interface';
import { classifyDeliveryResult } from '../webhook/classifier';
import { calculateBackoffMs, calculateAuthBackoffMs, BackoffOptions } from './backoff';
import { rootLogger } from '../logging';

const logger = rootLogger.forModule('dispatcher');

export interface DispatcherOptions {
  maxRetries?: number;
  backoffOptions?: BackoffOptions;
  nowProvider?: () => number;
  onDelivered?: (record: QueueRecord) => void;
  onRetried?: (record: QueueRecord) => void;
  onFailed?: (record: QueueRecord) => void;
}

/**
 * Creates a delivery handler function that integrates the WebhookClient,
 * classification rules, and queue state transitions.
 */
export function createDeliveryHandler(
  queueRepo: IQueueRepository,
  webhookClient: IWebhookClient,
  options?: DispatcherOptions
): (record: QueueRecord) => Promise<void> {
  const maxRetries = options?.maxRetries ?? 10;
  const backoffOptions = options?.backoffOptions;
  const getNow = options?.nowProvider ?? (() => Date.now());

  return async (record: QueueRecord): Promise<void> => {
    const attempt = record.retry_count + 1;
    const nowMs = getNow();

    const deliveryResult = await webhookClient.deliver(record, attempt);
    const classification = classifyDeliveryResult(deliveryResult, attempt, maxRetries);

    switch (classification.disposition) {
      case 'success':
        queueRepo.markDelivered(record.id, nowMs);
        options?.onDelivered?.(record);
        logger.info('Message successfully delivered to webhook', {
          messageId: record.id,
          deliveryId: deliveryResult.deliveryId,
          attempt
        });
        break;

      case 'retry_transient': {
        const delayMs = calculateBackoffMs(record.retry_count, backoffOptions);
        const nextRetryAt = nowMs + delayMs;
        queueRepo.markRetry(
          record.id,
          nextRetryAt,
          deliveryResult.statusCode ?? null,
          classification.reason,
          nowMs
        );
        options?.onRetried?.(record);
        logger.warn('Transient webhook failure; scheduled retry', {
          messageId: record.id,
          deliveryId: deliveryResult.deliveryId,
          attempt,
          nextRetryAt,
          delaySeconds: Math.round(delayMs / 1000),
          reason: classification.reason
        });
        break;
      }

      case 'retry_auth': {
        const delayMs = calculateAuthBackoffMs();
        const nextRetryAt = nowMs + delayMs;
        queueRepo.markRetry(
          record.id,
          nextRetryAt,
          deliveryResult.statusCode ?? null,
          classification.reason,
          nowMs
        );
        options?.onRetried?.(record);
        logger.error('Authentication failure from webhook; scheduled slow retry', {
          messageId: record.id,
          deliveryId: deliveryResult.deliveryId,
          attempt,
          nextRetryAt,
          reason: classification.reason
        });
        break;
      }

      case 'fail_permanent':
        queueRepo.markFailed(
          record.id,
          deliveryResult.statusCode ?? null,
          classification.reason,
          nowMs
        );
        options?.onFailed?.(record);
        logger.error('Terminal delivery failure; message marked failed', {
          messageId: record.id,
          deliveryId: deliveryResult.deliveryId,
          attempt,
          reason: classification.reason
        });
        break;
    }
  };
}
