import { QueueDepth } from '../queue/interface';

export interface MemorySnapshot {
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
}

export interface MetricCounters {
  ingested: number;
  delivered: number;
  retried: number;
  failed: number;
}

export interface HealthSnapshot {
  timestamp: string;
  uptimeSeconds: number;
  counters: MetricCounters;
  queue: QueueDepth | null;
  memory: MemorySnapshot;
}

export class CollectorMetrics {
  private ingestedCount: number = 0;
  private deliveredCount: number = 0;
  private retriedCount: number = 0;
  private failedCount: number = 0;
  private readonly startedAt: number;

  constructor(startedAt: number = Date.now()) {
    this.startedAt = startedAt;
  }

  public incrementIngested(amount: number = 1): void {
    this.ingestedCount += amount;
  }

  public incrementDelivered(amount: number = 1): void {
    this.deliveredCount += amount;
  }

  public incrementRetried(amount: number = 1): void {
    this.retriedCount += amount;
  }

  public incrementFailed(amount: number = 1): void {
    this.failedCount += amount;
  }

  public getCounters(): MetricCounters {
    return {
      ingested: this.ingestedCount,
      delivered: this.deliveredCount,
      retried: this.retriedCount,
      failed: this.failedCount
    };
  }

  public getMemoryUsage(): MemorySnapshot {
    const memory = process.memoryUsage();
    return {
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
      externalMb: Math.round((memory.external / (1024 * 1024)) * 100) / 100
    };
  }

  public getSnapshot(queueDepth: QueueDepth | null = null, nowMs: number = Date.now()): HealthSnapshot {
    return {
      timestamp: new Date(nowMs).toISOString(),
      uptimeSeconds: Math.floor((nowMs - this.startedAt) / 1000),
      counters: this.getCounters(),
      queue: queueDepth,
      memory: this.getMemoryUsage()
    };
  }
}
