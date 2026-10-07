import React from 'react';
import { useUI } from '../context/UIContext';
import { BangladeshRibbon } from '../components/layout/BangladeshRibbon';
import { AppSidebar } from '../components/layout/AppSidebar';
import { AppHeader } from '../components/layout/AppHeader';
import { AuthOverlay } from '../components/modals/AuthOverlay';
import type { StreamStats } from '../types/message';
import type { DeviceStatus } from '../types/status';

interface RootLayoutProps {
  children: React.ReactNode;
  stats: StreamStats;
  deviceStatus: DeviceStatus;
}

export const RootLayout: React.FC<RootLayoutProps> = ({
  children,
  stats,
  deviceStatus,
}) => {
  const {
    activeView,
    switchView,
    isSidebarOpen,
    toggleSidebar,
    isMobileSidebarOpen,
    closeMobileSidebar,
    openModal,
    isAuthenticated,
    setAuthenticated,
    logout,
  } = useUI();

  const isTerminalView = activeView === 'terminal';

  return (
    <div className="h-screen h-[100dvh] overflow-hidden bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white transition-colors">
      {/* 1. Sovereign 2.5px Micro-Accent Ribbon */}
      <BangladeshRibbon />

      {/* 2. Authentication Gate (Overlay) */}
      {!isAuthenticated && (
        <AuthOverlay onSuccess={() => setAuthenticated(true)} />
      )}

      {/* 3. Main Workspace Shell */}
      <div id="main-app" className="flex-1 flex h-full overflow-hidden">
        {/* Responsive Left Sidebar */}
        {isSidebarOpen && (
          <AppSidebar
            activeView={activeView}
            onSwitchView={switchView}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={closeMobileSidebar}
            onOpenDeviceModal={() => openModal('device')}
            onOpenStorageModal={() => openModal('storage')}
            stats={stats}
            deviceStatus={deviceStatus}
          />
        )}

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-100/60 dark:bg-dark-900/40 transition-colors">
          {/* Top Header */}
          <AppHeader
            activeView={activeView}
            deviceStatus={deviceStatus}
            onToggleSidebar={toggleSidebar}
            onOpenDeviceModal={() => openModal('device')}
            onOpenAiSettingsModal={() => openModal('ai-settings')}
            onOpenShortcutsModal={() => openModal('shortcuts')}
            onSwitchView={switchView}
            onLogout={logout}
          />

          {/* Page Content Slot (Children) */}
          {isTerminalView ? (
            <main
              className="flex-1 overflow-hidden w-full p-2 sm:p-4 flex flex-col min-h-0"
              id="main-content-scroll"
            >
              <div className="w-full h-full flex flex-col min-h-0 flex-1">
                {children}
              </div>
            </main>
          ) : (
            <main
              className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8"
              id="main-content-scroll"
            >
              <div className="max-w-7xl mx-auto space-y-6">
                {children}
              </div>
            </main>
          )}
        </div>
      </div>
    </div>
  );
};
