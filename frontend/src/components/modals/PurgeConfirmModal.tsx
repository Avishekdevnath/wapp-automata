import React, { useState } from 'react';
import { Trash2, X, Loader2, ShieldCheck } from 'lucide-react';

interface PurgeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (percentage?: number) => Promise<boolean>;
}

const PERCENTAGE_OPTIONS = [
  { value: 25, label: 'Oldest 25%', subtitle: 'Light trim' },
  { value: 50, label: 'Oldest 50%', subtitle: 'Balanced' },
  { value: 80, label: 'Oldest 80%', subtitle: 'Deep clean' },
  { value: 100, label: 'All (100%)', subtitle: 'Wipe log' },
];

export const PurgeConfirmModal: React.FC<PurgeConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [selectedPercentage, setSelectedPercentage] = useState<number>(50);
  const [purging, setPurging] = useState(false);

  if (!isOpen) return null;

  const handlePurge = async () => {
    setPurging(true);
    try {
      const ok = await onConfirm(selectedPercentage);
      if (ok) onClose();
    } finally {
      setPurging(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden select-text transition-colors flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
            <Trash2 className="w-4 h-4 pointer-events-none" />
            <span>Selective Message Pruning & Storage</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Select Prune Volume (Oldest First):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PERCENTAGE_OPTIONS.map((opt) => {
                const isSelected = selectedPercentage === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedPercentage(opt.value)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? opt.value === 100
                          ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 font-bold shadow-xs'
                          : 'bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xs">{opt.label}</span>
                    <span className="text-[10px] opacity-75 mt-0.5">{opt.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Scope Note */}
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
            {selectedPercentage === 100 ? (
              <span className="text-rose-700 dark:text-rose-400 font-medium">
                ⚠️ Will wipe 100% of raw chat messages from the stream viewer buffer.
              </span>
            ) : (
              <span>
                Will delete the oldest <strong className="text-emerald-600 dark:text-emerald-400">{selectedPercentage}%</strong> of raw messages, keeping the newest <strong className="text-emerald-600 dark:text-emerald-400">{100 - selectedPercentage}%</strong> in your live stream.
              </span>
            )}
          </div>

          {/* Permanent Trade Intelligence Guarantee */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-900 dark:text-emerald-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 pointer-events-none" />
            <div className="text-[11px] leading-relaxed">
              <strong className="block text-emerald-950 dark:text-emerald-200 font-bold">
                🔒 Permanent Trade Intelligence Protected
              </strong>
              Extracted route offers, rate matrix rows, vendor contacts, and market news live in separate dedicated tables and will <span className="font-bold underline">NEVER</span> be deleted by this cleanup.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={purging}
            className="h-9 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-medium flex items-center transition-colors cursor-pointer disabled:opacity-50"
            title="Cancel prune operation"
          >
            <span>Cancel</span>
          </button>

          <button
            type="button"
            onClick={handlePurge}
            disabled={purging}
            className={`h-9 px-4 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 text-white ${
              selectedPercentage === 100
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            }`}
            title="Confirm selective prune"
          >
            {purging ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin pointer-events-none" />
                <span>Pruning Database...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                <span>
                  {selectedPercentage === 100
                    ? 'Purge All Raw Messages'
                    : `Prune Oldest ${selectedPercentage}%`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
