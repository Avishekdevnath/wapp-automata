import React, { useState } from 'react';
import { Smartphone, LogOut, RefreshCw, QrCode } from 'lucide-react';
import type { DeviceStatus } from '../../../types/status';
import { unlinkWhatsAppSession, restartWhatsAppSession } from '../../../api/client';

interface WhatsAppConnectionCardProps {
  deviceStatus: DeviceStatus;
  onRefreshStatus: () => void;
  onOpenDeviceModal: () => void;
  onStatsReload: () => void;
}

export const WhatsAppConnectionCard: React.FC<WhatsAppConnectionCardProps> = ({
  deviceStatus,
  onRefreshStatus,
  onOpenDeviceModal,
  onStatsReload,
}) => {
  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const isConnected = deviceStatus.connected || deviceStatus.status === 'authenticated';

  const handleUnlinkWhatsApp = async () => {
    const ok = window.confirm(
      'Log out and unlink current WhatsApp account?\n\n' +
      'To log in or connect another WhatsApp account, you must log out of this active session first.\n' +
      'All saved routes, AI tasks, and incoming chat logs will remain completely safe.'
    );
    if (!ok) return;

    setSessionActionLoading(true);
    try {
      await unlinkWhatsAppSession();
      onRefreshStatus();
      setTimeout(() => {
        onOpenDeviceModal();
      }, 1000);
    } finally {
      setSessionActionLoading(false);
    }
  };

  const handleRestartSocket = async () => {
    setSessionActionLoading(true);
    try {
      await restartWhatsAppSession();
      onRefreshStatus();
      onStatsReload();
    } finally {
      setSessionActionLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900/60 shadow-md dark:shadow-xl space-y-4 flex flex-col justify-between">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                WhatsApp Account Management
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Carrier ingestion multi-device connection & pairing
              </p>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isConnected
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
            }`}
          >
            {isConnected ? 'Connected (Active)' : 'QR Scan Required'}
          </span>
        </div>

        {/* Connection Details Box */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Linked WhatsApp Number:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {deviceStatus.phone || (isConnected ? 'Connected' : 'Unlinked')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Profile Name / Platform:</span>
            <span className="font-medium text-slate-800 dark:text-slate-300">
              {deviceStatus.platform || 'Baileys Multi-Device Socket'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Connection Engine:</span>
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              Multi-Device Webhook Bridge
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-slate-200 dark:border-dark-800/80 flex flex-wrap items-center gap-2.5">
        <button
          onClick={handleUnlinkWhatsApp}
          disabled={sessionActionLoading}
          className="btn btn-danger btn-sm text-xs font-semibold flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out Current Account & Link Another</span>
        </button>
        <button
          onClick={handleRestartSocket}
          disabled={sessionActionLoading}
          className="btn btn-secondary btn-sm text-xs font-medium flex items-center gap-1.5"
          title="Restart WebSocket without clearing auth credentials"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Restart Socket</span>
        </button>
        <button
          onClick={onOpenDeviceModal}
          className="btn btn-secondary btn-sm text-xs font-medium flex items-center gap-1.5"
          title="Open QR Code Scanner"
        >
          <QrCode className="w-3.5 h-3.5 text-amber-500" />
          <span>Show QR / Pair Modal</span>
        </button>
      </div>
    </div>
  );
};
