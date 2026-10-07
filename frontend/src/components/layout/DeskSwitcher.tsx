import React from 'react';
import { useAccount } from '../../context/AccountContext';
import { Layers, ShieldCheck, Smartphone } from 'lucide-react';

export const DeskSwitcher: React.FC = () => {
  const { activeAccountId, activeAccount, fleet, isSwitching } = useAccount();

  const currentFleet = fleet.find((f) => f.accountId === activeAccountId);
  const isConnected = currentFleet?.status === 'authenticated' || activeAccountId === 'default';
  const phone = currentFleet?.phone || '+8801874819713';

  return (
    <div className="px-3 py-2 border-b border-slate-200 dark:border-dark-700/80">
      <div
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-dark-800/90 border border-slate-200/80 dark:border-dark-700 select-none shadow-xs"
        title="Dedicated Account Silo - Strict Isolation Enforced"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/20">
              <Layers className="w-3.5 h-3.5" />
            </div>
            {/* Live status dot */}
            <span
              className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-dark-900 ${
                isSwitching
                  ? 'bg-amber-400 animate-ping'
                  : isConnected
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-slate-400'
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {activeAccount?.label || `Desk ${activeAccountId}`}
              </span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
                {isConnected ? 'LIVE' : 'DESK'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
              <Smartphone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
              <span>{phone}</span>
            </p>
          </div>
        </div>

        {/* Security badge indicating isolated silo */}
        <div
          className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold"
          title="Physical SQLite Zero-Bleed Isolation: No cross-desk access allowed"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Silo</span>
        </div>
      </div>
    </div>
  );
};
