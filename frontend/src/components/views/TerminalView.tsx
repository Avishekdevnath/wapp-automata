import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Smartphone, QrCode } from 'lucide-react';
import type { WhatsAppMessage, StreamStats } from '../../types/message';
import type { DeviceStatus } from '../../types/status';
import { useTerminalController } from '../../hooks/useTerminalController';
import { StreamFilterBar } from '../stream/StreamFilterBar';
import { StreamTable } from '../stream/StreamTable';
import { StreamPaginationBar } from '../stream/StreamPaginationBar';

interface TerminalViewProps {
  messages: WhatsAppMessage[];
  stats: StreamStats;
  deviceStatus?: DeviceStatus;
  onOpenDeviceModal?: () => void;
  onRefresh: () => void;
  onOpenDeleteModal: () => void;
  onViewDetail: (message: WhatsAppMessage) => void;
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
  hasMoreOlder?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  messages,
  stats,
  deviceStatus,
  onOpenDeviceModal,
  onRefresh,
  onOpenDeleteModal,
  onViewDetail,
  timeRange = '30d',
  onTimeRangeChange,
  hasMoreOlder = false,
  isLoadingOlder = false,
  onLoadOlder,
}) => {
  const { messageId } = useParams<{ messageId?: string }>();
  const lastOpenedMsgRef = useRef<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 400);
    }
  };

  useEffect(() => {
    if (messageId && messages.length > 0 && lastOpenedMsgRef.current !== messageId) {
      const target = messages.find(
        (m) => String(m.id) === messageId
      );
      if (target) {
        lastOpenedMsgRef.current = messageId;
        onViewDetail(target);
      }
    } else if (!messageId) {
      lastOpenedMsgRef.current = null;
    }
  }, [messageId, messages, onViewDetail]);
  const {
    searchQuery,
    onSearchChange,
    filterType,
    onFilterChange,
    autoScroll,
    toggleAutoScroll,
    pageSize,
    onPageSizeChange,
    currentPage,
    onPageChange,
    filteredMessages,
    pageMessages,
    sortField,
    sortDirection,
    toggleSort,
    resetFilters,
    exportJson,
    exportCsv,
  } = useTerminalController(messages);

  return (
    <div id="view-terminal" className="terminal-view-layout flex flex-col h-full min-h-0 space-y-2.5 overflow-hidden">
      {/* 1. Fixed Top Filter Bar with Actions (Static, Non-Scrolling) */}
      <StreamFilterBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        filterType={filterType}
        onFilterChange={onFilterChange}
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
        autoScroll={autoScroll}
        onToggleAutoScroll={toggleAutoScroll}
        onExportJson={exportJson}
        onExportCsv={exportCsv}
        onOpenDeleteModal={onOpenDeleteModal}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* 1.1. Older Window Banner (Load previous 30 days) */}
      {hasMoreOlder && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-mono text-[11px] sm:text-xs">
              Loaded {messages.length.toLocaleString()} messages ({stats.total.toLocaleString()} total in database)
            </span>
          </div>
          {onLoadOlder && (
            <button
              onClick={onLoadOlder}
              disabled={isLoadingOlder}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs shrink-0"
              title="Fetch older messages from earlier 30 days"
            >
              {isLoadingOlder ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>⬆️ Load previous 30 days</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* 2. Scrollable Native Table / Privacy Lock when Unlinked */}
      {!deviceStatus?.connected && deviceStatus?.status !== 'authenticated' ? (
        <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center select-none shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
            <Smartphone className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">WhatsApp Desk Unlinked</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            This desk is currently not connected to an authenticated WhatsApp session. Message stream is locked for privacy.
          </p>
          {onOpenDeviceModal && (
            <button
              onClick={onOpenDeviceModal}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Link WhatsApp Account</span>
            </button>
          )}
        </div>
      ) : (
        <StreamTable
          messages={pageMessages}
          searchQuery={searchQuery}
          autoScroll={autoScroll}
          sortField={sortField}
          sortDirection={sortDirection}
          onToggleSort={toggleSort}
          onResetFilters={resetFilters}
          onViewDetail={onViewDetail}
        />
      )}

      {/* 3. Fixed Bottom Pagination Bar (Static, Non-Scrolling) */}
      <StreamPaginationBar
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={filteredMessages.length}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
};
