import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2, ShieldAlert } from 'lucide-react';
import type { DeviceStatus } from '../../types/status';
import { wipeAccountAndAllData } from '../../api/client';

interface WipeAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWiped: () => void;
  deviceStatus: DeviceStatus;
}

export const WipeAccountModal: React.FC<WipeAccountModalProps> = ({
  isOpen,
  onClose,
  onWiped,
  deviceStatus,
}) => {
  const [isWiping, setIsWiping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleWipe = async () => {
    setIsWiping(true);
    setError(null);
    try {
      const res = await wipeAccountAndAllData();
      if (res.success) {
        // Dispatch UI update events to immediately clear all badges & caches
        window.dispatchEvent(new CustomEvent('wapp:account-changed'));
        window.dispatchEvent(new CustomEvent('wapp:routes-changed'));
        window.dispatchEvent(new CustomEvent('wapp:vendors-changed'));
        window.dispatchEvent(new CustomEvent('wapp:news-changed'));
        window.dispatchEvent(new CustomEvent('wapp:storage-changed'));
        onWiped();
        onClose();
      } else {
        setError(res.message || 'Failed to wipe account and data');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error while wiping account');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-2xl shadow-2xl overflow-hidden select-text transition-colors flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-dark-800 flex items-center justify-between bg-rose-50/60 dark:bg-rose-950/20">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
            <ShieldAlert className="w-4 h-4 pointer-events-none" />
            <span>Wipe Account & Delete All Content</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isWiping}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-800 dark:text-rose-200 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-bold">
                Are you completely sure you want to wipe this account?
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                This action is <strong>irreversible</strong>. It will perform a complete factory wipe:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                <li>Log out & delete the WhatsApp multi-device authentication keys</li>
                <li>Delete all captured messages, sender profiles & group maps</li>
                <li>Delete all parsed wholesale routes & intelligence news</li>
                <li>Delete all carrier directory profiles & downloaded media</li>
              </ul>
            </div>
          </div>

          {/* Account Details Box */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 text-xs space-y-1 font-mono text-slate-700 dark:text-slate-300">
            <div>
              <strong>Active Account:</strong> {deviceStatus.phone || 'Connected Socket'}
            </div>
            <div>
              <strong>Status:</strong>{' '}
              <span className="uppercase text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {deviceStatus.status}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans pt-1">
              Once wiped, you will immediately receive a fresh QR code / pairing code to link from scratch.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-dark-800 flex items-center justify-end gap-2.5 bg-slate-50 dark:bg-dark-950">
          <button
            type="button"
            onClick={onClose}
            disabled={isWiping}
            className="btn btn-secondary btn-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleWipe}
            disabled={isWiping}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isWiping ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Wiping Everything...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Wipe Account & All Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
