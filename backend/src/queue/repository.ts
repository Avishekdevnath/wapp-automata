import type Database from 'better-sqlite3';
import { NormalizedEnvelope } from '../normalizer/types';
import { IQueueRepository, QueueRecord, QueueDepth } from './interface';

/**
 * High-performance, atomic SQLite durable queue implementation.
 */
export class SQLiteQueueRepository implements IQueueRepository {
  private db: Database.Database;

  private insertStmt: Database.Statement;
  private findByIdStmt: Database.Statement;
  private markDeliveredStmt: Database.Statement;
  private markRetryStmt: Database.Statement;
  private markFailedStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;

    this.insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO messages (
        id, chat_id, sender_id, chat_type, source_name,
        message_timestamp, message_text, has_media, media_type,
        media_metadata, raw_payload, status, retry_count,
        next_retry_at, created_at, updated_at
      ) VALUES (
        @id, @chatId, @senderId, @chatType, @sourceName,
        @messageTimestamp, @messageText, @hasMedia, @mediaType,
        @mediaMetadata, @rawPayload, 'pending', 0,
        0, @createdAt, @updatedAt
      )
    `);

    this.findByIdStmt = this.db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `);

    this.markDeliveredStmt = this.db.prepare(`
      UPDATE messages
      SET status = 'delivered',
          delivered_at = :nowMs,
          updated_at = :nowMs,
          last_error = NULL
      WHERE id = :id
    `);

    this.markRetryStmt = this.db.prepare(`
      UPDATE messages
      SET status = 'pending',
          retry_count = retry_count + 1,
          next_retry_at = :nextRetryAt,
          last_http_status = :httpStatus,
          last_error = :error,
          updated_at = :nowMs
      WHERE id = :id
    `);

    this.markFailedStmt = this.db.prepare(`
      UPDATE messages
      SET status = 'failed',
          last_http_status = :httpStatus,
          last_error = :error,
          updated_at = :nowMs
      WHERE id = :id
    `);
  }

  public enqueue(envelope: NormalizedEnvelope): boolean {
    const now = Date.now();
    const mediaMetadataStr = envelope.media ? JSON.stringify(envelope.media) : null;
    const rawPayloadStr = JSON.stringify(envelope.rawPayload);

    const result = this.insertStmt.run({
      id: envelope.id,
      chatId: envelope.chatId,
      senderId: envelope.senderId,
      chatType: envelope.chatType,
      sourceName: envelope.chatName,
      messageTimestamp: envelope.timestamp,
      messageText: envelope.text,
      hasMedia: envelope.hasMedia ? 1 : 0,
      mediaType: envelope.media?.type ?? null,
      mediaMetadata: mediaMetadataStr,
      rawPayload: rawPayloadStr,
      createdAt: now,
      updatedAt: now
    });

    // result.changes is 1 if inserted, 0 if ignored as duplicate
    return result.changes > 0;
  }

  public fetchPending(limit: number, nowMs: number = Date.now()): QueueRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE status = 'pending' AND next_retry_at <= ?
      ORDER BY created_at ASC
      LIMIT ?
    `);
    return stmt.all(nowMs, limit) as QueueRecord[];
  }

  public markDelivering(ids: string[], nowMs: number = Date.now()): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE messages
      SET status = 'delivering',
          last_attempt_at = ?,
          updated_at = ?
      WHERE id IN (${placeholders}) AND status = 'pending'
    `);

    const result = stmt.run(nowMs, nowMs, ...ids);
    return result.changes;
  }

  public markDelivered(id: string, nowMs: number = Date.now()): void {
    this.markDeliveredStmt.run({ id, nowMs });
  }

  public markRetry(
    id: string,
    nextRetryAt: number,
    httpStatus: number | null,
    error: string,
    nowMs: number = Date.now()
  ): void {
    this.markRetryStmt.run({
      id,
      nextRetryAt,
      httpStatus,
      error,
      nowMs
    });
  }

  public markFailed(
    id: string,
    httpStatus: number | null,
    error: string,
    nowMs: number = Date.now()
  ): void {
    this.markFailedStmt.run({
      id,
      httpStatus,
      error,
      nowMs
    });
  }

  public recoverStaleProcessing(staleThresholdMs: number = 0, nowMs: number = Date.now()): number {
    let stmt: Database.Statement;

    if (staleThresholdMs <= 0) {
      // Unconditional reset (used on application startup)
      stmt = this.db.prepare(`
        UPDATE messages
        SET status = 'pending',
            updated_at = ?
        WHERE status = 'delivering'
      `);
      const result = stmt.run(nowMs);
      return result.changes;
    } else {
      // Threshold reset (used by watchdog)
      const cutoff = nowMs - staleThresholdMs;
      stmt = this.db.prepare(`
        UPDATE messages
        SET status = 'pending',
            updated_at = ?
        WHERE status = 'delivering' AND (last_attempt_at IS NULL OR last_attempt_at < ?)
      `);
      const result = stmt.run(nowMs, cutoff);
      return result.changes;
    }
  }

  public getQueueDepth(): QueueDepth {
    const rows = this.db
      .prepare('SELECT status, count(*) as count FROM messages GROUP BY status')
      .all() as Array<{ status: string; count: number }>;

    const depth: QueueDepth = {
      pending: 0,
      delivering: 0,
      delivered: 0,
      failed: 0
    };

    for (const row of rows) {
      if (row.status in depth) {
        depth[row.status as keyof QueueDepth] = row.count;
      }
    }

    return depth;
  }

  public findById(id: string): QueueRecord | null {
    const row = this.findByIdStmt.get(id);
    return (row as QueueRecord) || null;
  }

  public pruneOldPayloads(retentionDays: number = 30, nowMs: number = Date.now(), deleteDelivered: boolean = true): { prunedCount: number; deletedCount: number } {
    const cutoff = nowMs - (retentionDays * 24 * 60 * 60 * 1000);
    const delCutoff = nowMs - (retentionDays * 2 * 24 * 60 * 60 * 1000);

    let deletedCount = 0;
    // 1. Delete delivered messages only if explicitly allowed (ADR-013 Lifetime Text Storage)
    if (deleteDelivered) {
      const delStmt = this.db.prepare(`
        DELETE FROM messages
        WHERE created_at < ? AND status = 'delivered'
      `);
      const delRes = delStmt.run(delCutoff);
      deletedCount = delRes.changes;
    }

    // 2. Prune bulky raw payloads on remaining messages older than retention window (e.g. 30 days)
    const pruneStmt = this.db.prepare(`
      UPDATE messages
      SET raw_payload = '{"pruned":true}',
          updated_at = ?
      WHERE created_at < ? AND raw_payload != '{"pruned":true}' AND status != 'pending'
    `);
    const pruneRes = pruneStmt.run(nowMs, cutoff);

    try {
      this.db.pragma('incremental_vacuum(50)');
    } catch {
      // Silently ignore if auto_vacuum is not incremental
    }

    return {
      prunedCount: pruneRes.changes,
      deletedCount
    };
  }
}
