import React from 'react';
import {
  Trash2,
  ShieldCheck,
  Check,
  Table,
  Sparkles,
  Cpu,
  Newspaper,
  HardDrive,
  Archive,
  AlertOctagon,
} from 'lucide-react';
import type { RetentionSettings } from '../../../api/client';

interface DataDeletionCenterProps {
  deleteFeedback: string | null;
  deleteLoadingKey: string | null;
  pendingConfirm: string | null;
  retentionDays: number;
  retentionStats: RetentionSettings | null;
  retentionLoading: boolean;
  setPendingConfirm: (val: string | null) => void;
  executeClear: (target: 'routes' | 'analysis' | 'news' | 'all') => Promise<void>;
  executeReseed: () => Promise<void>;
  executeDeleteMedia: (percentage: 80 | 100) => Promise<void>;
  handleUpdateRetention: (days: number) => Promise<void>;
  handleRunRetention: () => Promise<void>;
}

export const DataDeletionCenter: React.FC<DataDeletionCenterProps> = ({
  deleteFeedback,
  deleteLoadingKey,
  pendingConfirm,
  retentionDays,
  retentionStats,
  retentionLoading,
  setPendingConfirm,
  executeClear,
  executeReseed,
  executeDeleteMedia,
  handleUpdateRetention,
  handleRunRetention,
}) => {
  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900/60 shadow-md dark:shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-dark-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                Database & Intelligence Data Deletion Center
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                Data Lifecycle
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Selective database cleaning, benchmark resets, and storage cleanup
            </p>
          </div>
        </div>

        {/* Accidental Data Loss Badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>WhatsApp Session 100% Protected</span>
        </span>
      </div>

      {/* Local In-Place Feedback Notification Banner */}
      {deleteFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold text-xs flex items-center gap-2 shadow-xs animate-fadeIn">
          <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{deleteFeedback}</span>
        </div>
      )}

      {/* 6-Grid Modular Delete Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {/* Module 1: Route Matrix Table */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Table className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-slate-900 dark:text-white">Route Matrix Data</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">table: route_ticks</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Deletes voice offers, destination corridors, and pricing cards. Raw chats stay untouched.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-dark-800">
            {pendingConfirm === 'routes' ? (
              <div className="space-y-2 animate-fadeIn">
                <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                  ⚠️ Delete all voice offers? Raw chats stay untouched.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingConfirm(null)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-200 dark:bg-dark-800 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoadingKey === 'clear-routes'}
                    onClick={() => executeClear('routes')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                    <span className="text-white font-bold">{deleteLoadingKey === 'clear-routes' ? 'Clearing...' : 'Confirm'}</span>
                  </button>
                </div>
              </div>
            ) : pendingConfirm === 'reseed' ? (
              <div className="space-y-2 animate-fadeIn">
                <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                  ⚠️ Replace routes with authentic benchmarks?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingConfirm(null)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-200 dark:bg-dark-800 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoadingKey === 'reseed'}
                    onClick={executeReseed}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    <span className="text-white font-bold">{deleteLoadingKey === 'reseed' ? 'Reseeding...' : 'Confirm'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={deleteLoadingKey === 'clear-routes'}
                  onClick={() => setPendingConfirm('routes')}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                  <span className="text-white font-bold">{deleteLoadingKey === 'clear-routes' ? 'Clearing...' : 'Clear Routes'}</span>
                </button>
                <button
                  type="button"
                  disabled={deleteLoadingKey === 'reseed'}
                  onClick={() => setPendingConfirm('reseed')}
                  className="py-1.5 px-2.5 rounded-lg bg-white dark:bg-dark-800 hover:bg-slate-100 dark:hover:bg-dark-700 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium text-xs transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  title="Clear current and reload authentic benchmarks"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{deleteLoadingKey === 'reseed' ? 'Reseeding...' : 'Reseed'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Module 2: AI Analysis & Telemetry */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="font-bold text-slate-900 dark:text-white">AI Analysis & Telemetry</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">table: ai_tasks</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Deletes queued & completed entity extraction records, pipeline latency telemetry, and inspector traces.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-dark-800">
            {pendingConfirm === 'analysis' ? (
              <div className="space-y-2 animate-fadeIn">
                <div className="p-2 rounded-lg bg-purple-500/15 border border-purple-500/30 text-[11px] font-semibold text-purple-800 dark:text-purple-200">
                  ⚠️ Clear all AI task history & pipeline traces?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingConfirm(null)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-200 dark:bg-dark-800 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoadingKey === 'clear-analysis'}
                    onClick={() => executeClear('analysis')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                    <span className="text-white font-bold">{deleteLoadingKey === 'clear-analysis' ? 'Clearing...' : 'Confirm'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={deleteLoadingKey === 'clear-analysis'}
                onClick={() => setPendingConfirm('analysis')}
                className="w-full py-1.5 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
                <span className="text-white font-bold">{deleteLoadingKey === 'clear-analysis' ? 'Clearing...' : 'Clear AI Analysis History'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Module 3: Market News & Outages */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Newspaper className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span className="font-bold text-slate-900 dark:text-white">Carrier News & Outages</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">table: market_news</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Deletes carrier outage bulletins, fiber cut warnings, and telecom regulatory news.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-dark-800">
            {pendingConfirm === 'news' ? (
              <div className="space-y-2 animate-fadeIn">
                <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                  ⚠️ Delete all outage alerts & market news?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingConfirm(null)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-200 dark:bg-dark-800 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoadingKey === 'clear-news'}
                    onClick={() => executeClear('news')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                    <span className="text-white font-bold">{deleteLoadingKey === 'clear-news' ? 'Deleting...' : 'Confirm'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={deleteLoadingKey === 'clear-news'}
                onClick={() => setPendingConfirm('news')}
                className="w-full py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
                <span className="text-white font-bold">{deleteLoadingKey === 'clear-news' ? 'Deleting...' : 'Delete Outages & News'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Module 4: Media Downloads Cache */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="font-bold text-slate-900 dark:text-white">Media Files Cache</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">dir: data/media</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Deletes cached voice audio notes, rate sheet PDFs, and photos downloaded from WhatsApp chats.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-dark-800">
            {pendingConfirm === 'media-80' ? (
              <div className="space-y-2 animate-fadeIn">
                <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                  ⚠️ Delete the oldest 80% of cached media files?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingConfirm(null)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-200 dark:bg-dark-800 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoadingKey === 'media-80'}
                    onClick={() => executeDeleteMedia(80)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                    <span className="text-white font-bold">{deleteLoadingKey === 'media-80' ? 'Deleting...' : 'Confirm'}</span>
                  </button>
                </div>
              </div>
            ) : pendingConfirm === 'media-100' ? (
              <div className="space-y-2 animate-fadeIn">
                <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                  ⚠️ Delete 100% of cached media files? Text chats remain safe.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingConfirm(null)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-200 dark:bg-dark-800 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoadingKey === 'media-100'}
                    onClick={() => executeDeleteMedia(100)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                    <span className="text-white font-bold">{deleteLoadingKey === 'media-100' ? 'Deleting...' : 'Confirm'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={deleteLoadingKey === 'media-80'}
                  onClick={() => setPendingConfirm('media-80')}
                  className="py-1.5 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-semibold text-xs transition-all text-center cursor-pointer"
                >
                  {deleteLoadingKey === 'media-80' ? 'Deleting...' : 'Delete 80%'}
                </button>
                <button
                  type="button"
                  disabled={deleteLoadingKey === 'media-100'}
                  onClick={() => setPendingConfirm('media-100')}
                  className="py-1.5 px-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30 font-semibold text-xs transition-all text-center cursor-pointer"
                >
                  {deleteLoadingKey === 'media-100' ? 'Deleting...' : 'Delete All'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Module 5: Dynamic Chat History Retention & Cleanup */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Archive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-slate-900 dark:text-white">Chat Data Retention</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {retentionDays === 0 ? 'Unlimited' : `${retentionDays} Days`}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Raw messages are safely held up to your configured retention window or until manually cleaned.
              <span className="block mt-1 font-semibold text-emerald-800 dark:text-emerald-400">
                🔒 Route ticks, rates, & carrier intelligence are permanently isolated and never deleted.
              </span>
            </p>

            {/* Selector */}
            <div className="pt-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                Retention Window
              </label>
              <select
                disabled={retentionLoading}
                value={retentionDays}
                onChange={(e) => handleUpdateRetention(Number(e.target.value))}
                className="w-full text-xs rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 py-1.5 px-2 text-slate-900 dark:text-slate-100 font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
              >
                <option value={30}>30 Days (1 Month)</option>
                <option value={90}>90 Days (3 Months)</option>
                <option value={180}>180 Days (6 Months — Recommended)</option>
                <option value={365}>365 Days (1 Year)</option>
                <option value={0}>Unlimited (Store Indefinitely)</option>
              </select>
            </div>

            {retentionStats && (
              <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono flex items-center justify-between pt-0.5">
                <span>Raw Messages:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {retentionStats.totalMessages.toLocaleString()} records
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-dark-800 flex items-center gap-2">
            <button
              type="button"
              disabled={deleteLoadingKey === 'retention'}
              onClick={handleRunRetention}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30 font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{deleteLoadingKey === 'retention' ? 'Cleaning...' : 'Run Retention Cleanup Now'}</span>
            </button>
          </div>
        </div>

        {/* Module 6: Master Terminal Reset (Danger Zone) */}
        <div className="p-4 rounded-xl bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/30 hover:border-rose-500/50 transition-all space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-500" />
                <span className="font-bold text-rose-800 dark:text-rose-400">Master Data Reset</span>
              </div>
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">Danger</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Deletes all routes, AI history, and news across all tables simultaneously. WhatsApp link & session stay preserved.
            </p>
          </div>
          <div className="pt-2 border-t border-rose-500/20">
            {pendingConfirm === 'all' ? (
              <div className="space-y-2 animate-fadeIn">
                <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                  ⚠️ Permanent: Are you sure you want to delete all data?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingConfirm(null)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-200 dark:bg-dark-800 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoadingKey === 'clear-all'}
                    onClick={() => executeClear('all')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                    <span className="text-white font-bold">{deleteLoadingKey === 'clear-all' ? 'Resetting...' : 'Confirm Reset'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={deleteLoadingKey === 'clear-all'}
                onClick={() => setPendingConfirm('all')}
                className="w-full py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
                <span className="text-white font-bold">{deleteLoadingKey === 'clear-all' ? 'Resetting...' : 'Factory Reset All Data'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
