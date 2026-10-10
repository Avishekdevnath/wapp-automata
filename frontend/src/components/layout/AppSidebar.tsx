import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Radio,
  Table,
  TrendingUp,
  Sparkles,
  Newspaper,
  Users,
  Cpu,
  Code2,
  Settings,
  QrCode,
  HardDrive,
  MessageSquare,
  HelpCircle,
  X
} from 'lucide-react';
import type { StreamStats } from '../../types/message';
import type { DeviceStatus } from '../../types/status';
import { fetchSidebarCounts, fetchSettingsStats, type SidebarCounts } from '../../api/client';
import { useUI } from '../../context/UIContext';

export type ViewType =
  | 'routes'
  | 'trends'
  | 'insights'
  | 'news'
  | 'vendors'
  | 'terminal'
  | 'pipeline'
  | 'dev'
  | 'settings'
  | 'help';

interface AppSidebarProps {
  activeView: ViewType;
  onSwitchView: (view: ViewType) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenDeviceModal: () => void;
  onOpenStorageModal: () => void;
  stats: StreamStats;
  deviceStatus: DeviceStatus;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeView,
  onSwitchView,
  isMobileOpen,
  onCloseMobile,
  onOpenDeviceModal,
  onOpenStorageModal,
  stats,
  deviceStatus,
}) => {
  const { sidebarMenuPrefs } = useUI();
  const isLinked = deviceStatus.connected || deviceStatus.status === 'authenticated';

  const [counts, setCounts] = useState<SidebarCounts>({
    routes: 0,
    news: 0,
    vendors: 0,
  });
  const [diskPercent, setDiskPercent] = useState<number>(12);

  const loadCounts = useCallback(async () => {
    try {
      const [sidebarCounts, settingsStats] = await Promise.allSettled([
        fetchSidebarCounts(),
        fetchSettingsStats(),
      ]);

      if (sidebarCounts.status === 'fulfilled') {
        const data = sidebarCounts.value;
        setCounts((prev) => {
          if (prev.routes === data.routes && prev.news === data.news && prev.vendors === data.vendors) {
            return prev;
          }
          return data;
        });
      }

      if (
        settingsStats.status === 'fulfilled' &&
        settingsStats.value?.storage?.disk?.usedPercent !== undefined
      ) {
        setDiskPercent(Math.round(settingsStats.value.storage.disk.usedPercent));
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadCounts();
    const timer = setInterval(loadCounts, 8000);
    const handleRefresh = () => {
      loadCounts();
    };
    window.addEventListener('wapp:account-changed', handleRefresh);
    window.addEventListener('wapp:news-changed', handleRefresh);
    window.addEventListener('wapp:routes-changed', handleRefresh);
    window.addEventListener('wapp:vendors-changed', handleRefresh);
    window.addEventListener('wapp:storage-changed', handleRefresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('wapp:account-changed', handleRefresh);
      window.removeEventListener('wapp:news-changed', handleRefresh);
      window.removeEventListener('wapp:routes-changed', handleRefresh);
      window.removeEventListener('wapp:vendors-changed', handleRefresh);
      window.removeEventListener('wapp:storage-changed', handleRefresh);
    };
  }, [loadCounts]);

  // Immediately refresh badge counts whenever switching views
  useEffect(() => {
    loadCounts();
  }, [activeView, loadCounts]);

  const formatCompactCount = (count: number | string | undefined): string => {
    if (count === undefined || count === null) return '0';
    const num = typeof count === 'number' ? count : Number(count);
    if (isNaN(num)) return String(count);
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (num > 999) {
      return `${Math.floor(num / 1000)}k`;
    }
    return String(num);
  };

  const navItems = [
    {
      id: 'routes' as ViewType,
      path: '/routes',
      label: 'Route Matrix',
      icon: Table,
      iconColor: 'text-emerald-400',
      badge: formatCompactCount(counts.routes ?? 0),
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'trends' as ViewType,
      path: '/trends',
      label: 'Market Trends',
      icon: TrendingUp,
      iconColor: 'text-blue-400',
      badge: 'Charts',
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'insights' as ViewType,
      path: '/insights',
      label: 'AI Insights',
      icon: Sparkles,
      iconColor: 'text-amber-400',
      badge: 'Signals',
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400',
    },
    {
      id: 'news' as ViewType,
      path: '/news',
      label: 'Telco News',
      icon: Newspaper,
      iconColor: 'text-rose-400',
      badge: formatCompactCount(counts.news ?? 0),
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400',
    },
    {
      id: 'vendors' as ViewType,
      path: '/vendors',
      label: 'Carriers & Vendors',
      icon: Users,
      iconColor: 'text-purple-400',
      badge: formatCompactCount(counts.vendors ?? 0),
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400',
    },
    {
      id: 'terminal' as ViewType,
      path: '/stream',
      label: 'Live Messages Stream',
      icon: Radio,
      iconColor: 'text-emerald-400 animate-pulse',
      badge: formatCompactCount(stats.total || 0),
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'chat' as any,
      path: '/chat',
      label: 'WhatsApp Web UI',
      icon: MessageSquare,
      iconColor: 'text-emerald-400',
      badge: formatCompactCount(stats.total || 0),
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      isExternal: true,
    },
    {
      id: 'pipeline' as ViewType,
      path: '/pipeline',
      label: 'System Pipeline',
      icon: Cpu,
      iconColor: 'text-purple-400',
      badge: 'Live AI',
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-600 dark:text-purple-300 uppercase',
    },
    {
      id: 'dev' as ViewType,
      path: '/dev',
      label: 'Developer Studio',
      icon: Code2,
      iconColor: 'text-sky-400',
      badge: 'API',
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-600 dark:text-sky-400',
    },
    {
      id: 'settings' as ViewType,
      path: '/settings',
      label: 'Settings & Config',
      icon: Settings,
      iconColor: 'text-emerald-400',
      badge: 'Admin',
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-500/20 text-slate-600 dark:text-slate-400',
    },
    {
      id: 'help' as ViewType,
      path: '/help',
      label: 'Help & Knowledge',
      icon: HelpCircle,
      iconColor: 'text-amber-400',
      badge: 'Guide',
      badgeClass: 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300',
    },
  ];

  return (
    <>
      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden transition-opacity"
        />
      )}

      {/* RESPONSIVE SIDEBAR */}
      <aside
        id="app-sidebar"
        className={`fixed md:relative md:static inset-y-0 left-0 z-40 w-64 h-full bg-white dark:bg-dark-900 border-r border-slate-200 dark:border-dark-700/80 flex flex-col justify-between shrink-0 overflow-y-auto transform transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Branding */}
        <div>
          <div className="h-16 px-5 border-b border-slate-200 dark:border-dark-700/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Telcia"
                className="w-10 h-10 rounded-xl object-cover shadow-md shadow-emerald-950/20 shrink-0 border border-emerald-500/30"
                title="TELCIA • Telecom Cognitive Intelligent Agent"
              />

              <div className="sidebar-brand-text">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-base tracking-tight text-slate-950 dark:text-white block">
                    Telcia
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30" title="Telecom Cognitive Intelligent Agent">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f42a41] inline-block animate-pulse" />
                    AGENT
                  </span>
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-700 dark:text-emerald-400 block mt-0.5" title="Telecom Cognitive Intelligent Agent">
                  Cognitive Intelligence
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition-colors md:hidden"
              title="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

            {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems
              .filter((item) => item.id === 'settings' || sidebarMenuPrefs[item.id] !== false)
              .map((item) => {
              const Icon = item.icon;
              if ((item as any).isExternal) {
                return (
                  <a
                    key={item.id}
                    href={item.path}
                    className="sidebar-nav-btn w-full px-3 py-2.5 rounded-xl font-medium text-xs flex items-center justify-between transition-all hover:bg-slate-100 dark:hover:bg-dark-800"
                    title="Open Authentic WhatsApp Web Interface"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${item.iconColor}`} />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </div>
                    <span className={`${item.badgeClass} shrink-0`}>{item.badge}</span>
                  </a>
                );
              }
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={() => {
                    onSwitchView(item.id);
                    onCloseMobile();
                  }}
                  className={({ isActive }) =>
                    `sidebar-nav-btn w-full px-3 py-2.5 rounded-xl font-medium text-xs flex items-center justify-between transition-all ${
                      isActive ? 'active' : ''
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${item.iconColor}`} />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </div>
                  <span className={`${item.badgeClass} shrink-0`}>{item.badge}</span>
                </NavLink>
              );
            })}

            {/* Explicit Link WhatsApp Phone Action */}
            <div className="pt-2 border-t border-slate-200 dark:border-dark-800/80">
              <button
                onClick={onOpenDeviceModal}
                title="Link WhatsApp (Scan QR Code)"
                className="w-full px-3 py-2.5 rounded-xl font-medium text-xs flex items-center justify-between bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <QrCode className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span className="whitespace-nowrap">
                    {isLinked ? 'WhatsApp Linked' : 'Link WhatsApp'}
                  </span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                    isLinked
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-300 animate-pulse'
                  }`}
                >
                  {isLinked ? 'Active' : 'Scan QR'}
                </span>
              </button>
            </div>
          </nav>
        </div>

        {/* Bottom Status & System Health */}
        <div className="p-4 border-t border-slate-200 dark:border-dark-700/80 space-y-3">
          {/* Storage Health Indicator */}
          <div
            onClick={onOpenStorageModal}
            title="Storage & Cache Manager"
            className="cursor-pointer p-3 rounded-xl bg-slate-50 dark:bg-dark-950/70 border border-slate-200 dark:border-dark-800 hover:border-emerald-500 transition-colors"
          >
            <div className="sidebar-storage-details">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <HardDrive
                    className={`w-3.5 h-3.5 ${
                      diskPercent >= 90
                        ? 'text-rose-500'
                        : diskPercent >= 75
                        ? 'text-amber-500'
                        : 'text-emerald-500 dark:text-emerald-400'
                    }`}
                  />
                  <span>Disk Storage</span>
                </span>
                <span
                  className={`font-mono font-semibold ${
                    diskPercent >= 90
                      ? 'text-rose-600 dark:text-rose-400'
                      : diskPercent >= 75
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {diskPercent}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-dark-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    diskPercent >= 90
                      ? 'bg-rose-500'
                      : diskPercent >= 75
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(3, diskPercent))}%` }}
                />
              </div>
            </div>
          </div>

          <p className="sidebar-footer-text text-[10px] text-slate-500 text-center flex items-center justify-center gap-1.5">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f42a41]" />
              <span>Telcia • Bijoytel</span>
            </span>
            <span>•</span>
            <span>Hostinger KVM 2</span>
          </p>
        </div>
      </aside>
    </>
  );
};
