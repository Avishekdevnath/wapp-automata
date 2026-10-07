import fs from 'node:fs';
import path from 'node:path';
import { rootLogger } from '../logging';
import { getConfig, AppConfig } from '../config';
import { getAccountDatabase, sanitizeAccountId, listAccountIds } from '../persistence';
import { createApplication, ApplicationContext } from '../app';
import { BaileysAdapter } from '../adapter/baileys';

const logger = rootLogger.forModule('account-pool');

export interface AccountFleetItem {
  accountId: string;
  isDefault: boolean;
  state: string;
  phone: string | null;
  uptimeSeconds: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  databasePath: string;
  databaseSizeBytes: number;
  totalMessages: number;
}

export class AccountPoolManager {
  private instances = new Map<string, ApplicationContext>();
  private baseConfig: AppConfig;

  constructor(baseConfig?: AppConfig) {
    this.baseConfig = baseConfig ?? getConfig();
  }

  /**
   * Resolves the dedicated session folder for a given account.
   */
  private resolveSessionPath(accountId: string): string {
    const cleanId = sanitizeAccountId(accountId);
    const rootSession = path.resolve(this.baseConfig.SESSION_DATA_PATH);

    if (cleanId === 'default') {
      // If default session already has creds in rootSession, keep it there seamlessly
      if (fs.existsSync(path.join(rootSession, 'creds.json'))) {
        return rootSession;
      }
      // Otherwise use .session/default
      const defaultSubdir = path.join(rootSession, 'default');
      if (!fs.existsSync(defaultSubdir)) {
        fs.mkdirSync(defaultSubdir, { recursive: true });
      }
      return defaultSubdir;
    }

    const accountSessionDir = path.join(rootSession, cleanId);
    if (!fs.existsSync(accountSessionDir)) {
      fs.mkdirSync(accountSessionDir, { recursive: true });
    }
    return accountSessionDir;
  }

  /**
   * Starts an account's isolated collector and worker instance.
   */
  public async startAccount(accountId: string = 'default'): Promise<ApplicationContext> {
    const cleanId = sanitizeAccountId(accountId);
    const existing = this.instances.get(cleanId);
    if (existing) {
      return existing;
    }

    logger.info(`[Account Pool] Initializing desk "${cleanId}"...`);

    const db = getAccountDatabase(cleanId);
    const sessionPath = this.resolveSessionPath(cleanId);

    const adapter = new BaileysAdapter({
      sessionPath,
      printQRInTerminal: cleanId === 'default', // Only print to CLI for primary desk
      reconnectIntervalMs: 5000
    });

    const context = createApplication({
      config: this.baseConfig,
      db,
      adapter
    });

    await context.start();
    this.instances.set(cleanId, context);
    logger.info(`[Account Pool] Desk "${cleanId}" started successfully`);
    return context;
  }

  /**
   * Stops a single account instance without disturbing any other desks.
   */
  public async stopAccount(accountId: string): Promise<boolean> {
    const cleanId = sanitizeAccountId(accountId);
    const context = this.instances.get(cleanId);
    if (!context) {
      return false;
    }

    logger.info(`[Account Pool] Stopping desk "${cleanId}"...`);
    await context.stop();
    this.instances.delete(cleanId);
    return true;
  }

  /**
   * Restarts an individual account's WhatsApp connection gracefully.
   */
  public async restartAccount(accountId: string): Promise<ApplicationContext> {
    await this.stopAccount(accountId);
    return await this.startAccount(accountId);
  }

  /**
   * Retrieves an active account context, or lazily starts it if configured.
   */
  public getAccount(accountId: string = 'default'): ApplicationContext | undefined {
    const cleanId = sanitizeAccountId(accountId);
    return this.instances.get(cleanId);
  }

  /**
   * Inspects all desks across the fleet and returns their live health telemetry.
   */
  public getFleetStatus(): AccountFleetItem[] {
    const allKnownIds = listAccountIds();
    // Include all currently running instances
    for (const runningId of this.instances.keys()) {
      if (!allKnownIds.includes(runningId)) {
        allKnownIds.push(runningId);
      }
    }

    return allKnownIds.map((id) => {
      const cleanId = sanitizeAccountId(id);
      const instance = this.instances.get(cleanId);
      const db = getAccountDatabase(cleanId);

      let totalMessages = 0;
      try {
        const row = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
        totalMessages = row?.count ?? 0;
      } catch {}

      let dbSizeBytes = 0;
      const dbPath = (db as any).name || '';
      try {
        if (dbPath && fs.existsSync(dbPath)) {
          dbSizeBytes = fs.statSync(dbPath).size;
        }
      } catch {}

      if (instance && instance.adapter) {
        const status = instance.adapter.getStatus();
        let formattedPhone: string | null = null;
        if (status.accountJid) {
          const raw = status.accountJid.split('@')[0].split(':')[0];
          formattedPhone = raw ? `+${raw}` : null;
        }

        return {
          accountId: cleanId,
          isDefault: cleanId === 'default',
          state: status.state,
          phone: formattedPhone,
          uptimeSeconds: status.uptimeSeconds,
          lastConnectedAt: status.lastConnectedAt,
          lastDisconnectedAt: status.lastDisconnectedAt,
          databasePath: dbPath,
          databaseSizeBytes: dbSizeBytes,
          totalMessages
        };
      }

      return {
        accountId: cleanId,
        isDefault: cleanId === 'default',
        state: 'unloaded',
        phone: null,
        uptimeSeconds: 0,
        lastConnectedAt: null,
        lastDisconnectedAt: null,
        databasePath: dbPath,
        databaseSizeBytes: dbSizeBytes,
        totalMessages
      };
    });
  }

  /**
   * Stops all active accounts in the pool during server shutdown.
   */
  public async stopAll(): Promise<void> {
    const ids = Array.from(this.instances.keys());
    for (const id of ids) {
      await this.stopAccount(id);
    }
  }
}

// Global Singleton Pool Instance
export const globalAccountPool = new AccountPoolManager();
