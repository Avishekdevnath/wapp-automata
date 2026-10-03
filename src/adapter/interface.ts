/**
 * Provider-Agnostic WhatsApp Adapter Interface
 * Isolates all WhatsApp-specific connection and protocol details.
 */

export type CollectorConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticated'
  | 'auth_required';

export interface CollectorStatus {
  state: CollectorConnectionState;
  uptimeSeconds: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  accountJid: string | null;
}

export type RawMessageHandler = (rawEvent: unknown) => Promise<void>;
export type ConnectionStateChangeHandler = (status: CollectorStatus) => void;

export interface IWhatsAppAdapter {
  /**
   * Initializes credentials, establishes socket connection, and begins listening.
   */
  start(): Promise<void>;

  /**
   * Gracefully terminates socket connection and flushes session credentials.
   */
  stop(): Promise<void>;

  /**
   * Returns a snapshot of the current connection and account status.
   */
  getStatus(): CollectorStatus;

  /**
   * Registers callback invoked whenever an incoming raw message is captured.
   */
  onMessage(handler: RawMessageHandler): void;

  /**
   * Registers callback invoked whenever connection state changes.
   */
  onConnectionStatus(handler: ConnectionStateChangeHandler): void;
}
