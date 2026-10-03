import {
  IWhatsAppAdapter,
  CollectorStatus,
  CollectorConnectionState,
  RawMessageHandler,
  ConnectionStateChangeHandler
} from './interface';

/**
 * Mock WhatsApp Adapter for deterministic testing without external network connections.
 */
export class MockWhatsAppAdapter implements IWhatsAppAdapter {
  private state: CollectorConnectionState = 'disconnected';
  private startedAt: number | null = null;
  private lastConnectedAt: number | null = null;
  private lastDisconnectedAt: number | null = null;
  private accountJid: string | null = null;

  private messageHandlers: RawMessageHandler[] = [];
  private statusHandlers: ConnectionStateChangeHandler[] = [];

  public async start(): Promise<void> {
    this.startedAt = Date.now();
    this.setConnectionState('authenticated', 'mock-user@s.whatsapp.net');
  }

  public async stop(): Promise<void> {
    this.setConnectionState('disconnected', null);
    this.startedAt = null;
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

  /**
   * Test Helper: Programmatically simulate an incoming raw WhatsApp event.
   */
  public async emitRawMessage(rawEvent: unknown): Promise<void> {
    for (const handler of this.messageHandlers) {
      await handler(rawEvent);
    }
  }

  /**
   * Test Helper: Programmatically trigger a connection state transition.
   */
  public setConnectionState(state: CollectorConnectionState, accountJid: string | null = this.accountJid): void {
    this.state = state;
    this.accountJid = accountJid;

    if (state === 'authenticated') {
      this.lastConnectedAt = Date.now();
    } else if (state === 'disconnected') {
      this.lastDisconnectedAt = Date.now();
    }

    const currentStatus = this.getStatus();
    for (const handler of this.statusHandlers) {
      handler(currentStatus);
    }
  }
}
