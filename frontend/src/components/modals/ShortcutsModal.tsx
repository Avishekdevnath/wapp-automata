import React from 'react';
import { Keyboard, X, Info } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-modal win-window max-w-md w-full rounded-2xl p-5 border border-slate-200 dark:border-dark-700 shadow-2xl space-y-4 relative bg-white dark:bg-dark-950/95 transition-colors"
      >
        {/* Title bar */}
        <div className="win-titlebar flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-700 select-none">
          <div className="flex items-center gap-2 pointer-events-none">
            <Keyboard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">Trader Keyboard Shortcuts</h3>
          </div>
          <div className="flex items-center gap-1.5 win-controls">
            <div className="relative group/info">
              <button
                type="button"
                className="win-btn p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
                title="Keyboard navigation shortcuts info"
              >
                <Info className="w-3.5 h-3.5 pointer-events-none" />
              </button>
              <div className="absolute top-full right-0 mt-1.5 hidden group-hover/info:block z-50 pointer-events-none w-64 max-w-[calc(100vw-4rem)]">
                <div className="px-3 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 text-white text-[11px] font-medium whitespace-normal break-words leading-relaxed text-left shadow-2xl border border-slate-700">
                  Keyboard Shortcuts • Quick number keys 1–8 for instant navigation, ESC to close
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

        <div className="space-y-3 text-xs">
          {/* Global Navigation 1-8 */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Global Navigation (1–8)
            </span>
            <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Route Matrix</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">1</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Market Trends</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">2</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>AI Insights</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-amber-600 dark:text-amber-400 font-bold">3</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Telco News</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-rose-600 dark:text-rose-400 font-bold">4</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Carriers</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-purple-600 dark:text-purple-400 font-bold">5</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Live Stream</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">6</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Pipeline AI</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-purple-600 dark:text-purple-400 font-bold">7</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Dev Studio</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-sky-600 dark:text-sky-400 font-bold">8</kbd>
              </div>
            </div>
          </div>

          {/* Terminal Controls */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Terminal Controls
            </span>
            <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Toggle sidebar navigation</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-sky-600 dark:text-sky-400 font-bold">\ or Ctrl+B</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Focus active view search bar</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-amber-600 dark:text-amber-400 font-bold">/</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Close modal / Clear search focus</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">Esc</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-dark-950 border border-slate-200/80 dark:border-dark-800">
                <span>Show keyboard shortcuts cheat sheet</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">?</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
