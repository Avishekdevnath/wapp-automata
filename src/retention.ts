import { IQueueRepository } from './queue';
import { rootLogger } from './logging';

const logger = rootLogger.forModule('retention');

/**
 * Runs an atomic retention pruning pass for delivered messages older than configured threshold.
 */
export function runRetentionCleanup(queueRepo: IQueueRepository, days: number = 30): void {
  try {
    // Lifetime Raw Text Storage (ADR-013): prune bulky payloads, but never delete message rows
    const res = queueRepo.pruneOldPayloads(days, Date.now(), false);
    if (res.prunedCount > 0 || res.deletedCount > 0) {
      logger.info('Automated SQLite log retention cleanup completed', res);
    }
  } catch (err) {
    logger.warn('Automated SQLite log retention warning', { error: err });
  }
}

/**
 * Schedules periodic background cleanup to keep SQLite database lean.
 */
export function scheduleLogRetention(
  queueRepo: IQueueRepository,
  days: number = 30,
  intervalMs: number = 24 * 60 * 60 * 1000
): NodeJS.Timeout {
  runRetentionCleanup(queueRepo, days);
  const timer = setInterval(() => {
    runRetentionCleanup(queueRepo, days);
  }, intervalMs);
  timer.unref();
  return timer;
}
