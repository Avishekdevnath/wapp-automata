import fs from 'node:fs';
import path from 'node:path';
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
  private groupCache = new Map<string, { subject: string }>();
  private lidToPhoneGlobal = new Map<string, string>();
  private readonly sessionPath: string;
  private readonly printQR: boolean;
  private readonly reconnectIntervalMs: number;

  constructor(options?: BaileysAdapterOptions) {
    this.sessionPath = options?.sessionPath ?? './.session';
    this.printQR = options?.printQRInTerminal ?? true;
    this.reconnectIntervalMs = options?.reconnectIntervalMs ?? 5000;
    this.loadLidCache();
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

    if (state.creds?.me?.id) {
      this.writeSessionState({
        status: 'authenticated',
        accountJid: state.creds.me.id,
        name: state.creds.me.name || null,
        updatedAt: Date.now()
      });
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.transitionState('auth_required');
        this.writeSessionState({
          status: 'scan_qr',
          qr,
          updatedAt: Date.now()
        });
        if (this.printQR) {
          logger.info('WhatsApp authentication required. Scan QR code below to link device:');
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'open') {
        this.accountJid = sock.user?.id ?? null;
        this.lastConnectedAt = Date.now();
        this.transitionState('authenticated');
        this.writeSessionState({
          status: 'authenticated',
          accountJid: this.accountJid,
          name: sock.user?.name || null,
          updatedAt: Date.now()
        });
        logger.info('WhatsApp multi-device connection established', {
          accountJid: this.accountJid
        });
      }

      if (connection === 'close') {
        this.lastDisconnectedAt = Date.now();
        const error = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        const statusCode = error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        this.writeSessionState({
          status: isLoggedOut ? 'auth_required' : 'disconnected',
          statusCode,
          willReconnect: !isLoggedOut && this.isRunning,
          updatedAt: Date.now()
        });

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

    sock.ev.on('contacts.upsert', (contacts) => {
      let updated = false;
      for (const c of contacts) {
        const phoneJid = (c.jid && c.jid.endsWith('@s.whatsapp.net'))
          ? c.jid
          : (c.id && c.id.endsWith('@s.whatsapp.net')) ? c.id : null;
        const lid = c.lid || (c.id && c.id.includes('@lid') ? c.id : null);
        if (lid && phoneJid) {
          this.registerLidMapping(lid, phoneJid);
          updated = true;
        }
      }
      if (updated) this.saveLidCache();
    });

    sock.ev.on('contacts.update', (updates) => {
      let updated = false;
      for (const c of updates) {
        const phoneJid = (c.jid && c.jid.endsWith('@s.whatsapp.net'))
          ? c.jid
          : (c.id && c.id.endsWith('@s.whatsapp.net')) ? c.id : null;
        const lid = c.lid || (c.id && c.id.includes('@lid') ? c.id : null);
        if (lid && phoneJid) {
          this.registerLidMapping(lid, phoneJid);
          updated = true;
        }
      }
      if (updated) this.saveLidCache();
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
            let updated = false;
            for (const p of meta.participants as unknown as Array<Record<string, unknown>>) {
              const rawJid = (typeof p.jid === 'string') ? p.jid : (typeof p.id === 'string' && p.id.endsWith('@s.whatsapp.net')) ? p.id : null;
              const rawLid = (typeof p.lid === 'string') ? p.lid : (typeof p.id === 'string' && p.id.includes('@lid')) ? p.id : null;
              const rawPhone = (typeof p.phoneNumber === 'string') ? p.phoneNumber : (typeof p.phone_number === 'string') ? p.phone_number : null;
              const phoneJid = rawJid || (rawPhone ? `${rawPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);

              if (rawLid && phoneJid) {
                this.registerLidMapping(rawLid, phoneJid);
                updated = true;
              }
            }
            if (updated) this.saveLidCache();
          }
        } catch {}
      }
    });

    sock.ev.on('messages.upsert', async (upsert) => {
      if (!upsert.messages || upsert.messages.length === 0) return;

      for (const msg of upsert.messages) {
        const remoteJid = msg.key?.remoteJid;

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
                  let updated = false;
                  for (const p of meta.participants as unknown as Array<Record<string, unknown>>) {
                    const rawJid = (typeof p.jid === 'string') ? p.jid : (typeof p.id === 'string' && p.id.endsWith('@s.whatsapp.net')) ? p.id : null;
                    const rawLid = (typeof p.lid === 'string') ? p.lid : (typeof p.id === 'string' && p.id.includes('@lid')) ? p.id : null;
                    const rawPhone = (typeof p.phoneNumber === 'string') ? p.phoneNumber : (typeof p.phone_number === 'string') ? p.phone_number : null;
                    const phoneJid = rawJid || (rawPhone ? `${rawPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);

                    if (rawLid && phoneJid) {
                      this.registerLidMapping(rawLid, phoneJid);
                      updated = true;
                    }
                  }
                  if (updated) this.saveLidCache();
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
            const resolvedPhoneJid = await this.resolveParticipant(remoteJid, rawParticipant);
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

  private writeSessionState(state: Record<string, unknown>): void {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }
      fs.writeFileSync(
        path.join(this.sessionPath, 'session_state.json'),
        JSON.stringify(state, null, 2),
        'utf8'
      );
    } catch (err) {
      logger.debug('Could not write session state file', { error: err });
    }
  }

  private loadLidCache(): void {
    try {
      const cachePath = path.join(this.sessionPath, 'lid_cache.json');
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string') {
              this.lidToPhoneGlobal.set(k, v);
            }
          }
        }
      }
    } catch (err) {
      logger.debug('Could not load lid cache', { error: err });
    }
  }

  private saveLidCache(): void {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }
      const cachePath = path.join(this.sessionPath, 'lid_cache.json');
      const obj: Record<string, string> = {};
      for (const [k, v] of this.lidToPhoneGlobal.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(cachePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      logger.debug('Could not save lid cache', { error: err });
    }
  }

  public registerLidMapping(lid: string | undefined | null, phoneJid: string | undefined | null): void {
    if (!lid || !phoneJid) return;
    const cleanLid = lid.trim();
    const cleanPhone = phoneJid.trim();
    if (!cleanPhone.endsWith('@s.whatsapp.net')) return;

    this.lidToPhoneGlobal.set(cleanLid, cleanPhone);
    this.lidToPhoneGlobal.set(cleanLid.split('@')[0], cleanPhone);
    if (cleanLid.includes(':')) {
      this.lidToPhoneGlobal.set(cleanLid.split(':')[0], cleanPhone);
      this.lidToPhoneGlobal.set(cleanLid.split(':')[0] + '@lid', cleanPhone);
    }
  }

  private async resolveParticipant(remoteJid: string, participant: string): Promise<string> {
    if (!participant) return participant;

    if (participant.endsWith('@s.whatsapp.net')) {
      return participant;
    }

    const cached = this.lidToPhoneGlobal.get(participant) ||
      this.lidToPhoneGlobal.get(participant.split('@')[0]) ||
      this.lidToPhoneGlobal.get(participant.split(':')[0]);

    if (cached) {
      return cached;
    }

    if (this.sock && remoteJid.endsWith('@g.us')) {
      try {
        const meta = await this.sock.groupMetadata(remoteJid);
        if (meta && Array.isArray(meta.participants)) {
          let updated = false;
          for (const p of meta.participants as unknown as Array<Record<string, unknown>>) {
            const rawJid = (typeof p.jid === 'string') ? p.jid : (typeof p.id === 'string' && p.id.endsWith('@s.whatsapp.net')) ? p.id : null;
            const rawLid = (typeof p.lid === 'string') ? p.lid : (typeof p.id === 'string' && p.id.includes('@lid')) ? p.id : null;
            const rawPhone = (typeof p.phoneNumber === 'string') ? p.phoneNumber : (typeof p.phone_number === 'string') ? p.phone_number : null;

            const phoneJid = rawJid || (rawPhone ? `${rawPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);

            if (rawLid && phoneJid) {
              this.registerLidMapping(rawLid, phoneJid);
              updated = true;
            }
          }

          if (updated) {
            this.saveLidCache();
          }

          const resolvedAfterRefresh = this.lidToPhoneGlobal.get(participant) ||
            this.lidToPhoneGlobal.get(participant.split('@')[0]) ||
            this.lidToPhoneGlobal.get(participant.split(':')[0]);

          if (resolvedAfterRefresh) {
            return resolvedAfterRefresh;
          }
        }
      } catch (err) {
        logger.debug('Failed to query groupMetadata for participant LID', { remoteJid, participant, error: err });
      }
    }

    return participant;
  }
}
