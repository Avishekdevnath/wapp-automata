export interface DeviceStatus {
  connected: boolean;
  status: 'authenticated' | 'connecting' | 'qr_required' | 'disconnected';
  phone?: string | null;
  pushName?: string | null;
  platform?: string | null;
  qrCode?: string | null;
  uptime?: number | null;
}

export interface CollectorHealth {
  version: string;
  uptimeSeconds: number;
  dbSizeMb?: number;
  queuePending?: number;
  webhookSuccessRate?: number;
}
