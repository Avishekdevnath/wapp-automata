import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  Browsers,
  proto
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
import { LidCacheManager } from './lid-cache';
import { ArchiveCacheManager } from './archive-cache';
import {
  writeSessionState,
  deleteSessionFiles,
  generateQrDataUrl,
  processPairCodeRequest
} from './session-manager';
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
  private lastQR: string | null = null;
  private pairPollTimer: NodeJS.Timeout | null = null;

  private messageHandlers: RawMessageHandler[] = [];
  private statusHandlers: ConnectionStateChangeHandler[] = [];

  private isRunning: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private groupCache = new Map<string, { subject: string }>();
  private consecutive428Errors: number = 0;
  private reconnectAttempts: number = 0;
  private presenceTimer: NodeJS.Timeout | null = null;
  private recentMessagesCache = new Map<string, any>();

  private readonly sessionPath: string;
  private readonly printQR: boolean;
  private readonly reconnectIntervalMs: number;
  private readonly lidCache: LidCacheManager;
  private readonly archiveCache: ArchiveCacheManager;

  constructor(options?: BaileysAdapterOptions) {
    this.sessionPath = options?.sessionPath ?? './.session';
    this.printQR = options?.printQRInTerminal ?? true;
    this.reconnectIntervalMs = options?.reconnectIntervalMs ?? 5000;
    this.lidCache = new LidCacheManager(this.sessionPath);
    this.archiveCache = new ArchiveCacheManager(this.sessionPath);
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

    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
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

  public onConnectionStateChange(handler: ConnectionStateChangeHandler): void {
    this.statusHandlers.push(handler);
  }

  public registerLidMapping(lid: string | undefined | null, phoneJid: string | undefined | null): void {
    if (this.lidCache.register(lid, phoneJid)) {
      this.lidCache.save();
    }
  }

  private async connectSocket(): Promise<void> {
    if (!this.isRunning) return;
    this.transitionState('connecting');

    const resolvedSessionDir = initSessionDirectory(this.sessionPath);
    const { state, saveCreds } = await useMultiFileAuthState(resolvedSessionDir);

    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('messages.upsert');
        this.sock.ev.removeAllListeners('contacts.upsert');
        this.sock.ev.removeAllListeners('contacts.update');
        this.sock.ev.removeAllListeners('groups.update');
        this.sock.ev.removeAllListeners('group-participants.update');
        this.sock.ev.removeAllListeners('chats.upsert');
        this.sock.ev.removeAllListeners('chats.update');
        this.sock.ev.removeAllListeners('messaging-history.set');
        this.sock.end(undefined);
      } catch (err) {
        logger.debug('Error closing previous Baileys socket before reconnect', { error: err });
      }
      this.sock = null;
    }

    const sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      fireInitQueries: true,
      keepAliveIntervalMs: 25_000,
      connectTimeoutMs: 60_000,
      shouldSyncHistoryMessage: (msg) => {
        if (!msg) return false;
        // Block massive FULL multi-year archives, but allow RECENT catch-up sync, PUSH_NAME, and INITIAL_BOOTSTRAP
        return msg.syncType !== proto.Message.HistorySyncNotification.HistorySyncType.FULL;
      },
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      logger: pino({ level: 'info' }),
      printQRInTerminal: false,
      defaultQueryTimeoutMs: 60_000,
      retryRequestDelayMs: 250,
      getMessage: async (key) => {
        if (key?.id && this.recentMessagesCache.has(key.id)) {
          return this.recentMessagesCache.get(key.id);
        }
        return undefined;
      }
    });
    this.sock = sock;

    if (this.pairPollTimer) {
      clearInterval(this.pairPollTimer);
      this.pairPollTimer = null;
    }

    this.pairPollTimer = setInterval(async () => {
      await processPairCodeRequest(
        resolvedSessionDir,
        sock,
        this.lastQR,
        Boolean(state.creds?.me?.id || state.creds?.registered),
        (updatedState) => writeSessionState(this.sessionPath, updatedState)
      );
    }, 1000);

    // Only update state to connecting if creds exist; do NOT falsely report 'authenticated' before socket is open!
    const hasExistingAuth = Boolean(state.creds?.me?.id);
    if (hasExistingAuth) {
      writeSessionState(this.sessionPath, {
        status: 'connecting',
        accountJid: state.creds?.me?.id,
        name: state.creds?.me?.name || null,
        updatedAt: Date.now()
      });
    } else {
      writeSessionState(this.sessionPath, {
        status: 'scan_qr',
        qr: this.lastQR,
        updatedAt: Date.now()
      });
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.lastQR = qr;
        this.transitionState('auth_required');

        const qrDataUrl = await generateQrDataUrl(qr);

        writeSessionState(this.sessionPath, {
          status: 'scan_qr',
          qr,
          qrDataUrl,
          updatedAt: Date.now()
        });

        if (this.printQR) {
          logger.info('WhatsApp authentication required. Scan QR code below to link device:');
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'open') {
        this.consecutive428Errors = 0;
        this.reconnectAttempts = 0;
        if (this.pairPollTimer) {
          clearInterval(this.pairPollTimer);
          this.pairPollTimer = null;
        }
        this.accountJid = sock.user?.id ?? state.creds?.me?.id ?? null;
        this.lastConnectedAt = Date.now();
        this.transitionState('authenticated');
        writeSessionState(this.sessionPath, {
          status: 'authenticated',
          accountJid: this.accountJid,
          name: sock.user?.name || state.creds?.me?.name || null,
          updatedAt: Date.now()
        });
        logger.info('WhatsApp multi-device connection established', {
          accountJid: this.accountJid
        });

        // STEALTH MODE & CLOUD KEEP-ALIVE: Run as passive silent observer.
        // Send lightweight presence update every 25 seconds to prevent cloud VPS NAT / firewall idle timeouts.
        try {
          await sock.sendPresenceUpdate('unavailable');
        } catch (_) { }

        if (this.presenceTimer) clearInterval(this.presenceTimer);
        this.presenceTimer = setInterval(async () => {
          if (this.sock && this.state === 'authenticated') {
            try {
              await this.sock.sendPresenceUpdate('unavailable');
            } catch (_) { }
          }
        }, 25_000);
      }

      if (connection === 'close') {
        if (this.presenceTimer) {
          clearInterval(this.presenceTimer);
          this.presenceTimer = null;
        }
        if (this.pairPollTimer) {
          clearInterval(this.pairPollTimer);
          this.pairPollTimer = null;
        }
        this.lastDisconnectedAt = Date.now();
        const error = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        const statusCode = error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        // WhatsApp normal handshake restart (Status 515: restartRequired)
        if (statusCode === 515) {
          logger.info('WhatsApp socket requested handshake restart (status 515); performing immediate reconnect...');
          this.transitionState('connecting');
          if (this.isRunning) {
            this.scheduleReconnect(500);
          }
          return;
        }

        // WhatsApp connection replaced by another client session (Status 440: connectionReplaced)
        if (statusCode === DisconnectReason.connectionReplaced) {
          logger.warn('WhatsApp session replaced by another connection; pausing reconnect to prevent duplicate session collision');
          this.transitionState('disconnected');
          if (this.isRunning) {
            this.scheduleReconnect(15000);
          }
          return;
        }

        if (statusCode === 428) {
          this.consecutive428Errors++;
          logger.warn(`WhatsApp socket closed with statusCode 428 (consecutive: ${this.consecutive428Errors})`);
        } else {
          this.consecutive428Errors = 0;
        }

        // Only delete if explicitly logged out by WhatsApp, or if stuck in repeated 428 loops without connecting
        const shoulddeleteStaleSession = isLoggedOut || (this.consecutive428Errors >= 10);

        if (shoulddeleteStaleSession) {
          this.transitionState('auth_required');
          logger.warn('WhatsApp session logged out or invalidated. Purging auth credentials and generating fresh pairing...');
          deleteSessionFiles(resolvedSessionDir);
          writeSessionState(this.sessionPath, {
            status: 'scan_qr',
            statusCode,
            willReconnect: true,
            updatedAt: Date.now()
          });
          if (this.isRunning) {
            this.scheduleReconnect();
          }
        } else if (this.isRunning) {
          this.transitionState('connecting');
          writeSessionState(this.sessionPath, {
            status: 'disconnected',
            statusCode,
            willReconnect: true,
            updatedAt: Date.now()
          });
          this.scheduleReconnect();
        } else {
          this.transitionState('disconnected');
          writeSessionState(this.sessionPath, {
            status: 'disconnected',
            statusCode,
            willReconnect: false,
            updatedAt: Date.now()
          });
        }
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      let updated = false;
      for (const c of contacts) {
        const phoneJid = (c.jid && c.jid.endsWith('@s.whatsapp.net'))
          ? c.jid
          : (c.id && c.id.endsWith('@s.whatsapp.net')) ? c.id : null;
        const lid = c.lid || (c.id && c.id.includes('@lid') ? c.id : null);
        if (lid && phoneJid) {
          if (this.lidCache.register(lid, phoneJid)) updated = true;
        }
      }
      if (updated) this.lidCache.save();
    });

    sock.ev.on('contacts.update', (updates) => {
      let updated = false;
      for (const c of updates) {
        const phoneJid = (c.jid && c.jid.endsWith('@s.whatsapp.net'))
          ? c.jid
          : (c.id && c.id.endsWith('@s.whatsapp.net')) ? c.id : null;
        const lid = c.lid || (c.id && c.id.includes('@lid') ? c.id : null);
        if (lid && phoneJid) {
          if (this.lidCache.register(lid, phoneJid)) updated = true;
        }
      }
      if (updated) this.lidCache.save();
    });

    sock.ev.on('groups.update', (updates) => {
      for (const update of updates) {
        if (update.id && update.subject) {
          this.groupCache.set(update.id, { subject: update.subject });
        }
      }
    });

    sock.ev.on('group-participants.update', async (event) => {
      if (event.id) {
        try {
          const meta = await sock.groupMetadata(event.id);
          if (meta && Array.isArray(meta.participants)) {
            this.lidCache.processParticipants(meta.participants as unknown as Array<Record<string, unknown>>);
          }
        } catch { }
      }
    });

    sock.ev.on('chats.upsert', (chats) => {
      this.archiveCache.processChats(chats as unknown[]);
    });

    sock.ev.on('chats.update', (updates) => {
      this.archiveCache.processUpdates(updates as unknown[]);
    });

    sock.ev.on('messaging-history.set', async ({ chats, messages, isLatest }) => {
      logger.info('WhatsApp messaging-history sync received', {
        chatsCount: chats?.length || 0,
        messagesCount: messages?.length || 0,
        isLatest
      });
      if (Array.isArray(chats)) {
        this.archiveCache.processChats(chats as unknown[]);
      }

      if (Array.isArray(messages) && messages.length > 0) {
        // Catch up all recent messages within the last 48 hours
        const cutoffSeconds = Math.floor(Date.now() / 1000) - (48 * 3600);
        const recentHistory = messages.filter((m) => {
          const ts = typeof m.messageTimestamp === 'number'
            ? m.messageTimestamp
            : Number((m.messageTimestamp as { low?: number })?.low || m.messageTimestamp || 0);
          return ts >= cutoffSeconds;
        });

        logger.info('Processing recent catch-up messages from WhatsApp history sync', {
          totalReceived: messages.length,
          recentEligible: recentHistory.length
        });

        for (const msg of recentHistory) {
          const remoteJid = msg.key?.remoteJid;
          if (remoteJid && this.archiveCache.isArchived(remoteJid)) {
            (msg as unknown as Record<string, unknown>).isArchived = true;
          }
          if (this.accountJid) {
            (msg as unknown as Record<string, unknown>).accountJid = this.accountJid;
          }
          for (const handler of this.messageHandlers) {
            try {
              await handler(msg);
            } catch (err) {
              logger.debug('Error in historical message handler', { error: err });
            }
          }
        }
      }
    });

    sock.ev.on('messages.upsert', async (upsert) => {
      if (!upsert.messages || upsert.messages.length === 0) return;
      logger.info('Received raw WhatsApp messages.upsert event', {
        count: upsert.messages.length,
        type: upsert.type
      });

      for (const msg of upsert.messages) {
        if (msg.key?.id && msg.message) {
          this.recentMessagesCache.set(msg.key.id, msg.message);
          if (this.recentMessagesCache.size > 2000) {
            const first = this.recentMessagesCache.keys().next().value;
            if (first) this.recentMessagesCache.delete(first);
          }
        }

        logger.info('Processing incoming raw message item', {
          id: msg.key?.id,
          remoteJid: msg.key?.remoteJid,
          fromMe: msg.key?.fromMe,
          hasMessage: Boolean(msg.message),
          stubType: msg.messageStubType
        });

        const remoteJid = msg.key?.remoteJid;
        if (remoteJid && this.archiveCache.isArchived(remoteJid)) {
          (msg as unknown as Record<string, unknown>).isArchived = true;
        }
        if (this.accountJid) {
          (msg as unknown as Record<string, unknown>).accountJid = this.accountJid;
        }

        // Automatically resolve group name and map participant LID to phone number
        if (remoteJid && remoteJid.endsWith('@g.us')) {
          let cached = this.groupCache.get(remoteJid);
          if (!cached) {
            try {
              const meta = await sock.groupMetadata(remoteJid);
              if (meta) {
                cached = { subject: meta.subject || remoteJid };
                this.groupCache.set(remoteJid, cached);
                if (Array.isArray(meta.participants)) {
                  this.lidCache.processParticipants(meta.participants as unknown as Array<Record<string, unknown>>);
                }
              }
            } catch (err) {
              logger.debug('Could not fetch group metadata for chat', { remoteJid, error: err });
            }
          }

          if (cached) {
            (msg as unknown as Record<string, unknown>).chatName = cached.subject;
          }

          const rawParticipant = msg.key?.participant || (msg as unknown as Record<string, unknown>).participant as string | undefined;
          if (rawParticipant) {
            const resolvedPhoneJid = await this.lidCache.resolve(remoteJid, rawParticipant, sock);
            if (resolvedPhoneJid && msg.key) {
              msg.key.participant = resolvedPhoneJid;
            }
            (msg as unknown as Record<string, unknown>).participant = resolvedPhoneJid;
          }
        }

        for (const handler of this.messageHandlers) {
          try {
            await handler(msg);
          } catch (err) {
            logger.error('Error in message handler callback', {
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }

        // Selective Read Receipts (ADR-013):
        // Automatically mark incoming messages as read ONLY for group chats (@g.us).
        // Direct messages (1-on-1 chats / @s.whatsapp.net) must NEVER be auto-marked as read (Zero-Seen Guarantee).
        const isGroupChat = Boolean(msg.key?.remoteJid?.endsWith('@g.us'));
        if (msg.key && !msg.key.fromMe && isGroupChat) {
          try {
            await sock.readMessages([msg.key]);
          } catch (readErr) {
            logger.debug('Could not send read receipt for group message', { key: msg.key, error: readErr });
          }
        }
      }
    });
  }

  private scheduleReconnect(explicitDelayMs?: number): void {
    if (!this.isRunning || this.reconnectTimer) return;

    let delayMs = explicitDelayMs;
    if (delayMs === undefined) {
      this.reconnectAttempts++;
      // Exponential backoff: 2s * 1.5^(attempt - 1), capped at 30s + randomized jitter (0-2s)
      const baseDelay = Math.min(30_000, 2000 * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 6)));
      const jitter = Math.floor(Math.random() * 2000);
      delayMs = baseDelay + jitter;
    }

    logger.info(`Scheduling WhatsApp socket reconnection in ${Math.round(delayMs / 1000)}s (attempt ${this.reconnectAttempts})...`);

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
    }, delayMs);

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
