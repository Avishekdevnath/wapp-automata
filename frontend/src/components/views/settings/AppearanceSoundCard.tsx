import React from 'react';
import { Palette, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { useUI } from '../../../context/UIContext';

export const AppearanceSoundCard: React.FC = () => {
  const {
    isDarkMode,
    setThemeMode,
    isSoundOn,
    toggleSound,
    routePageSize,
    setRoutePageSize,
  } = useUI();

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900/60 shadow-md dark:shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
              Appearance & Display Settings
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Theme mode, rate sheets pagination, and sovereign nuance
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-[#006a4e]/20 text-emerald-800 dark:text-emerald-300 border border-[#006a4e]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f42a41] inline-block animate-pulse" />
          BD
        </span>
      </div>

      <div className="space-y-3.5 text-xs">
        {/* Theme Radios */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
            Terminal Theme Mode
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                isDarkMode
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                  : 'border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950/60 opacity-70 hover:opacity-100'
              }`}
            >
              <Moon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold block text-slate-900 dark:text-white">Dark Terminal</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-400">Obsidian & Neon Green</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                !isDarkMode
                  ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                  : 'border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-950/60 opacity-70 hover:opacity-100'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <span className="font-bold block text-slate-900 dark:text-white">Light Mode</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-400">Eye-Soothing Slate (AAA)</span>
              </div>
            </button>
          </div>
        </div>

        {/* Table Page Size Preference */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
          <div>
            <span className="font-semibold text-slate-900 dark:text-white block">
              Route Matrix Page Size
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400">
              Default rows rendered per table page
            </span>
          </div>
          <select
            value={routePageSize}
            onChange={(e) => setRoutePageSize(Number(e.target.value))}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-dark-900 border border-slate-300 dark:border-dark-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
          >
            <option value={15}>15 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>

        {/* Audio Alert Preference */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
          <div>
            <span className="font-semibold text-slate-900 dark:text-white block">
              Inbound Audio Chimes
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400">
              Play audio chime on live route capture
            </span>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              isSoundOn
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-slate-200 dark:bg-dark-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-dark-700'
            }`}
          >
            {isSoundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{isSoundOn ? 'Enabled' : 'Muted'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
