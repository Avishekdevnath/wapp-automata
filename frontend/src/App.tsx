import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useMessages } from './hooks/useMessages';
import { fetchDeviceStatus } from './api/client';
import type { DeviceStatus } from './types/status';
import type { RouteDetailItem } from './components/modals/RouteDetailModal';

// Next.js-style Layering
import { UIProvider } from './context/UIContext';
import { AccountProvider } from './context/AccountContext';
import { useShortcuts } from './hooks/useShortcuts';
import { RootLayout } from './layouts/RootLayout';
import { ViewDispatcher } from './components/views/ViewDispatcher';
import { ModalRoot } from './components/modals/ModalRoot';

function AppInner() {
  // 1. Activate global keyboard shortcuts
  useShortcuts();

  // 2. Data & Stream State
  const { messages, stats, refresh, deleteMessages } = useMessages();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    connected: false,
    status: 'disconnected',
  });

  const loadDeviceStatus = useCallback(async () => {
    const s = await fetchDeviceStatus();
    // Only update state if values actually changed to prevent app-wide re-renders
    setDeviceStatus((prev) => {
      if (
        prev.connected === s.connected &&
        prev.status === s.status &&
        prev.phone === s.phone &&
        prev.qrCode === s.qrCode &&
        prev.pushName === s.pushName
      ) {
        return prev;
      }
      return s;
    });
  }, []);

  useEffect(() => {
    loadDeviceStatus();
    const interval = setInterval(loadDeviceStatus, 2000);

    const handleAccountChange = () => {
      loadDeviceStatus();
    };
    window.addEventListener('wapp:account-changed', handleAccountChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('wapp:account-changed', handleAccountChange);
    };
  }, [loadDeviceStatus]);

  // 3. Post Route Handler
  const handlePostRoute = async (routeData: Partial<RouteDetailItem>) => {
    try {
      const res = await fetch('/api/routes/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  return (
    <>
      {/* Layer 1: App Shell Layout Wrapper */}
      <RootLayout stats={stats} deviceStatus={deviceStatus}>
        {/* Layer 2: Main View Route Slot (Children) */}
        <ViewDispatcher
          messages={messages}
          stats={stats}
          deviceStatus={deviceStatus}
          onRefreshMessages={refresh}
          onRefreshStatus={loadDeviceStatus}
        />
      </RootLayout>

      {/* Layer 3: Centralized Window Manager Modal Layer */}
      <ModalRoot
        deviceStatus={deviceStatus}
        onRefreshStatus={loadDeviceStatus}
        onDeleteConfirm={deleteMessages}
        onPostRoute={handlePostRoute}
      />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AccountProvider>
        <UIProvider>
          <AppInner />
        </UIProvider>
      </AccountProvider>
    </BrowserRouter>
  );
}

export default App;
