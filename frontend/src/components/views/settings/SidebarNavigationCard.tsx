import React from 'react';
import {
  LayoutGrid,
  Table,
  Sparkles,
  Newspaper,
  Smartphone,
  MessageSquare,
  Cpu,
} from 'lucide-react';
import { useUI } from '../../../context/UIContext';
import { ToggleSwitch } from './ToggleSwitch';

const SIDEBAR_MENUS_CONFIG = [
  { id: 'routes', name: 'Route Matrix', icon: Table, desc: 'Voice rate sheets & offers' },
  { id: 'trends', name: 'Market Trends', icon: Sparkles, desc: 'Historical price charts' },
  { id: 'insights', name: 'AI Insights', icon: Sparkles, desc: 'Arbitrage & deal signals' },
  { id: 'news', name: 'Telco News & Outages', icon: Newspaper, desc: 'Carrier maintenance notices' },
  { id: 'vendors', name: 'Carriers & Vendors', icon: Smartphone, desc: 'Wholesale contact directory' },
  { id: 'terminal', name: 'Live Messages Stream', icon: MessageSquare, desc: 'Zero-loss WhatsApp feed' },
  { id: 'pipeline', name: 'System Pipeline', icon: Cpu, desc: 'AI processing inspector' },
  { id: 'dev', name: 'Developer Studio', icon: LayoutGrid, desc: 'Webhook lab & test simulator' },
];

export const SidebarNavigationCard: React.FC = () => {
  const {
    sidebarMenuPrefs,
    toggleSidebarMenu,
    enableAllSidebarMenus,
    resetSidebarMenus,
  } = useUI();

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900/60 shadow-md dark:shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
              Sidebar Navigation Menus
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Toggle visibility of navigation items on and off
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={enableAllSidebarMenus}
            className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
          >
            Enable All
          </button>
          <span className="text-slate-400">•</span>
          <button
            onClick={resetSidebarMenus}
            className="text-[11px] text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 underline font-medium"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Menu Items Toggle Switches Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        {SIDEBAR_MENUS_CONFIG.map((menu) => {
          const Icon = menu.icon;
          const isChecked = sidebarMenuPrefs[menu.id] !== false;
          return (
            <div
              key={menu.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-slate-900 dark:text-white block text-xs truncate">
                    {menu.name}
                  </span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 block truncate">
                    {menu.desc}
                  </span>
                </div>
              </div>
              <div className="ml-2 shrink-0">
                <ToggleSwitch
                  checked={isChecked}
                  onChange={(val) => toggleSidebarMenu(menu.id, val)}
                  size="sm"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
