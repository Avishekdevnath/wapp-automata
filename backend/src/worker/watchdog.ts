import { IQueueRepository } from '../queue/interface';
import { rootLogger } from '../logging';

const logger = rootLogger.forModule('watchdog');

export interface WatchdogOptions {
  checkIntervalMs?: number;
  staleThresholdMs?: number;
  nowProvider?: () => number;
}

export class QueueWatchdog {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly checkIntervalMs: number;
  private readonly staleThresholdMs: number;
  private readonly getNow: () => number;

  constructor(
    private readonly queueRepo: IQueueRepository,
    options?: WatchdogOptions
  ) {
    this.checkIntervalMs = options?.checkIntervalMs ?? 60_000;
    this.staleThresholdMs = options?.staleThresholdMs ?? 60_000;
    this.getNow = options?.nowProvider ?? (() => Date.now());
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNext();
    logger.info('Queue watchdog started', {
      checkIntervalMs: this.checkIntervalMs,
      staleThresholdMs: this.staleThresholdMs
    });
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('Queue watchdog stopped');
  }

  public check(nowMs?: number): number {
    const currentNow = nowMs ?? this.getNow();
    const recovered = this.queueRepo.recoverStaleProcessing(this.staleThresholdMs, currentNow);

    if (recovered > 0) {
      logger.warn('Watchdog recovered stale in-flight messages', {
        recoveredCount: recovered,
        staleThresholdMs: this.staleThresholdMs,
        resetTo: 'pending'
      });
    }

    return recovered;
  }

  private scheduleNext(): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(() => {
      try {
        this.check();
      } catch (err) {
        logger.error('Error during watchdog check execution', { error: err });
      } finally {
        this.scheduleNext();
      }
    }, this.checkIntervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public get active(): boolean {
    return this.isRunning;
  }
}
