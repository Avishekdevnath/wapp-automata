import fs from 'node:fs';
import path from 'node:path';
import { rootLogger } from '../../logging';

const logger = rootLogger.forModule('baileys-lid-cache');

/**
 * Manages resolution and local disk caching of WhatsApp LIDs (Linked Identity IDs)
 * to standard MSISDN international phone numbers (@s.whatsapp.net).
 */
export class LidCacheManager {
  private readonly lidToPhone = new Map<string, string>();
  private readonly sessionPath: string;

  constructor(sessionPath: string) {
    this.sessionPath = sessionPath;
    this.load();
  }

  public load(): void {
    try {
      const cachePath = path.join(this.sessionPath, 'lid_cache.json');
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string') {
              this.lidToPhone.set(k, v);
            }
          }
        }
      }
    } catch (err) {
      logger.debug('Could not load lid cache', { error: err });
    }
  }

  public save(): void {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }
      const cachePath = path.join(this.sessionPath, 'lid_cache.json');
      const obj: Record<string, string> = {};
      for (const [k, v] of this.lidToPhone.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(cachePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      logger.debug('Could not save lid cache', { error: err });
    }
  }

  public register(lid: string | undefined | null, phoneJid: string | undefined | null): boolean {
    if (!lid || !phoneJid) return false;
    const cleanLid = lid.trim();
    const cleanPhone = phoneJid.trim();
    if (!cleanPhone.endsWith('@s.whatsapp.net')) return false;

    this.lidToPhone.set(cleanLid, cleanPhone);
    this.lidToPhone.set(cleanLid.split('@')[0], cleanPhone);
    if (cleanLid.includes(':')) {
      this.lidToPhone.set(cleanLid.split(':')[0], cleanPhone);
      this.lidToPhone.set(cleanLid.split(':')[0] + '@lid', cleanPhone);
    }
    return true;
  }

  public processParticipants(participants: Array<Record<string, unknown>>): boolean {
    if (!Array.isArray(participants)) return false;
    let updated = false;
    for (const p of participants) {
      const rawJid = (typeof p.jid === 'string') ? p.jid : (typeof p.id === 'string' && p.id.endsWith('@s.whatsapp.net')) ? p.id : null;
      const rawLid = (typeof p.lid === 'string') ? p.lid : (typeof p.id === 'string' && p.id.includes('@lid')) ? p.id : null;
      const rawPhone = (typeof p.phoneNumber === 'string') ? p.phoneNumber : (typeof p.phone_number === 'string') ? p.phone_number : null;
      const phoneJid = rawJid || (rawPhone ? `${rawPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);

      if (rawLid && phoneJid) {
        if (this.register(rawLid, phoneJid)) {
          updated = true;
        }
      }
    }
    if (updated) {
      this.save();
    }
    return updated;
  }

  public async resolve(remoteJid: string, participant: string, sock?: any): Promise<string> {
    if (!participant) return participant;

    if (participant.endsWith('@s.whatsapp.net')) {
      return participant;
    }

    const cached = this.lidToPhone.get(participant) ||
      this.lidToPhone.get(participant.split('@')[0]) ||
      this.lidToPhone.get(participant.split(':')[0]);

    if (cached) {
      return cached;
    }

    if (sock && remoteJid.endsWith('@g.us')) {
      try {
        const meta = await sock.groupMetadata(remoteJid);
        if (meta && Array.isArray(meta.participants)) {
          this.processParticipants(meta.participants as unknown as Array<Record<string, unknown>>);

          const resolvedAfterRefresh = this.lidToPhone.get(participant) ||
            this.lidToPhone.get(participant.split('@')[0]) ||
            this.lidToPhone.get(participant.split(':')[0]);

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
