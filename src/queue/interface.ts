import { NormalizedEnvelope } from '../normalizer/types';

export type QueueStatus = 'pending' | 'delivering' | 'delivered' | 'failed';

export interface QueueRecord {
  id: string;
  chat_id: string;
  sender_id: string;
  chat_type: string;
  source_name: string | null;
  message_timestamp: number;
  message_text: string;
  has_media: number;
  media_type: string | null;
  media_metadata: string | null;
  raw_payload: string;
  status: QueueStatus;
  retry_count: number;
  next_retry_at: number;
  last_attempt_at: number | null;
  last_http_status: number | null;
  last_error: string | null;
  delivered_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface QueueDepth {
  pending: number;
  delivering: number;
  delivered: number;
  failed: number;
}

export interface IQueueRepository {
  /**
   * Persists normalized envelope transactionally using INSERT OR IGNORE.
   * Returns true if newly inserted, false if already exists (duplicate wamid).
   */
  enqueue(envelope: NormalizedEnvelope): boolean;

  /**
   * Fetches eligible messages with status='pending' and next_retry_at <= nowMs.
   * Ordered chronologically (created_at ASC).
   */
  fetchPending(limit: number, nowMs?: number): QueueRecord[];

  /**
   * Transitions a set of message IDs from 'pending' to 'delivering'.
   * Sets last_attempt_at to nowMs.
   */
  markDelivering(ids: string[], nowMs?: number): number;

  /**
   * Transitions a message to terminal 'delivered' state.
   */
  markDelivered(id: string, nowMs?: number): void;

  /**
   * Schedules a message for retry: increments retry_count, sets next_retry_at,
   * updates last_error, and resets status to 'pending'.
   */
  markRetry(id: string, nextRetryAt: number, httpStatus: number | null, error: string, nowMs?: number): void;

  /**
   * Transitions a message to terminal 'failed' state.
   */
  markFailed(id: string, httpStatus: number | null, error: string, nowMs?: number): void;

  /**
   * Resets stranded in-flight records back to 'pending'.
   * If staleThresholdMs is 0, resets all records in 'delivering' (used at boot).
   * If staleThresholdMs > 0, resets records whose last_attempt_at < nowMs - staleThresholdMs.
   */
  recoverStaleProcessing(staleThresholdMs?: number, nowMs?: number): number;

  /**
   * Returns aggregate count of records by status.
   */
  getQueueDepth(): QueueDepth;

  /**
   * Retrieves a single record by its message ID (wamid).
   */
  findById(id: string): QueueRecord | null;

  /**
   * Automated retention cleanup: prunes bulky raw_payload envelopes older than retentionDays
   * on non-pending messages, and deletes delivered records older than 2x retentionDays.
   * Keeps parsed route_ticks, carrier contacts, and vendors intact forever.
   */
  pruneOldPayloads(retentionDays?: number, nowMs?: number, deleteDelivered?: boolean): { prunedCount: number; deletedCount: number };
}
