import React, { useState } from 'react';
import {
  Smartphone,
  X,
  CheckCircle2,
  LogOut,
  QrCode,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Info
} from 'lucide-react';
import type { DeviceStatus } from '../../types/status';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceStatus: DeviceStatus;
  onRefresh: () => void;
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  isOpen,
  onClose,
  deviceStatus,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'code'>('qr');
  const [phoneInput, setPhoneInput] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetch('/api/session/refresh', { method: 'POST' }).catch(() => {});
      await onRefresh();
    } catch (err) {
      console.warn('Failed to refresh pairing state:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 700);
    }
  };

  if (!isOpen) return null;

  const isConnected = deviceStatus.connected || deviceStatus.status === 'authenticated';
  const displayPhone = deviceStatus.phone || (isConnected ? 'Connected' : 'Unlinked');

  const handleRequestPairCode = async () => {
    setCodeLoading(true);
    setCodeError(null);
    try {
      const res = await fetch('/api/session/pair-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const data = await res.json();
      if (data.pairingCode) {
        setPairingCode(data.pairingCode);
      } else {
        setCodeError(data.error || 'Failed to retrieve pairing code.');
      }
    } catch {
      setCodeError('Failed to connect to server.');
    } finally {
      setCodeLoading(false);
    }
  };

  const handleResetSession = async () => {
    if (!confirm('Are you sure you want to unlink and reset the WhatsApp session?')) return;
    setIsResetting(true);
    try {
      await fetch('/api/session/reset', { method: 'POST' });
      onRefresh();
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-modal win-window max-w-md w-full rounded-2xl p-5 border border-slate-200 dark:border-dark-700 shadow-2xl space-y-4 text-center relative bg-white/95 dark:bg-dark-950/95 transition-colors"
      >
        {/* Title bar */}
        <div className="win-titlebar flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-700 select-none">
          <div className="flex items-center gap-2 pointer-events-none">
            <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">WhatsApp Companion Device</h3>
          </div>
          <div className="flex items-center gap-1.5 win-controls">
            <div className="relative group/info">
              <button
                type="button"
                className="win-btn p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-dark-800 transition-colors cursor-pointer"
                title="Companion device status info"
              >
                <Info className="w-3.5 h-3.5 pointer-events-none" />
              </button>
              <div className="absolute top-full right-0 mt-1.5 hidden group-hover/info:flex flex-col items-end z-50 pointer-events-none">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap shadow-xl border border-slate-700 max-w-xs">
                  WhatsApp Multi-Device Companion • Link active account via QR or pairing code
                </div>
              </div>
            </div>
            <button
              type="button"
              className="win-btn win-btn-close p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-dark-800 transition-colors cursor-pointer"
              title="Close dialog"
              onClick={onClose}
            >
              <X className="w-3.5 h-3.5 pointer-events-none" />
            </button>
          </div>
        </div>

        {/* 1. Connected State */}
        {isConnected ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">WhatsApp Account Active</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your phone is linked 24/7 to the collector daemon.</p>
            </div>

            <div className="bg-slate-50 dark:bg-dark-900 rounded-2xl p-4 border border-slate-200 dark:border-dark-800 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Linked Phone:</span>
                <span className="text-slate-900 dark:text-white font-mono font-semibold">{displayPhone}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Account Name:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">
                  {deviceStatus.pushName || 'WhatsApp Account'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Connection Mode:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Multi-Device Companion</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleResetSession}
                disabled={isResetting}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 dark:bg-dark-800 dark:hover:bg-rose-900/30 dark:text-rose-300 dark:border-dark-700 dark:hover:border-rose-500/40 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                title="Switch or log out active WhatsApp account"
              >
                {isResetting ? <Loader2 className="w-4 h-4 animate-spin pointer-events-none" /> : <LogOut className="w-4 h-4 pointer-events-none" />}
                <span>Log Out</span>
              </button>
            </div>
          </div>
        ) : (
          /* 2. QR / Phone Code Dual Mode Selection */
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Link WhatsApp Account</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose your preferred pairing method below.</p>
            </div>

            {/* Pairing Method Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-800 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('qr')}
                className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'qr'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Code</span>
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'code'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Phone Code</span>
              </button>
            </div>

            {/* METHOD 1: QR CODE VIEW */}
            {activeTab === 'qr' && (
              <div className="space-y-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 dark:border-dark-700 flex items-center justify-center min-h-[240px] max-w-[250px] mx-auto shadow-lg">
                  {deviceStatus.qrCode ? (
                    <img
                      src={deviceStatus.qrCode}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="text-xs text-slate-700 flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                      <span>Generating fresh pairing QR code...</span>
                    </div>
                  )}
                </div>

                {/* 3 Step Instructions */}
                <div className="text-left text-xs space-y-2 bg-slate-50 dark:bg-dark-900 p-4 rounded-xl border border-slate-200 dark:border-dark-800 text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                    <span>Open <strong>WhatsApp</strong> on your phone</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                    <span>Tap <strong>Settings</strong> (iOS) or <strong>⋮</strong> (Android) → <strong>Linked Devices</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                    <span>Tap <strong>Link a Device</strong> and point camera at this QR code</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <span>Refreshes automatically (~20s)</span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 font-medium cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 pointer-events-none ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* METHOD 2: 8-DIGIT PAIRING CODE VIEW */}
            {activeTab === 'code' && (
              <div className="space-y-3">
                <div className="p-4 bg-slate-50 dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-dark-800 space-y-3 text-left">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Enter WhatsApp Phone Number:</label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+1234567890"
                      className="flex-1 bg-white dark:bg-dark-950 border border-slate-200 dark:border-dark-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleRequestPairCode}
                      disabled={codeLoading}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {codeLoading ? 'Requesting...' : 'Pair'}
                    </button>
                  </div>

                  {codeError && (
                    <p className="text-[11px] text-rose-500 dark:text-rose-400">{codeError}</p>
                  )}

                  {pairingCode && (
                    <div className="pt-2 text-center space-y-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Enter this 8-digit code on your WhatsApp phone:</p>
                      <div className="flex items-center justify-center gap-2">
                        <div className="text-xl sm:text-2xl font-mono font-bold tracking-widest text-emerald-600 dark:text-emerald-400 bg-white dark:bg-dark-950 px-5 py-2.5 rounded-xl border border-emerald-500/40 select-all shadow-xs">
                          {pairingCode}
                        </div>
                        <button
                          onClick={handleCopyCode}
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-dark-700"
                          title="Copy code"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Steps for Phone Code */}
                <div className="text-left text-xs space-y-2 bg-slate-50 dark:bg-dark-900 p-4 rounded-xl border border-slate-200 dark:border-dark-800 text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                    <span>Open <strong>WhatsApp</strong> → <strong>Linked Devices</strong> → <strong>Link a Device</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                    <span>Tap <strong>"Link with phone number instead"</strong> at bottom</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                    <span>Enter the 8-digit code shown above to connect instantly</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
