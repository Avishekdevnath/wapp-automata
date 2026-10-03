import { QueueRecord } from '../queue/interface';

export type WorkerDeliveryHandler = (record: QueueRecord) => Promise<void>;

export interface WorkerOptions {
  /** Polling interval in milliseconds (default: 1000) */
  pollIntervalMs?: number;

  /** Maximum number of records fetched per polling tick (default: 20) */
  batchSize?: number;
}
