import type Database from 'better-sqlite3';
import { getConfig, AppConfig } from './config';
import { rootLogger } from './logging';
import { createDatabaseConnection, runMigrations } from './persistence';
import { SQLiteQueueRepository, IQueueRepository } from './queue';
import { normalizeMessage } from './normalizer';
import { WebhookClient } from './webhook';
import { QueueWorker, createDeliveryHandler, QueueWatchdog, IQueueWorker } from './worker';
import { recoverStartupState, GracefulShutdownManager } from './lifecycle';
import { CollectorMetrics, HeartbeatReporter } from './health';
import { IWhatsAppAdapter } from './adapter/interface';
import { BaileysAdapter } from './adapter/baileys';

export const SERVICE_NAME = 'wapp-automata';
export const SERVICE_VERSION = '0.1.0';

const logger = rootLogger.forModule('bootstrap');

export function getServiceInfo(): { name: string; version: string; status: string } {
  return {
    name: SERVICE_NAME,
    version: SERVICE_VERSION,
    status: 'initialized'
  };
}

export interface ApplicationOptions {
  config?: AppConfig;
  adapter?: IWhatsAppAdapter;
  db?: Database.Database;
}

export interface ApplicationContext {
  config: AppConfig;
  db: Database.Database;
  queueRepo: IQueueRepository;
  metrics: CollectorMetrics;
  worker: IQueueWorker;
  watchdog: QueueWatchdog;
  heartbeat: HeartbeatReporter;
  adapter?: IWhatsAppAdapter;
  shutdownManager: GracefulShutdownManager;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createApplication(options?: ApplicationOptions): ApplicationContext {
  const config = options?.config ?? getConfig();
  const db = options?.db ?? createDatabaseConnection({ dbPath: config.SQLITE_DB_PATH });
  runMigrations(db);

  const queueRepo = new SQLiteQueueRepository(db);
  const metrics = new CollectorMetrics();

  const webhookClient = new WebhookClient({
    url: config.WEBHOOK_URL,
    secret: config.WEBHOOK_SECRET,
    timeoutMs: config.WEBHOOK_TIMEOUT_MS
  });

  const deliveryHandler = createDeliveryHandler(queueRepo, webhookClient, {
    maxRetries: config.WEBHOOK_MAX_RETRIES,
    onDelivered: () => metrics.incrementDelivered(),
    onRetried: () => metrics.incrementRetried(),
    onFailed: () => metrics.incrementFailed()
  });

  const worker = new QueueWorker(queueRepo, deliveryHandler, {
    pollIntervalMs: config.POLL_INTERVAL_MS,
    batchSize: config.BATCH_SIZE
  });

  const watchdog = new QueueWatchdog(queueRepo, {
    checkIntervalMs: 60_000,
    staleThresholdMs: 60_000
  });

  const heartbeat = new HeartbeatReporter(metrics, queueRepo, {
    intervalMs: 60_000,
    memoryWarningThresholdMb: 200
  });

  const adapter = options?.adapter ?? (config.NODE_ENV !== 'test' ? new BaileysAdapter({ sessionPath: config.SESSION_DATA_PATH }) : undefined);

  if (adapter) {
    adapter.onMessage(async (rawEvent: unknown) => {
      try {
        const envelope = normalizeMessage(rawEvent);
        if (!envelope) {
          logger.debug('Skipping message: normalizer returned null');
          return;
        }

        if (config.ALLOWED_CHATS && config.ALLOWED_CHATS.length > 0) {
          if (!config.ALLOWED_CHATS.includes(envelope.chatId)) {
            logger.debug('Skipping message from unallowed chat', { chatId: envelope.chatId });
            return;
          }
        }

        const inserted = queueRepo.enqueue(envelope);
        if (inserted) {
          metrics.incrementIngested();
        }
      } catch (err) {
        logger.error('Error handling incoming WhatsApp raw event', { error: err });
      }
    });
  }

  const shutdownManager = new GracefulShutdownManager(
    { adapter, worker, watchdog, db },
    { timeoutMs: 10_000, exitProcess: false }
  );

  const start = async (): Promise<void> => {
    logger.info('Initializing wapp-automata service...', {
      version: SERVICE_VERSION,
      env: config.NODE_ENV
    });

    // 1. Startup crash recovery check
    recoverStartupState(queueRepo);

    // 2. Start health heartbeat reporter
    heartbeat.start();

    // 3. Start stale delivering watchdog
    watchdog.start();

    // 4. Start queue worker engine
    worker.start();

    // 5. Automated SQLite Log Retention (prune envelopes > 30 days, purge delivered > 60 days)
    try {
      const retentionResult = queueRepo.pruneOldPayloads(30);
      if (retentionResult.prunedCount > 0 || retentionResult.deletedCount > 0) {
        logger.info('Automated SQLite log retention cleanup completed', retentionResult);
      }
    } catch (err) {
      logger.warn('Automated SQLite log retention warning', { error: err });
    }

    const retentionIntervalMs = 24 * 60 * 60 * 1000;
    const retentionTimer = setInterval(() => {
      try {
        const res = queueRepo.pruneOldPayloads(30);
        if (res.prunedCount > 0 || res.deletedCount > 0) {
          logger.info('Periodic SQLite log retention cleanup completed', res);
        }
      } catch (err) {
        logger.warn('Periodic SQLite log retention warning', { error: err });
      }
    }, retentionIntervalMs);
    retentionTimer.unref();

    // 6. Connect WhatsApp adapter if registered
    if (adapter) {
      await adapter.start();
    }

    // 6. Register OS signal handlers for graceful termination
    shutdownManager.registerSignalHandlers(['SIGINT', 'SIGTERM']);
    logger.info('wapp-automata service running successfully');
  };

  const stop = async (): Promise<void> => {
    await shutdownManager.shutdown('manual');
  };

  return {
    config,
    db,
    queueRepo,
    metrics,
    worker,
    watchdog,
    heartbeat,
    adapter,
    shutdownManager,
    start,
    stop
  };
}

export async function main(): Promise<void> {
  try {
    const app = createApplication();
    await app.start();
  } catch (err) {
    logger.error('Fatal initialization error during main()', { error: err });
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}
