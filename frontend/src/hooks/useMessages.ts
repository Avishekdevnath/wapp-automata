import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { WhatsAppMessage, StreamStats } from '../types/message';
import { fetchMessages, deleteStreamMessages, pruneMessagesPercentage } from '../api/client';
import { logDecryptedMessage, logStreamListeningBanner } from '../utils/consoleLogger';

export function useMessages() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [serverStats, setServerStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Time Range Window & Pagination
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean>(false);
  const [oldestTimestamp, setOldestTimestamp] = useState<number | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);

  // Tracking state to detect fresh incoming messages in real-time
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);

  const getFetchParams = useCallback((range: string) => {
    if (range === '30d') return { days: 30, limit: 25000 };
    if (range === '60d') return { days: 60, limit: 35000 };
    if (range === '90d') return { days: 90, limit: 50000 };
    if (range === 'all') return { limit: 'all' };
    return { limit: Number(range) || 2000 };
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const fetchParams = getFetchParams(timeRange);
      const data = await fetchMessages(fetchParams);
      if ((data as any).serverStats) {
        setServerStats((data as any).serverStats);
      }
      setHasMoreOlder(Boolean((data as any).hasMore));
      if ((data as any).oldestTimestamp) {
        setOldestTimestamp((data as any).oldestTimestamp);
      }

      // Keep only valid messages with text, media, or valid identity
      const valid = data.filter(m => {
        const content = (m.text || m.message_text || '').trim();
        const hasMedia = Boolean(m.has_media);
        return Boolean(content || hasMedia);
      });

      if (typeof window !== 'undefined') {
        (window as any).__wapp_recent_messages = valid;
      }

      if (isInitialLoadRef.current) {
        // Register historical buffer on initial page load
        valid.forEach(m => seenIdsRef.current.add(m.id));
        logStreamListeningBanner(valid.length);
        isInitialLoadRef.current = false;
      } else {
        // Detect newly arrived messages that weren't present in previous fetch
        const newlyArrived = valid
          .filter(m => !seenIdsRef.current.has(m.id))
          .reverse(); // Log in chronological order

        for (const newMsg of newlyArrived) {
          seenIdsRef.current.add(newMsg.id);
          logDecryptedMessage(newMsg);
        }
      }

      setMessages(valid);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [timeRange, getFetchParams]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!oldestTimestamp || isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      const older = await fetchMessages({ days: 30, before: oldestTimestamp, limit: 25000 });
      if (older.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newUnique = older.filter(m => !existingIds.has(m.id));
          return [...prev, ...newUnique];
        });
        const nextOldest = (older as any).oldestTimestamp || older[older.length - 1].timestamp;
        setOldestTimestamp(nextOldest ? Number(nextOldest) : null);
        setHasMoreOlder(Boolean((older as any).hasMore));
      } else {
        setHasMoreOlder(false);
      }
    } catch (e) {
      console.warn('Failed to load older messages:', e);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [oldestTimestamp, isLoadingOlder]);

  // Zero-Ghost State Flush on account switch
  useEffect(() => {
    const handleAccountChange = () => {
      seenIdsRef.current.clear();
      isInitialLoadRef.current = true;
      setMessages([]);
      setLoading(true);
      loadMessages();
    };
    window.addEventListener('wapp:account-changed', handleAccountChange);
    return () => window.removeEventListener('wapp:account-changed', handleAccountChange);
  }, [loadMessages]);

  const stats: StreamStats = useMemo(() => {
    const groups = new Set(
      messages.filter(m => m.chat_type === 'group' && !m.is_archived).map(m => m.chat_name || m.chat_jid)
    );
    const archived = new Set(
      messages.filter(m => m.is_archived).map(m => m.chat_name || m.chat_jid)
    );
    const senders = new Set(
      messages.map(m => m.sender_phone || m.sender_name).filter(Boolean)
    );
    return {
      total: serverStats?.total ?? serverStats?.totalMessages ?? messages.length,
      groups: serverStats?.groups ?? serverStats?.uniqueGroups ?? groups.size,
      archived: archived.size,
      senders: serverStats?.dms ?? serverStats?.uniqueDms ?? senders.size,
    };
  }, [messages, serverStats]);

  const deleteMessages = useCallback(async (percentage: number = 100) => {
    if (percentage >= 100) {
      const ok = await deleteStreamMessages();
      if (ok) {
        setMessages([]);
        seenIdsRef.current.clear();
      }
      return ok;
    } else {
      const res = await pruneMessagesPercentage(percentage);
      if (res.success) {
        await loadMessages();
      }
      return res.success;
    }
  }, [loadMessages]);

  return {
    messages,
    loading,
    error,
    stats,
    timeRange,
    setTimeRange,
    hasMoreOlder,
    isLoadingOlder,
    loadOlderMessages,
    refresh: loadMessages,
    deleteMessages,
  };
}
