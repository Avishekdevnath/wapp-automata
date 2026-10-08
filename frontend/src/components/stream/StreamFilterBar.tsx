import React, { useRef, useEffect } from 'react';
import { Search, RotateCcw, Download, Trash2, ChevronsDown } from 'lucide-react';

export type FilterType = 'all' | 'group' | 'archived' | 'direct' | 'media' | 'sent';

interface StreamFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterType: FilterType;
  onFilterChange: (f: FilterType) => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onOpenDeleteModal: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const StreamFilterBar: React.FC<StreamFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  filterType,
  onFilterChange,
  autoScroll,
  onToggleAutoScroll,
  onExportJson,
  onExportCsv,
  onOpenDeleteModal,
  onRefresh,
  isRefreshing = false,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-md space-y-3 shrink-0 transition-colors">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search vendor, phone, group name, text, rate sheet... (Press / to search)"
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Type Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => onFilterChange(e.target.value as FilterType)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">All Messages (Groups + DMs)</option>
            <option value="group">Active Groups Only</option>
            <option value="archived">Archived Groups Only</option>
            <option value="direct">Direct DMs Only</option>
            <option value="media">Media & Rate Sheets Only</option>
            <option value="sent">Sent by Me (Outbound)</option>
          </select>

          {/* Quick Action Controls */}
          <button
            onClick={onToggleAutoScroll}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${autoScroll
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            title="Auto-scroll to top on new inbound message"
          >
            <ChevronsDown className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span className="hidden md:inline">Auto-Scroll</span>
          </button>

          <button
            onClick={onExportJson}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all"
            title="Export filtered messages as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          <button
            onClick={onExportCsv}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all"
            title="Export filtered messages as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={onOpenDeleteModal}
            className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-all"
            title="Delete messages from stream"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            title={isRefreshing ? "Refreshing stream..." : "Refresh stream"}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
