import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import {
  IWhatsAppAdapter,
  CollectorStatus,
  CollectorConnectionState,
  RawMessageHandler,
  ConnectionStateChangeHandler
} from '../interface';
import { initSessionDirectory } from './session';
import { rootLogger } from '../../logging';

const logger = rootLogger.forModule('baileys-adapter');

export interface BaileysAdapterOptions {
  sessionPath?: string;
  printQRInTerminal?: boolean;
  reconnectIntervalMs?: number;
}

export class BaileysAdapter implements IWhatsAppAdapter {
  private sock: WASocket | null = null;
  private state: CollectorConnectionState = 'disconnected';
  private startedAt: number | null = null;
  private lastConnectedAt: number | null = null;
  private lastDisconnectedAt: number | null = null;
  private accountJid: string | null = null;

  private messageHandlers: RawMessageHandler[] = [];
  private statusHandlers: ConnectionStateChangeHandler[] = [];

  private isRunning: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly sessionPath: string;
  private readonly printQR: boolean;
  private readonly reconnectIntervalMs: number;

  constructor(options?: BaileysAdapterOptions) {
    this.sessionPath = options?.sessionPath ?? './.session';
    this.printQR = options?.printQRInTerminal ?? true;
    this.reconnectIntervalMs = options?.reconnectIntervalMs ?? 5000;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startedAt = Date.now();
    await this.connectSocket();
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('messages.upsert');
        this.sock.end(undefined);
      } catch (err) {
        logger.warn('Error closing Baileys socket', { error: err });
      }
      this.sock = null;
    }

    this.transitionState('disconnected');
    this.startedAt = null;
    logger.info('Baileys adapter stopped');
  }

  public getStatus(): CollectorStatus {
    const uptime = this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
    return {
      state: this.state,
      uptimeSeconds: uptime,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      accountJid: this.accountJid
    };
  }

  public onMessage(handler: RawMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  public onConnectionStatus(handler: ConnectionStateChangeHandler): void {
    this.statusHandlers.push(handler);
  }

  private async connectSocket(): Promise<void> {
    if (!this.isRunning) return;
    this.transitionState('connecting');

    const resolvedSessionDir = initSessionDirectory(this.sessionPath);
    const { state, saveCreds } = await useMultiFileAuthState(resolvedSessionDir);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false
    });
    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.transitionState('auth_required');
        if (this.printQR) {
          logger.info('WhatsApp authentication required. Scan QR code below to link device:');
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'open') {
        this.accountJid = sock.user?.id ?? null;
        this.lastConnectedAt = Date.now();
        this.transitionState('authenticated');
        logger.info('WhatsApp multi-device connection established', {
          accountJid: this.accountJid
        });
      }

      if (connection === 'close') {
        this.lastDisconnectedAt = Date.now();
        const error = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        const statusCode = error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        logger.warn('WhatsApp socket connection closed', {
          statusCode,
          isLoggedOut,
          willReconnect: !isLoggedOut && this.isRunning
        });

        if (isLoggedOut) {
          this.transitionState('auth_required');
          logger.error('WhatsApp session logged out or invalidated. Re-authentication via QR scan is required.');
        } else if (this.isRunning) {
          this.transitionState('connecting');
          this.scheduleReconnect();
        } else {
          this.transitionState('disconnected');
        }
      }
    });

    sock.ev.on('messages.upsert', async (upsert) => {
      if (!upsert.messages || upsert.messages.length === 0) return;

      for (const msg of upsert.messages) {
        for (const handler of this.messageHandlers) {
          try {
            await handler(msg);
          } catch (err) {
            logger.error('Error in message handler callback', {
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
      }
    });
  }

  private scheduleReconnect(): void {
    if (!this.isRunning || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.isRunning) return;

      logger.info('Attempting WhatsApp socket reconnection...');
      try {
        await this.connectSocket();
      } catch (err) {
        logger.error('Failed to reconnect WhatsApp socket; scheduling retry', { error: err });
        this.scheduleReconnect();
      }
    }, this.reconnectIntervalMs);

    if (this.reconnectTimer.unref) {
      this.reconnectTimer.unref();
    }
  }

  private transitionState(newState: CollectorConnectionState): void {
    this.state = newState;
    const status = this.getStatus();
    for (const handler of this.statusHandlers) {
      try {
        handler(status);
      } catch (err) {
        logger.error('Error in connection status handler', { error: err });
      }
    }
  }
}
