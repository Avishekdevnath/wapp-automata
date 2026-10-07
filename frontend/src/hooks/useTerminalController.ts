import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { WhatsAppMessage } from '../types/message';
import type { FilterType } from '../components/stream/StreamFilterBar';
import { getMessageTimestamp } from '../utils/formatters';

// Cache message search haystacks to prevent recalculating on every render
const haystackCache = new WeakMap<WhatsAppMessage, string>();

function getSearchHaystack(m: WhatsAppMessage): string {
  let cached = haystackCache.get(m);
  if (!cached) {
    cached = [
      m.text,
      m.sender_name,
      m.sender_phone,
      m.chat_name,
      m.contact?.name,
      m.contact?.phone,
      m.media?.fileName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    haystackCache.set(m, cached);
  }
  return cached;
}

export type MessageSortField = 'time' | 'sender' | 'text';
export type SortDirection = 'asc' | 'desc';

export function useTerminalController(messages: WhatsAppMessage[]) {
  // 1. Core Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<MessageSortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const toggleSort = useCallback((field: MessageSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'time' ? 'desc' : 'asc');
    }
  }, [sortField]);

  // 2. Debounce search input by 120ms for fast keystroke response
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(q.trim().toLowerCase());
    }, 120);
  }, []);

  // 3. Reset page on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, filterType, pageSize, sortField, sortDirection]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // 4. Memoized Sub-millisecond Message Filtering
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (filterType === 'group' && (m.chat_type !== 'group' || m.is_archived)) return false;
      if (filterType === 'archived' && !m.is_archived) return false;
      if (filterType === 'direct' && m.chat_type !== 'direct' && m.chat_type !== 'individual') return false;
      if (filterType === 'media' && !m.has_media && !m.media) return false;
      if (filterType === 'sent' && !m.is_from_me) return false;

      if (!debouncedQuery) return true;
      const haystack = getSearchHaystack(m);
      return haystack.includes(debouncedQuery);
    });
  }, [messages, filterType, debouncedQuery]);

  // 4.1. Fast Client-side Sorting
  const sortedMessages = useMemo(() => {
    const list = [...filteredMessages];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'time') {
        const timeA = getMessageTimestamp(a);
        const timeB = getMessageTimestamp(b);
        cmp = timeA - timeB;
        if (cmp === 0) {
          cmp = (a.id || '').localeCompare(b.id || '');
        }
      } else if (sortField === 'sender') {
        const senderA = (a.sender_name || a.sender_phone || a.chat_name || '').toLowerCase();
        const senderB = (b.sender_name || b.sender_phone || b.chat_name || '').toLowerCase();
        cmp = senderA.localeCompare(senderB);
        if (cmp === 0) {
          cmp = getMessageTimestamp(a) - getMessageTimestamp(b);
        }
      } else if (sortField === 'text') {
        const textA = (a.text || '').toLowerCase();
        const textB = (b.text || '').toLowerCase();
        cmp = textA.localeCompare(textB);
        if (cmp === 0) {
          cmp = getMessageTimestamp(a) - getMessageTimestamp(b);
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredMessages, sortField, sortDirection]);

  // 5. Paginated Messages Slice
  const pageMessages = useMemo(() => {
    if (pageSize <= 0) return sortedMessages;
    const startIdx = (currentPage - 1) * pageSize;
    return sortedMessages.slice(startIdx, startIdx + pageSize);
  }, [sortedMessages, currentPage, pageSize]);

  // 6. Reset Filters
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setFilterType('all');
    setCurrentPage(1);
  }, []);

  // 7. Toggle Auto-Scroll
  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => !prev);
  }, []);

  // 8. Export Helpers
  const exportJson = useCallback(() => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(filteredMessages, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `wapp_messages_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }, [filteredMessages]);

  const exportCsv = useCallback(() => {
    const headers = ['ID', 'Timestamp', 'Sender Name', 'Sender Phone', 'Chat Name', 'Chat Type', 'Text'];
    const rows = filteredMessages.map((m) => [
      `"${m.id}"`,
      `"${m.occurred_at || m.timestamp || ''}"`,
      `"${(m.sender_name || '').replace(/"/g, '""')}"`,
      `"${m.sender_phone || ''}"`,
      `"${(m.chat_name || '').replace(/"/g, '""')}"`,
      `"${m.chat_type || 'direct'}"`,
      `"${(m.text || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csvContent);
    a.download = `wapp_messages_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }, [filteredMessages]);

  return {
    searchQuery,
    onSearchChange: handleSearchChange,
    filterType,
    onFilterChange: setFilterType,
    autoScroll,
    toggleAutoScroll,
    pageSize,
    onPageSizeChange: setPageSize,
    currentPage,
    onPageChange: setCurrentPage,
    filteredMessages,
    pageMessages,
    sortField,
    sortDirection,
    toggleSort,
    resetFilters,
    exportJson,
    exportCsv,
  };
}
