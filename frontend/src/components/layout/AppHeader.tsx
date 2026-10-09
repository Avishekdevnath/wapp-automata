import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  ChevronDown,
  Bot,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Settings,
  Keyboard,
  Lock,
  Building2,
  Plus,
  Check
} from 'lucide-react';
import type { ViewType } from './AppSidebar';
import type { DeviceStatus } from '../../types/status';
import { useUI } from '../../context/UIContext';
import { useAccount } from '../../context/AccountContext';
import { cleanPhone } from '../../utils/formatters';

interface AppHeaderProps {
  activeView: ViewType;
  deviceStatus: DeviceStatus;
  onToggleSidebar: () => void;
  onOpenDeviceModal: () => void;
  onOpenAiSettingsModal: () => void;
  onOpenShortcutsModal: () => void;
  onSwitchView: (view: ViewType) => void;
  onLogout: () => void;
}

const VIEW_METADATA: Record<ViewType, { title: string; sub: string }> = {
  routes: {
    title: 'Route Matrix & Rate Sheet',
    sub: 'Filter, compare, and knock carriers for active wholesale voice routes',
  },
  trends: {
    title: 'Market Trends & Price Charts',
    sub: 'Historical rate fluctuations and carrier liquidity analysis',
  },
  insights: {
    title: 'AI Insights & Arbitrage Signals',
    sub: 'Real-time spread detection between buying bids and selling offers',
  },
  news: {
    title: 'Telco News & Outage Alerts',
    sub: 'Carrier network alerts, fiber cuts, and regulatory updates',
  },
  vendors: {
    title: 'Carriers & Vendors Directory',
    sub: 'Verified carrier desks, ASN profiles, and WhatsApp traders',
  },
  terminal: {
    title: 'Live WhatsApp Stream',
    sub: 'Zero-loss carrier broadcast ingestion and live wholesale stream',
  },
  pipeline: {
    title: 'System Pipeline & AI Inspector',
    sub: 'Ingestion queue health, SQLite durability, and AI extraction logs',
  },
  dev: {
    title: 'Developer Studio & API Lab',
    sub: 'Webhook simulator, REST endpoints test bench, and developer tools',
  },
  settings: {
    title: 'Terminal Settings & Gateway',
    sub: 'WhatsApp Multi-Device authentication, storage, and retention',
  },
  help: {
    title: 'Client Knowledge Base & Help Concierge',
    sub: 'Step-by-step guides, pairing wait times, multi-desk setup, and AI RAG assistance',
  },
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeView,
  deviceStatus,
  onToggleSidebar,
  onOpenDeviceModal,
  onOpenAiSettingsModal,
  onOpenShortcutsModal,
  onSwitchView,
  onLogout,
}) => {
  const { isDarkMode, toggleTheme, isSoundOn, toggleSound } = useUI();
  const { accounts, activeAccountId, activeAccount, switchAccount, createDesk, isSwitching } = useAccount();
  const [isDeskDropdownOpen, setIsDeskDropdownOpen] = useState(false);
  const deskDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deskDropdownRef.current && !deskDropdownRef.current.contains(e.target as Node)) {
        setIsDeskDropdownOpen(false);
      }
    };
    if (isDeskDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDeskDropdownOpen]);

  const meta = VIEW_METADATA[activeView] || VIEW_METADATA.routes;
  const isLinked = deviceStatus.connected || deviceStatus.status === 'authenticated';
  const displayPhone = isLinked && deviceStatus.phone ? cleanPhone(deviceStatus.phone) : (isLinked ? 'Linked' : 'Unlinked');

  return (
    <header className="shrink-0 z-20 border-b border-slate-200 dark:border-dark-700/80 bg-white/95 dark:bg-dark-950/90 backdrop-blur-xl transition-colors">
      <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Left: Sidebar toggle & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="btn-icon btn-ghost text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            title="Toggle Sidebar (or '\')"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-base text-slate-900 dark:text-white tracking-tight truncate">
              {meta.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block truncate">
              {meta.sub}
            </p>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Multi-Account Desk Selector */}
          <div className="relative" ref={deskDropdownRef}>
            <button
              onClick={() => setIsDeskDropdownOpen(!isDeskDropdownOpen)}
              disabled={isSwitching}
              className="btn btn-secondary btn-sm"
              title="Switch Workspace Desk"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate max-w-[110px] hidden sm:inline">
                {activeAccount?.label || activeAccountId}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
            </button>

            {isDeskDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-dark-800 text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                  Isolated Workspace Desks ({accounts.length})
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {accounts.map((acc) => {
                    const isCurrent = acc.id === activeAccountId;
                    return (
                      <button
                        key={acc.id}
                        onClick={() => {
                          switchAccount(acc.id);
                          setIsDeskDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-dark-800 transition-colors cursor-pointer ${
                          isCurrent ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          <span className="truncate">{acc.label || acc.id}</span>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-slate-100 dark:border-dark-800 p-1">
                  <button
                    onClick={() => {
                      const name = window.prompt('Enter new desk name (e.g. Sales Desk, Support, Account 2):');
                      if (name && name.trim()) {
                        const cleanId = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                        createDesk(cleanId, name.trim());
                      }
                      setIsDeskDropdownOpen(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg flex items-center gap-2 font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Create New Desk...</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp Device Manager Trigger Pill */}
          <button
            onClick={onOpenDeviceModal}
            className="btn btn-secondary btn-sm"
            title="WhatsApp Connection Status"
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isLinked ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-700 dark:text-slate-200 font-medium font-mono text-[11px] truncate max-w-[110px] hidden sm:inline">
              {displayPhone}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
          </button>

          {/* AI Engine Settings Trigger Pill */}
          <button
            onClick={onOpenAiSettingsModal}
            className="btn btn-secondary btn-sm"
            title="Configure AI Intelligence (DeepSeek, ChatGPT, Grok)"
          >
            <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 hidden md:inline">
              DeepSeek
            </span>
          </button>

          {/* Sound Alert Toggle */}
          <button
            onClick={toggleSound}
            className="btn-icon btn-ghost text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            title="Toggle audio chime"
          >
            {isSoundOn ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn-icon btn-ghost"
            title="Switch Theme (Dark / Light)"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Settings Trigger */}
          <button
            onClick={() => onSwitchView('settings')}
            className="btn-icon btn-ghost"
            title="Terminal Settings & Gateway"
          >
            <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400 hover:text-emerald-500" />
          </button>

          {/* Keyboard Shortcuts Trigger */}
          <button
            onClick={onOpenShortcutsModal}
            className="btn-icon btn-ghost hidden md:inline-flex"
            title="Trader Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-4 h-4 text-slate-500 dark:text-slate-400 hover:text-emerald-500" />
          </button>

          {/* Lock Action */}
          <button
            onClick={onLogout}
            className="btn-icon btn-ghost"
            title="Lock Terminal (Sign Out)"
          >
            <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 hover:text-rose-500" />
          </button>
        </div>
      </div>
    </header>
  );
};
