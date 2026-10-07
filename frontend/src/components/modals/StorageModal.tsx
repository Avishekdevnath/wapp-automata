import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  X,
  Database,
  Trash2,
  Table,
  Cpu,
  Sparkles,
  Loader2,
  Info
} from 'lucide-react';

interface StorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDataManagement: (mode: 'routes' | 'analysis' | 'news' | 'all') => void;
}

interface StorageStats {
  diskUsedPercent: number;
  mediaCount: number;
  mediaSizeMb: number;
}

export const StorageModal: React.FC<StorageModalProps> = ({
  isOpen,
  onClose,
  onOpenDataManagement,
}) => {
  const [stats, setStats] = useState<StorageStats>({
    diskUsedPercent: 12,
    mediaCount: 3,
    mediaSizeMb: 1.4,
  });
  const [loading, setLoading] = useState(false);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/storage/status');
      if (res.ok) {
        const data = await res.json();
        setStats({
          diskUsedPercent: data.disk?.usedPercent || 12,
          mediaCount: data.media?.count || 0,
          mediaSizeMb: data.media?.sizeMb || 0,
        });
      }
    } catch {
      // Use defaults
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePurgeMedia = async (pct: number) => {
    setLoading(true);
    setPurgeMsg(null);
    try {
      const res = await fetch('/api/storage/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentage: pct }),
      });
      const data = await res.json();
      setPurgeMsg(`Purged ${data.deletedFiles || 0} media files.`);
      fetchStats();
      window.dispatchEvent(new CustomEvent('wapp:storage-changed'));
    } catch {
      setPurgeMsg('Failed to purge media.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunRetention = async () => {
    setRetentionRunning(true);
    setPurgeMsg(null);
    try {
      const res = await fetch('/api/storage/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      });
      const data = await res.json();
      setPurgeMsg(data.message || 'Retention complete. Lifetime message text preserved.');
      window.dispatchEvent(new CustomEvent('wapp:storage-changed'));
    } catch {
      setPurgeMsg('Failed to execute retention prune.');
    } finally {
      setRetentionRunning(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-modal win-window max-w-md w-full rounded-2xl border border-slate-200 dark:border-dark-700 shadow-2xl space-y-4 p-5 relative bg-white dark:bg-dark-950/95 transition-colors"
      >
        {/* Title bar */}
        <div className="win-titlebar flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-700 select-none">
          <div className="flex items-center gap-2.5 pointer-events-none">
            <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">Storage & Cache Manager</h3>
          </div>
          <div className="flex items-center gap-1.5 win-controls">
            <div className="relative group/info">
              <button
                type="button"
                className="win-btn p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
                title="Storage manager info"
              >
                <Info className="w-3.5 h-3.5 pointer-events-none" />
              </button>
              <div className="absolute top-full right-0 mt-1.5 hidden group-hover/info:flex flex-col items-end z-50 pointer-events-none">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap shadow-xl border border-slate-700 max-w-xs">
                  Storage & Cache • Disk capacity, media storage pruner, and data reset
                </div>
              </div>
            </div>
            <button
              type="button"
              className="win-btn win-btn-close p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
              title="Close dialog"
              onClick={onClose}
            >
              <X className="w-3.5 h-3.5 pointer-events-none" />
            </button>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Storage telemetry summary */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total Disk Used:</span>
              <span className="font-mono text-slate-900 dark:text-white font-semibold">{stats.diskUsedPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Media Cache Files:</span>
              <span className="font-mono text-slate-900 dark:text-white font-semibold">{stats.mediaCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Media Cache Size:</span>
              <span className="font-mono text-slate-900 dark:text-white font-semibold">{stats.mediaSizeMb} MB</span>
            </div>
          </div>

          {/* Media Cache Purge Actions */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => handlePurgeMedia(80)}
              disabled={loading}
              className="py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold inline-flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
              title="Purge oldest 80% of media files"
            >
              Purge 80%
            </button>
            <button
              onClick={() => handlePurgeMedia(100)}
              disabled={loading}
              className="py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-semibold inline-flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
              title="Purge all media files"
            >
              Purge All
            </button>
          </div>

          {purgeMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono text-center">
              {purgeMsg}
            </div>
          )}

          {/* Automated SQLite Log Retention Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 space-y-2 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-slate-900 dark:text-white text-xs">SQLite Envelope Retention</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                Active (30-60d)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Prunes raw Baileys WhatsApp JSON payloads older than 30 days and purges delivered records older than 60 days.{' '}
              <strong className="text-slate-800 dark:text-slate-200">Parsed routes & vendor contacts are preserved forever.</strong>
            </p>
            <button
              onClick={handleRunRetention}
              disabled={retentionRunning}
              className="w-full py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {retentionRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin pointer-events-none" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 pointer-events-none" />
              )}
              <span>Prune</span>
            </button>
          </div>

          {/* Trading Intelligence & Route Data Management Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 space-y-2 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span className="font-semibold text-slate-900 dark:text-white text-xs">Trading Intelligence Data</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Purge Controls
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Selectively delete Route Matrix data, AI analysis records, or outages. Inbound WhatsApp chats remain untouched.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  onClose();
                  onOpenDataManagement('routes');
                }}
                className="py-1.5 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <Table className="w-3 h-3 pointer-events-none" />
                <span>Routes</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenDataManagement('analysis');
                }}
                className="py-1.5 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <Cpu className="w-3 h-3 pointer-events-none" />
                <span>Analysis</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-slate-200 dark:border-dark-800">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 text-xs font-semibold flex items-center transition-all cursor-pointer"
            title="Close storage manager dialog"
          >
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
