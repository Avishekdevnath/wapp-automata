import fs from 'node:fs';
import path from 'node:path';
import { rootLogger } from '../../logging';

const logger = rootLogger.forModule('baileys-archive-cache');

/**
 * Manages tracking and disk persistence of WhatsApp archived chat JIDs.
 */
export class ArchiveCacheManager {
  private readonly archivedChats = new Set<string>();
  private readonly sessionPath: string;

  constructor(sessionPath: string) {
    this.sessionPath = sessionPath;
    this.load();
  }

  public load(): void {
    try {
      const cachePath = path.join(this.sessionPath, 'archived_chats.json');
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.archivedChats.clear();
          for (const item of list) {
            if (typeof item === 'string') {
              this.archivedChats.add(item);
            }
          }
        }
      }
    } catch (err) {
      logger.debug('Could not load archived chats cache', { error: err });
    }
  }

  public save(): void {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }
      const cachePath = path.join(this.sessionPath, 'archived_chats.json');
      fs.writeFileSync(cachePath, JSON.stringify(Array.from(this.archivedChats), null, 2), 'utf8');
    } catch (err) {
      logger.debug('Could not save archived chats cache', { error: err });
    }
  }

  public isArchived(jid: string | undefined | null): boolean {
    if (!jid) return false;
    return this.archivedChats.has(jid);
  }

  public setArchived(jid: string, isArchived: boolean): void {
    if (isArchived) {
      this.archivedChats.add(jid);
    } else {
      this.archivedChats.delete(jid);
    }
  }

  public processChats(chats: unknown[]): boolean {
    if (!Array.isArray(chats)) return false;
    let updated = false;
    for (const c of chats) {
      const raw = c as Record<string, unknown>;
      if (raw && typeof raw.id === 'string' && (raw.archived || raw.archive)) {
        this.archivedChats.add(raw.id);
        updated = true;
      }
    }
    if (updated) this.save();
    return updated;
  }

  public processUpdates(updates: unknown[]): boolean {
    if (!Array.isArray(updates)) return false;
    let updated = false;
    for (const u of updates) {
      const raw = u as Record<string, unknown>;
      if (raw && typeof raw.id === 'string') {
        if (raw.archived === true || raw.archive === true) {
          this.archivedChats.add(raw.id);
          updated = true;
        } else if (raw.archived === false || raw.archive === false) {
          this.archivedChats.delete(raw.id);
          updated = true;
        }
      }
    }
    if (updated) this.save();
    return updated;
  }
}
