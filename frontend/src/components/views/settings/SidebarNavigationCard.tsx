import React from 'react';
import {
  LayoutGrid,
  Table,
  TrendingUp,
  Sparkles,
  Newspaper,
  Users,
  Radio,
  MessageSquare,
  Cpu,
  Code2,
  HelpCircle,
  Settings,
  Lock,
} from 'lucide-react';
import { useUI } from '../../../context/UIContext';
import { ToggleSwitch } from './ToggleSwitch';

interface SidebarMenuConfigItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  category: 'trading' | 'stream' | 'system';
}

const SIDEBAR_MENUS_CONFIG: SidebarMenuConfigItem[] = [
  // Wholesale & Market Intelligence
  { id: 'routes', name: 'Route Matrix', icon: Table, desc: 'Voice rate sheets & offers', category: 'trading' },
  { id: 'trends', name: 'Market Trends', icon: TrendingUp, desc: 'Historical price charts & analytics', category: 'trading' },
  { id: 'insights', name: 'AI Insights', icon: Sparkles, desc: 'Arbitrage & deal signals', category: 'trading' },
  { id: 'news', name: 'Telco News & Outages', icon: Newspaper, desc: 'Carrier maintenance notices', category: 'trading' },
  { id: 'vendors', name: 'Carriers & Vendors', icon: Users, desc: 'Wholesale contact directory', category: 'trading' },

  // Live Streams & WhatsApp
  { id: 'terminal', name: 'Live Messages Stream', icon: Radio, desc: 'Zero-loss WhatsApp feed', category: 'stream' },
  { id: 'chat', name: 'WhatsApp Web UI', icon: MessageSquare, desc: 'Direct WhatsApp chat console', category: 'stream' },

  // System & Developer
  { id: 'pipeline', name: 'System Pipeline', icon: Cpu, desc: 'AI processing inspector', category: 'system' },
  { id: 'dev', name: 'Developer Studio', icon: Code2, desc: 'Webhook lab & test simulator', category: 'system' },
  { id: 'help', name: 'Help & Knowledge', icon: HelpCircle, desc: 'User guide & system documentation', category: 'system' },
];

export const SidebarNavigationCard: React.FC = () => {
  const {
    sidebarMenuPrefs,
    toggleSidebarMenu,
    enableAllSidebarMenus,
    resetSidebarMenus,
  } = useUI();

  const visibleCount = SIDEBAR_MENUS_CONFIG.filter(
    (menu) => sidebarMenuPrefs[menu.id] !== false
  ).length;

  const handleWholesaleOnly = () => {
    SIDEBAR_MENUS_CONFIG.forEach((menu) => {
      const isTrading = menu.category === 'trading';
      toggleSidebarMenu(menu.id, isTrading);
    });
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900/60 shadow-md dark:shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-dark-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                Sidebar Navigation Menus
              </h3>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 font-mono">
                {visibleCount}/{SIDEBAR_MENUS_CONFIG.length} Active
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Toggle navigation items to keep your sidebar clean and focused
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-[11px]">
          <button
            type="button"
            onClick={enableAllSidebarMenus}
            className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 font-semibold transition-colors cursor-pointer"
            title="Show all sidebar items"
          >
            Show All
          </button>
          <button
            type="button"
            onClick={handleWholesaleOnly}
            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700 border border-slate-200 dark:border-dark-700 font-medium transition-colors cursor-pointer"
            title="Show only core wholesale rate & carrier menus"
          >
            Wholesale Core
          </button>
          <button
            type="button"
            onClick={resetSidebarMenus}
            className="px-2 py-0.5 rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:underline font-medium cursor-pointer"
            title="Reset to default menu visibility"
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
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                isChecked
                  ? 'bg-slate-50/80 dark:bg-dark-950/60 border-slate-200 dark:border-dark-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                  : 'bg-slate-100/40 dark:bg-dark-950/20 border-slate-200/50 dark:border-dark-800/40 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isChecked
                      ? 'bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-200 shadow-2xs'
                      : 'bg-slate-100 dark:bg-dark-900/40 text-slate-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <span className="font-semibold text-slate-900 dark:text-white block text-xs truncate">
                    {menu.name}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
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

        {/* Pinned Permanent Item: Settings & Config */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/50 dark:bg-dark-950/40 border border-slate-200/60 dark:border-dark-800/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-900 dark:text-white text-xs truncate">
                  Settings & Config
                </span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 dark:bg-dark-800 text-slate-600 dark:text-slate-400">
                  <Lock className="w-2.5 h-2.5" /> Pinned
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                Admin control center & diagnostics
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 px-2 select-none">
            Always On
          </span>
        </div>
      </div>
    </div>
  );
};
