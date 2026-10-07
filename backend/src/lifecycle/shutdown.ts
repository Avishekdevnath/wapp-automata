import type Database from 'better-sqlite3';
import { IWhatsAppAdapter } from '../adapter/interface';
import { IQueueWorker } from '../worker/interface';
import { QueueWatchdog } from '../worker/watchdog';
import { rootLogger } from '../logging';

const logger = rootLogger.forModule('shutdown');

export interface ShutdownComponents {
  adapter?: IWhatsAppAdapter | null;
  worker?: IQueueWorker | null;
  watchdog?: QueueWatchdog | null;
  db?: Database.Database | null;
}

export interface ShutdownOptions {
  timeoutMs?: number;
  exitProcess?: boolean;
}

export class GracefulShutdownManager {
  private isShuttingDown: boolean = false;
  private signalHandlers: Array<{ signal: NodeJS.Signals; handler: () => void }> = [];

  constructor(
    private readonly components: ShutdownComponents,
    private readonly options?: ShutdownOptions
  ) {}

  public registerSignalHandlers(signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']): void {
    for (const signal of signals) {
      const handler = () => {
        logger.info(`Received signal ${signal}; initiating graceful shutdown`);
        this.shutdown(signal).catch((err) => {
          logger.error('Unhandled failure during graceful shutdown', { error: err });
          if (this.options?.exitProcess !== false) {
            process.exit(1);
          }
        });
      };
      process.on(signal, handler);
      this.signalHandlers.push({ signal, handler });
    }
  }

  public removeSignalHandlers(): void {
    for (const { signal, handler } of this.signalHandlers) {
      process.off(signal, handler);
    }
    this.signalHandlers = [];
  }

  public async shutdown(reason: string = 'manual'): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress; ignoring duplicate request', { reason });
      return;
    }
    this.isShuttingDown = true;
    logger.info('Graceful shutdown started', { reason });

    const timeoutMs = this.options?.timeoutMs ?? 10_000;
    const shutdownPromise = this.performShutdown();

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Graceful shutdown timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      if (timer.unref) timer.unref();
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      logger.info('Graceful shutdown completed cleanly');
    } catch (err) {
      logger.error('Graceful shutdown error or timeout', { error: err });
      throw err;
    } finally {
      this.removeSignalHandlers();
      if (this.options?.exitProcess) {
        process.exit(0);
      }
    }
  }

  private async performShutdown(): Promise<void> {
    // 1. Stop WhatsApp ingestion
    if (this.components.adapter) {
      try {
        logger.info('Stopping WhatsApp adapter...');
        await this.components.adapter.stop();
      } catch (err) {
        logger.warn('Error stopping WhatsApp adapter', { error: err });
      }
    }

    // 2. Stop queue watchdog
    if (this.components.watchdog) {
      try {
        logger.info('Stopping queue watchdog...');
        this.components.watchdog.stop();
      } catch (err) {
        logger.warn('Error stopping watchdog', { error: err });
      }
    }

    // 3. Stop queue worker (waits for active tick to complete)
    if (this.components.worker) {
      try {
        logger.info('Stopping queue worker...');
        await this.components.worker.stop();
      } catch (err) {
        logger.warn('Error stopping worker', { error: err });
      }
    }

    // 4. Checkpoint WAL and close SQLite database
    if (this.components.db && this.components.db.open) {
      try {
        logger.info('Checkpointing SQLite WAL...');
        this.components.db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (err) {
        logger.warn('Error running WAL checkpoint', { error: err });
      }

      try {
        logger.info('Closing database connection...');
        this.components.db.close();
      } catch (err) {
        logger.warn('Error closing database', { error: err });
      }
    }
  }

  public get inProgress(): boolean {
    return this.isShuttingDown;
  }
}
