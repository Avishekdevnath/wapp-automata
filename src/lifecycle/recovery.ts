import { IQueueRepository } from '../queue/interface';
import { rootLogger } from '../logging';

const logger = rootLogger.forModule('recovery');

export interface RecoveryOptions {
  nowMs?: number;
}

/**
 * Recovers stranded in-flight records on application bootstrap.
 * Resets any records left in 'delivering' status (from an ungraceful crash or kill -9)
 * back to 'pending' so they can be processed by the worker.
 */
export function recoverStartupState(
  queueRepo: IQueueRepository,
  options?: RecoveryOptions
): number {
  const nowMs = options?.nowMs ?? Date.now();
  const recoveredCount = queueRepo.recoverStaleProcessing(0, nowMs);

  if (recoveredCount > 0) {
    logger.warn('Recovered stranded in-flight messages from prior ungraceful shutdown', {
      recoveredCount,
      resetTo: 'pending'
    });
  } else {
    logger.info('Startup recovery check complete: zero stranded messages detected');
  }

  return recoveredCount;
}
