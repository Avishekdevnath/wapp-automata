import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { WhatsAppMessage, StreamStats } from '../types/message';
import { fetchMessages, deleteStreamMessages, pruneMessagesPercentage } from '../api/client';
import { logDecryptedMessage, logStreamListeningBanner } from '../utils/consoleLogger';

export function useMessages() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [serverStats, setServerStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tracking state to detect fresh incoming messages in real-time
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);

  const loadMessages = useCallback(async () => {
    try {
      const data = await fetchMessages();
      if ((data as any).serverStats) {
        setServerStats((data as any).serverStats);
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
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 2500);
    return () => clearInterval(interval);
  }, [loadMessages]);

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
    refresh: loadMessages,
    deleteMessages,
  };
}
