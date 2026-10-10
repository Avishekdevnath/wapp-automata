import { Router } from 'express';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  logoutWhatsApp,
  requestPairingCode,
  getStatus,
  syncGroupNames,
  catchupRecentChats
} from '../collector/whatsapp.js';
import { broadcastSse } from '../sse.js';

export const whatsappRouter = Router();

// 1. Session Status
whatsappRouter.get(['/status', '/connection', '/session/status'], (req, res) => {
  res.json(getStatus());
});

// 2. Restart / Reconnect Socket
whatsappRouter.post(['/session/restart', '/session/refresh', '/connect'], async (req, res) => {
  try {
    await disconnectWhatsApp();
    setTimeout(() => {
      connectWhatsApp().catch(err => console.warn('[WhatsApp] Reconnect error:', err.message));
    }, 1000);
    res.json({ success: true, status: 'connecting', message: 'Reconnecting WhatsApp session' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Request 8-Digit Pairing Code
whatsappRouter.post(['/session/pair-code', '/pair-code'], async (req, res) => {
  const status = getStatus();
  if (status.connected || status.status === 'authenticated') {
    return res.status(400).json({
      error: 'A WhatsApp account is currently connected. You must log out of the active account before linking another account.'
    });
  }
  const { phone } = req.body || {};
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  try {
    const code = await requestPairingCode(phone);
    res.json({ status: 'ok', pairingCode: code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Session Reset / Logout (Cascading Raw Data Deletion)
whatsappRouter.post(['/session/reset', '/session/logout', '/logout'], async (req, res) => {
  try {
    const result = await logoutWhatsApp();
    broadcastSse('cleared', { count: 0 });
    broadcastSse('status', getStatus());
    // Auto-reconnect so a fresh QR code is immediately available
    setTimeout(() => {
      connectWhatsApp().catch(err => console.warn('[WhatsApp] Post-reset auto-connect error:', err.message));
    }, 1000);
    res.json({ success: true, message: 'Session unlinked. Raw messages deleted. Fresh pairing ready.', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Sync Group Names & Member Identities
whatsappRouter.post(['/sync-groups', '/chats/sync-names'], async (req, res) => {
  try {
    const result = await syncGroupNames();
    broadcastSse('groups_synced', result);
    res.json({ status: 'ok', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Catch-up Active Chats History from Phone
whatsappRouter.post(['/sync-history', '/catchup', '/chats/catchup-all'], async (req, res) => {
  try {
    const count = Math.min(Math.max(Number(req.query.count || req.body?.count) || 50, 1), 100);
    const result = await catchupRecentChats(count);
    res.json({ status: 'ok', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
