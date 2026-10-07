import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { WhatsAppMessage, StreamStats } from '../types/message';
import { fetchMessages, purgeStreamMessages, pruneMessagesPercentage } from '../api/client';
import { logDecryptedMessage, logStreamListeningBanner } from '../utils/consoleLogger';

export function useMessages() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tracking state to detect fresh incoming messages in real-time
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);

  const loadMessages = useCallback(async () => {
    try {
      const data = await fetchMessages();
      // Keep only valid messages with text or media
      const valid = data.filter(m => (m.text && m.text.trim()) || m.has_media);

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
      total: messages.length,
      groups: groups.size,
      archived: archived.size,
      senders: senders.size,
    };
  }, [messages]);

  const purge = useCallback(async (percentage: number = 100) => {
    if (percentage >= 100) {
      const ok = await purgeStreamMessages();
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
    purge,
  };
}
