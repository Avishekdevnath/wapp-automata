import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StreamPaginationBarProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
}

export const StreamPaginationBar: React.FC<StreamPaginationBarProps> = ({
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}) => {
  if (totalCount === 0) return null;

  const maxPages = pageSize <= 0 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  const startIdx = pageSize <= 0 ? 1 : (currentPage - 1) * pageSize + 1;
  const endIdx = pageSize <= 0 ? totalCount : Math.min(currentPage * pageSize, totalCount);

  const PAGE_SIZES = [10, 25, 50, 100, 0];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 sm:p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md shrink-0 transition-colors">
      {/* Left: Showing range */}
      <div className="text-slate-500 dark:text-slate-400 font-mono">
        Showing <strong className="text-slate-900 dark:text-white font-bold">{startIdx}</strong> to{' '}
        <strong className="text-slate-900 dark:text-white font-bold">{endIdx}</strong> of{' '}
        <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{totalCount}</strong> messages
      </div>

      {/* Middle: Page Size Selector */}
      <div className="flex items-center gap-2">
        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Messages per page:</span>
        <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => onPageSizeChange(size)}
              className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all cursor-pointer ${
                pageSize === size
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {size === 0 ? 'All' : size}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Page Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || pageSize <= 0}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>

        <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
          Page <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{currentPage}</strong> of{' '}
          <span className="text-slate-500 dark:text-slate-400">{maxPages}</span>
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= maxPages || pageSize <= 0}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
