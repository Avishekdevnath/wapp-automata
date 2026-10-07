import React, { useRef, useEffect } from 'react';
import { SearchX, Radio, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { WhatsAppMessage } from '../../types/message';
import type { MessageSortField, SortDirection } from '../../hooks/useTerminalController';
import { MessageRow } from './MessageRow';

interface StreamTableProps {
  messages: WhatsAppMessage[];
  searchQuery: string;
  autoScroll: boolean;
  sortField?: MessageSortField;
  sortDirection?: SortDirection;
  onToggleSort?: (field: MessageSortField) => void;
  onResetFilters: () => void;
  onViewDetail: (message: WhatsAppMessage) => void;
}

export const StreamTable: React.FC<StreamTableProps> = ({
  messages,
  searchQuery,
  autoScroll,
  sortField = 'time',
  sortDirection = 'desc',
  onToggleSort,
  onResetFilters,
  onViewDetail,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(messages.length);

  // Auto-scroll to top when a new message arrives and autoScroll is enabled
  useEffect(() => {
    if (autoScroll && messages.length > prevCountRef.current && scrollRef.current) {
      if (scrollRef.current.scrollTop > 50) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length, autoScroll]);

  // Reset scroll to top when user changes sorting
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [sortField, sortDirection]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center select-none shadow-md">
        {searchQuery ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 dark:text-amber-400 mb-3 shadow-inner">
              <SearchX className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">No messages match "{searchQuery}"</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              No live records in the buffer match your search terms or filter selection.
            </p>
            <button
              onClick={onResetFilters}
              className="mt-4 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-all"
            >
              Reset Filters
            </button>
          </>
        ) : (
          <>
            <div className="relative w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Listening for Live WhatsApp Stream</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Collector is linked with 100% durable local SQLite queuing. New carrier offers and messages will stream here automatically.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-auto scroll-smooth">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none">
            <tr>
              <th
                onClick={() => onToggleSort?.('time')}
                className="py-2.5 px-4 w-28 sm:w-36 shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group"
                title="Sort by Timestamp"
              >
                <div className="flex items-center gap-1.5">
                  <span>Time & Date</span>
                  {sortField === 'time' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </th>
              <th
                onClick={() => onToggleSort?.('sender')}
                className="py-2.5 px-4 w-48 sm:w-60 shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group"
                title="Sort by Sender / Chat Name"
              >
                <div className="flex items-center gap-1.5">
                  <span>Sender / Chat</span>
                  {sortField === 'sender' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </th>
              <th
                onClick={() => onToggleSort?.('text')}
                className="py-2.5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors group"
                title="Sort by Message Content"
              >
                <div className="flex items-center gap-1.5">
                  <span>Message Content</span>
                  {sortField === 'text' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </th>
              <th className="py-2.5 px-4 w-28 text-right shrink-0">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} onViewDetail={onViewDetail} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
