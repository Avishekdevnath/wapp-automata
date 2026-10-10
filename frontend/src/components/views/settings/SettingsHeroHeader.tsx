import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { SettingsStats } from '../../../api/client';
import { TelciaLogo } from '../../common/TelciaLogo';

interface SettingsHeroHeaderProps {
  stats: SettingsStats | null;
  isRefreshingStats: boolean;
  onRefresh: () => void;
}

export const SettingsHeroHeader: React.FC<SettingsHeroHeaderProps> = ({
  stats,
  isRefreshingStats,
  onRefresh,
}) => {
  return (
    <div className="glass-card p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900/60 shadow-md dark:shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <TelciaLogo size="md" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Terminal Settings & Control Center
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                Carrier Admin
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Manage carrier WhatsApp connections, access credentials, sidebar layout, themes, and data deletion.
            </p>
          </div>
        </div>

        {/* Quick Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshingStats}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 self-start sm:self-auto"
            title="Refresh Live Database & Storage Counts"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${
                isRefreshingStats ? 'animate-spin' : ''
              }`}
            />
            <span className="text-xs font-semibold">Refresh Stats</span>
          </button>
        </div>
      </div>

      {/* Live Telemetry Badges Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-200 dark:border-dark-800/80">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
            Active Routes
          </span>
          <span className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5 block">
            {stats?.counts ? Number(stats.counts.routes).toLocaleString() : '0'}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
            AI Tasks
          </span>
          <span className="text-base font-extrabold font-mono text-purple-700 dark:text-purple-400 mt-0.5 block">
            {stats?.counts ? Number(stats.counts.aiTasks).toLocaleString() : '0'}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
            Telco Outages
          </span>
          <span className="text-base font-extrabold font-mono text-rose-700 dark:text-rose-400 mt-0.5 block">
            {stats?.counts ? Number(stats.counts.news).toLocaleString() : '0'}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
            Vendors
          </span>
          <span className="text-base font-extrabold font-mono text-amber-700 dark:text-amber-400 mt-0.5 block">
            {stats?.counts ? Number(stats.counts.vendors).toLocaleString() : '0'}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
            Disk Space
          </span>
          <span className="text-base font-extrabold font-mono text-sky-700 dark:text-sky-400 mt-0.5 block">
            {stats?.storage?.disk ? `${stats.storage.disk.usedPercent}% Used` : '—'}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
            Media Cache
          </span>
          <span className="text-base font-extrabold font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
            {stats?.storage?.media ? `${stats.storage.media.totalSizeMb} MB` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};
