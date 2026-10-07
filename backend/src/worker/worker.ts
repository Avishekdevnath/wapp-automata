import { IQueueRepository } from '../queue/interface';
import { WorkerDeliveryHandler, WorkerOptions, IQueueWorker } from './interface';
import { rootLogger } from '../logging';

const logger = rootLogger.forModule('worker');

/**
 * Background Queue Worker Engine.
 * Periodically polls SQLite for eligible pending records and dispatches them sequentially.
 * Uses recursive setTimeout to guarantee no overlapping polling executions.
 */
export class QueueWorker implements IQueueWorker {
  private queueRepo: IQueueRepository;
  private deliveryHandler: WorkerDeliveryHandler;
  private pollIntervalMs: number;
  private batchSize: number;

  private running: boolean = false;
  private busy: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    queueRepo: IQueueRepository,
    deliveryHandler: WorkerDeliveryHandler,
    options?: WorkerOptions
  ) {
    this.queueRepo = queueRepo;
    this.deliveryHandler = deliveryHandler;
    this.pollIntervalMs = options?.pollIntervalMs ?? 1000;
    this.batchSize = options?.batchSize ?? 20;
  }

  /**
   * Starts the background polling loop.
   */
  public start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    logger.info('Queue worker started', {
      pollIntervalMs: this.pollIntervalMs,
      batchSize: this.batchSize
    });

    this.scheduleNextTick(0);
  }

  /**
   * Stops the background polling loop cleanly.
   */
  public async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    logger.info('Queue worker stopping; waiting for active tick to complete...');

    // Await active tick completion
    while (this.busy) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    logger.info('Queue worker stopped.');
  }

  public isRunning(): boolean {
    return this.running;
  }

  public isBusy(): boolean {
    return this.busy;
  }

  /**
   * Executes a single processing tick.
   * Can be invoked directly in unit/integration tests.
   * Returns the number of items claimed and processed.
   */
  public async tick(nowMs: number = Date.now()): Promise<number> {
    if (this.busy) {
      return 0; // Prevent overlapping runs
    }

    this.busy = true;

    try {
      // 1. Fetch eligible records: status = 'pending' AND next_retry_at <= nowMs
      const pendingRecords = this.queueRepo.fetchPending(this.batchSize, nowMs);
      if (pendingRecords.length === 0) {
        return 0;
      }

      const ids = pendingRecords.map(r => r.id);

      // 2. Atomically claim batch: status = 'pending' -> 'delivering'
      const claimedCount = this.queueRepo.markDelivering(ids, nowMs);
      if (claimedCount === 0) {
        return 0; // Another process or thread claimed them
      }

      // 3. Process claimed records
      for (const record of pendingRecords) {
        try {
          await this.deliveryHandler(record);
        } catch (error) {
          logger.error('Unhandled error during worker delivery handler', {
            messageId: record.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return claimedCount;
    } finally {
      this.busy = false;
    }
  }

  private scheduleNextTick(delayMs: number): void {
    if (!this.running) {
      return;
    }

    this.timer = setTimeout(async () => {
      let processedCount = 0;
      try {
        processedCount = await this.tick();
      } catch (err) {
        logger.error('Error during worker tick execution', {
          error: err instanceof Error ? err.message : String(err)
        });
      }

      // If items were processed, immediately poll for remaining queue items;
      // otherwise, sleep for pollIntervalMs.
      const nextDelay = processedCount > 0 ? 0 : this.pollIntervalMs;
      this.scheduleNextTick(nextDelay);
    }, delayMs);
  }
}
