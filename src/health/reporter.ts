import { IQueueRepository } from '../queue/interface';
import { CollectorMetrics, HealthSnapshot } from './metrics';
import { rootLogger } from '../logging';

const logger = rootLogger.forModule('health');

export interface HeartbeatOptions {
  intervalMs?: number; // default: 60_000ms
  memoryWarningThresholdMb?: number; // default: 200MB
  nowProvider?: () => number;
}

export class HeartbeatReporter {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly intervalMs: number;
  private readonly memoryWarningThresholdMb: number;
  private readonly getNow: () => number;

  constructor(
    private readonly metrics: CollectorMetrics,
    private readonly queueRepo?: IQueueRepository,
    options?: HeartbeatOptions
  ) {
    this.intervalMs = options?.intervalMs ?? 60_000;
    this.memoryWarningThresholdMb = options?.memoryWarningThresholdMb ?? 200;
    this.getNow = options?.nowProvider ?? (() => Date.now());
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNext();
    logger.info('Heartbeat reporter started', {
      intervalMs: this.intervalMs,
      memoryWarningThresholdMb: this.memoryWarningThresholdMb
    });
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('Heartbeat reporter stopped');
  }

  public emitHeartbeat(nowMs?: number): HealthSnapshot {
    const currentNow = nowMs ?? this.getNow();
    const queueDepth = this.queueRepo ? this.queueRepo.getQueueDepth() : null;
    const snapshot = this.metrics.getSnapshot(queueDepth, currentNow);

    if (snapshot.memory.rssMb > this.memoryWarningThresholdMb) {
      logger.warn('Process RSS memory usage exceeded warning threshold', {
        rssMb: snapshot.memory.rssMb,
        thresholdMb: this.memoryWarningThresholdMb,
        heapUsedMb: snapshot.memory.heapUsedMb
      });
    }

    logger.info('Heartbeat status report', {
      uptimeSeconds: snapshot.uptimeSeconds,
      counters: snapshot.counters,
      queue: snapshot.queue,
      memory: snapshot.memory
    });

    return snapshot;
  }

  private scheduleNext(): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(() => {
      try {
        this.emitHeartbeat();
      } catch (err) {
        logger.error('Error emitting heartbeat report', { error: err });
      } finally {
        this.scheduleNext();
      }
    }, this.intervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public get active(): boolean {
    return this.isRunning;
  }
}
