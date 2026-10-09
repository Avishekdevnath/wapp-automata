import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useUI } from '../../context/UIContext';
import { RoutesView } from './RoutesView';
import { TerminalView } from './TerminalView';
import { getRouteSlug } from '../../utils/slug';

// Code-split auxiliary views for faster initial bundle and maximum performance
const TrendsView = lazy(() => import('./TrendsView').then((m) => ({ default: m.TrendsView })));
const InsightsView = lazy(() => import('./InsightsView').then((m) => ({ default: m.InsightsView })));
const NewsView = lazy(() => import('./NewsView').then((m) => ({ default: m.NewsView })));
const VendorsView = lazy(() => import('./VendorsView').then((m) => ({ default: m.VendorsView })));
const PipelineView = lazy(() => import('./PipelineView').then((m) => ({ default: m.PipelineView })));
const DevView = lazy(() => import('./DevView').then((m) => ({ default: m.DevView })));
const SettingsView = lazy(() => import('./SettingsView').then((m) => ({ default: m.SettingsView })));

import type { WhatsAppMessage, StreamStats } from '../../types/message';
import type { DeviceStatus } from '../../types/status';

interface ViewDispatcherProps {
  messages: WhatsAppMessage[];
  stats: StreamStats;
  deviceStatus: DeviceStatus;
  onRefreshMessages: () => void;
  onRefreshStatus: () => void;
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
  hasMoreOlder?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
}

const ViewFallback: React.FC = () => (
  <div className="flex-1 flex items-center justify-center p-12">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Loading module...</span>
    </div>
  </div>
);

export const ViewDispatcher: React.FC<ViewDispatcherProps> = ({
  messages,
  stats,
  deviceStatus,
  onRefreshMessages,
  onRefreshStatus,
  timeRange = '30d',
  onTimeRangeChange,
  hasMoreOlder = false,
  isLoadingOlder = false,
  onLoadOlder,
}) => {
  const { openModal } = useUI();
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/routes" replace />} />

      {/* 1. Route Matrix & Slugs */}
      <Route
        path="/routes"
        element={
          <RoutesView
            onSelectRoute={(r) => {
              navigate(`/routes/${getRouteSlug(r)}`);
              openModal('route-detail', r);
            }}
            onOpenPostRoute={() => openModal('post-route')}
          />
        }
      />
      <Route
        path="/routes/:routeSlug"
        element={
          <RoutesView
            onSelectRoute={(r) => {
              navigate(`/routes/${getRouteSlug(r)}`);
              openModal('route-detail', r);
            }}
            onOpenPostRoute={() => openModal('post-route')}
          />
        }
      />

      {/* 2. Market Analytics & Trends */}
      <Route
        path="/trends"
        element={
          <Suspense fallback={<ViewFallback />}>
            <TrendsView />
          </Suspense>
        }
      />

      {/* 3. AI Insights & Deal Engine */}
      <Route
        path="/insights"
        element={
          <Suspense fallback={<ViewFallback />}>
            <InsightsView />
          </Suspense>
        }
      />

      {/* 4. Telco News & Incidents */}
      <Route
        path="/news"
        element={
          <Suspense fallback={<ViewFallback />}>
            <NewsView />
          </Suspense>
        }
      />
      <Route
        path="/news/:newsSlug"
        element={
          <Suspense fallback={<ViewFallback />}>
            <NewsView />
          </Suspense>
        }
      />

      {/* 5. Carriers & Vendors Directory */}
      <Route
        path="/vendors"
        element={
          <Suspense fallback={<ViewFallback />}>
            <VendorsView />
          </Suspense>
        }
      />
      <Route
        path="/vendors/:vendorSlug"
        element={
          <Suspense fallback={<ViewFallback />}>
            <VendorsView />
          </Suspense>
        }
      />

      {/* 6. Live WhatsApp Message Stream */}
      <Route
        path="/stream"
        element={
          <TerminalView
            messages={messages}
            stats={stats}
            deviceStatus={deviceStatus}
            timeRange={timeRange}
            onTimeRangeChange={onTimeRangeChange}
            hasMoreOlder={hasMoreOlder}
            isLoadingOlder={isLoadingOlder}
            onLoadOlder={onLoadOlder}
            onOpenDeviceModal={() => openModal('device')}
            onRefresh={onRefreshMessages}
            onOpenDeleteModal={() => openModal('delete')}
            onViewDetail={(m) => {
              navigate(`/stream/${m.id}`);
              openModal('message-detail', m);
            }}
          />
        }
      />
      <Route
        path="/stream/:messageId"
        element={
          <TerminalView
            messages={messages}
            stats={stats}
            deviceStatus={deviceStatus}
            timeRange={timeRange}
            onTimeRangeChange={onTimeRangeChange}
            hasMoreOlder={hasMoreOlder}
            isLoadingOlder={isLoadingOlder}
            onLoadOlder={onLoadOlder}
            onOpenDeviceModal={() => openModal('device')}
            onRefresh={onRefreshMessages}
            onOpenDeleteModal={() => openModal('delete')}
            onViewDetail={(m) => {
              navigate(`/stream/${m.id}`);
              openModal('message-detail', m);
            }}
          />
        }
      />

      {/* Legacy Terminal alias redirects */}
      <Route path="/terminal" element={<Navigate to="/stream" replace />} />
      <Route path="/terminal/:messageId" element={<Navigate to="/stream" replace />} />

      {/* 7. AI Pipeline & Queue Telemetry */}
      <Route
        path="/pipeline"
        element={
          <Suspense fallback={<ViewFallback />}>
            <PipelineView />
          </Suspense>
        }
      />

      {/* 8. Developer Studio */}
      <Route
        path="/dev"
        element={
          <Suspense fallback={<ViewFallback />}>
            <DevView onRefreshMessages={onRefreshMessages} />
          </Suspense>
        }
      />

      {/* 9. Settings & Config */}
      <Route
        path="/settings"
        element={
          <Suspense fallback={<ViewFallback />}>
            <SettingsView
              deviceStatus={deviceStatus}
              onRefreshStatus={onRefreshStatus}
              onOpenDeviceModal={() => openModal('device')}
              onOpenDeleteStreamModal={() => openModal('delete')}
            />
          </Suspense>
        }
      />

      {/* 10. Catch-All Fallback */}
      <Route path="*" element={<Navigate to="/routes" replace />} />
    </Routes>
  );
};
