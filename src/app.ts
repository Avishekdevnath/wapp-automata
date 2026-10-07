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
import { scheduleLogRetention } from './retention';

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
          logger.info('Skipping message: normalizer returned null');
          return;
        }

        logger.info('Incoming WhatsApp message normalized', {
          id: envelope.id,
          chatId: envelope.chatId,
          chatType: envelope.chatType,
          senderId: envelope.senderId,
          hasMedia: envelope.hasMedia,
          textPreview: envelope.text ? envelope.text.slice(0, 50) : ''
        });

        if (config.ALLOWED_CHATS && config.ALLOWED_CHATS.length > 0) {
          if (!config.ALLOWED_CHATS.includes(envelope.chatId)) {
            logger.info('Skipping message from unallowed chat', { chatId: envelope.chatId });
            return;
          }
        }

        // Selective Direct Message (DM) Recording (ADR-013):
        // By default, 1-on-1 personal DMs are NOT recorded unless enabled in Settings.
        const isGroupOrChannel = envelope.chatType === 'group' || envelope.chatType === 'channel' || envelope.chatId.endsWith('@g.us');
        if (!isGroupOrChannel) {
          try {
            db.exec('CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)');
            const row = db.prepare("SELECT value FROM system_settings WHERE key = 'record_direct_messages'").get() as { value?: string } | undefined;
            const isDmRecordEnabled = row?.value === 'true';
            if (!isDmRecordEnabled) {
              logger.debug('Skipping direct message: DM recording is disabled by user setting', { id: envelope.id, chatId: envelope.chatId });
              return;
            }
          } catch (settingErr) {
            logger.debug('Skipping direct message by default', { error: settingErr });
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

    // 5. Automated SQLite Log Retention (prune payloads > 30 days)
    scheduleLogRetention(queueRepo, 30);

    // 6. Connect WhatsApp adapter if registered
    if (adapter) {
      await adapter.start();
    }

    // 7. Register OS signal handlers for graceful termination
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
