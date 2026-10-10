import React, { useState, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';
import type { DeviceStatus } from '../../types/status';
import {
  fetchSettingsStats,
  type SettingsStats,
  clearData,
  reseedRoutes,
  deleteMediaFiles,
  runStorageRetention,
  fetchRetentionSettings,
  updateRetentionSettings,
  type RetentionSettings,
} from '../../api/client';
import { SettingsHeroHeader } from './settings/SettingsHeroHeader';
import { WhatsAppConnectionCard } from './settings/WhatsAppConnectionCard';
import { PasswordSecurityCard } from './settings/PasswordSecurityCard';
import { DmRecordingCard } from './settings/DmRecordingCard';
import { SidebarNavigationCard } from './settings/SidebarNavigationCard';
import { AppearanceSoundCard } from './settings/AppearanceSoundCard';
import { AiTradingFeaturesCard } from './settings/AiTradingFeaturesCard';
import { StreamClearanceCard } from './settings/StreamClearanceCard';
import { DataDeletionCenter } from './settings/DataDeletionCenter';

export interface SettingsViewProps {
  deviceStatus: DeviceStatus;
  onRefreshStatus: () => void;
  onOpenDeviceModal: () => void;
  onOpenDeleteStreamModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  deviceStatus,
  onRefreshStatus,
  onOpenDeviceModal,
  onOpenDeleteStreamModal,
}) => {
  // 1. Live Telemetry Stats
  const [stats, setStats] = useState<SettingsStats | null>(null);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);

  const loadStats = useCallback(async () => {
    setIsRefreshingStats(true);
    try {
      const data = await fetchSettingsStats();
      if (data) setStats(data);
    } finally {
      setIsRefreshingStats(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 15000);
    return () => clearInterval(interval);
  }, [loadStats]);

  // 2. Feedback & Operation Status
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [deleteLoadingKey, setDeleteLoadingKey] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setDeleteFeedback(msg);
    setTimeout(() => {
      setActionFeedback(null);
      setDeleteFeedback(null);
    }, 4000);
  };

  // 3. Database Data Clear Actions
  const executeClear = async (target: 'routes' | 'analysis' | 'news' | 'all') => {
    setDeleteLoadingKey(`clear-${target}`);
    setPendingConfirm(null);
    try {
      const res = await clearData(target);
      if (res.success) {
        showFeedback(res.message);
        loadStats();
        if (target === 'routes' || target === 'all') window.dispatchEvent(new CustomEvent('wapp:routes-changed'));
        if (target === 'news' || target === 'all') window.dispatchEvent(new CustomEvent('wapp:news-changed'));
        window.dispatchEvent(new CustomEvent('wapp:storage-changed'));
      } else {
        showFeedback(`Error: ${res.message}`);
      }
    } finally {
      setDeleteLoadingKey(null);
    }
  };

  const executeReseed = async () => {
    setDeleteLoadingKey('reseed');
    setPendingConfirm(null);
    try {
      const res = await reseedRoutes();
      if (res.success) {
        showFeedback(`Routes reseeded with ${res.seeded ?? 21} authentic wholesale benchmark corridors!`);
        loadStats();
        window.dispatchEvent(new CustomEvent('wapp:routes-changed'));
      } else {
        showFeedback(`Reseed failed: ${res.message}`);
      }
    } finally {
      setDeleteLoadingKey(null);
    }
  };

  const executeDeleteMedia = async (percentage: 80 | 100) => {
    setDeleteLoadingKey(`media-${percentage}`);
    setPendingConfirm(null);
    try {
      const res = await deleteMediaFiles(percentage);
      if (res.success) {
        showFeedback(`Cleaned up ${res.deletedCount ?? 0} media files (${res.freedMb ?? 0} MB freed)`);
        loadStats();
        window.dispatchEvent(new CustomEvent('wapp:storage-changed'));
      } else {
        showFeedback(`Media cleanup failed: ${res.message}`);
      }
    } finally {
      setDeleteLoadingKey(null);
    }
  };

  // 4. Retention & Auto-Clean Configuration (ADR-014)
  const [retentionDays, setRetentionDays] = useState<number>(180);
  const [retentionStats, setRetentionStats] = useState<RetentionSettings | null>(null);
  const [retentionLoading, setRetentionLoading] = useState(false);

  const loadRetention = useCallback(async () => {
    try {
      const data = await fetchRetentionSettings();
      setRetentionStats(data);
      setRetentionDays(data.retentionDays);
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    loadRetention();
  }, [loadRetention]);

  const handleUpdateRetention = async (days: number) => {
    setRetentionLoading(true);
    try {
      const res = await updateRetentionSettings(days);
      if (res.success) {
        setRetentionDays(days);
        showFeedback(res.message);
        loadRetention();
        loadStats();
      } else {
        showFeedback(`Failed to update retention: ${res.message}`);
      }
    } finally {
      setRetentionLoading(false);
    }
  };

  const handleRunRetention = async () => {
    setDeleteLoadingKey('retention');
    try {
      const res = await runStorageRetention(retentionDays > 0 ? retentionDays : 180);
      showFeedback(res.message);
      loadRetention();
      loadStats();
    } finally {
      setDeleteLoadingKey(null);
    }
  };

  return (
    <div id="view-settings" className="space-y-6">
      {/* Global Feedback Banner */}
      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-medium text-xs flex items-center gap-2 shadow-sm animate-fadeIn">
          <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Top Hero Header Banner with Live Stats Badges */}
      <SettingsHeroHeader
        stats={stats}
        isRefreshingStats={isRefreshingStats}
        onRefresh={() => {
          loadStats();
          onRefreshStatus();
        }}
      />

      {/* Settings Grid Layout: 2 Columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: WhatsApp Carrier Connection */}
        <WhatsAppConnectionCard
          deviceStatus={deviceStatus}
          onRefreshStatus={onRefreshStatus}
          onOpenDeviceModal={onOpenDeviceModal}
          onStatsReload={loadStats}
        />

        {/* Card 2: Terminal Password & Security */}
        <PasswordSecurityCard />

        {/* Card 3: AI & Trading Features Controls */}
        <AiTradingFeaturesCard />

        {/* Card 4: Ingestion Filtering & DM Privacy */}
        <DmRecordingCard />

        {/* Card 5: Sidebar Navigation Visibility */}
        <SidebarNavigationCard />

        {/* Card 6: Appearance & Display Settings */}
        <AppearanceSoundCard />

        {/* Card 7: Live WhatsApp Stream Clearance */}
        <StreamClearanceCard
          onOpenDeleteStreamModal={onOpenDeleteStreamModal}
        />
      </div>

      {/* Database & Intelligence Data Deletion Center */}
      <DataDeletionCenter
        deleteFeedback={deleteFeedback}
        deleteLoadingKey={deleteLoadingKey}
        pendingConfirm={pendingConfirm}
        retentionDays={retentionDays}
        retentionStats={retentionStats}
        retentionLoading={retentionLoading}
        setPendingConfirm={setPendingConfirm}
        executeClear={executeClear}
        executeReseed={executeReseed}
        executeDeleteMedia={executeDeleteMedia}
        handleUpdateRetention={handleUpdateRetention}
        handleRunRetention={handleRunRetention}
      />
    </div>
  );
};
