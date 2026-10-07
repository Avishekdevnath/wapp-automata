import type { WhatsAppMessage } from '../types/message';

/**
 * Enterprise DevTools Console Logger for Real-Time Decrypted WhatsApp Messages.
 * Formats incoming messages with distinct visual badges, timestamps, chat types,
 * decrypted plaintext payloads, and interactive expandable metadata.
 */

export function logDecryptedMessage(msg: WhatsAppMessage): void {
  const isSimulated = msg.id.startsWith('sim_');
  const badgeText = isSimulated ? '🧪 TEST SIMULATED' : '🟢 LIVE WHATSAPP';
  const badgeBg = isSimulated ? '#7c3aed' : '#10b981';
  const typeBadge = msg.chat_type === 'group' ? '👥 GROUP' : msg.chat_type === 'status' ? '📱 STATUS' : '👤 DIRECT';
  const timeStr = msg.timestamp || (msg.occurred_at ? new Date(msg.occurred_at).toLocaleTimeString() : new Date().toLocaleTimeString());
  const senderStr = msg.sender_name || msg.sender_phone || 'Unknown Contact';
  const phoneStr = msg.sender_phone ? ` (${msg.sender_phone})` : '';
  const chatStr = msg.chat_name ? ` ➔ ${msg.chat_name}` : '';

  // 1. Group Header with prominent styling
  console.group(
    `%c${badgeText}%c %c${typeBadge}%c %c${senderStr}${phoneStr}${chatStr}%c %c${timeStr}%c`,
    `background: ${badgeBg}; color: #ffffff; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.3px;`,
    '',
    'background: #1e293b; color: #38bdf8; font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 4px; border: 1px solid #0284c7;',
    '',
    'color: #f8fafc; font-weight: 700; font-size: 12px;',
    '',
    'color: #94a3b8; font-size: 11px; font-style: italic;',
    ''
  );

  // 2. Decrypted Plaintext Body Display
  const textBody = msg.text && msg.text.trim()
    ? msg.text
    : (msg.has_media ? '📷 [Media attachment without text caption]' : '▫ [Empty message body]');

  console.log(
    `%c💬 Decrypted Message Content:%c\n%c${textBody}`,
    'color: #34d399; font-weight: bold; font-size: 12px;',
    '',
    'color: #ffffff; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #0f172a; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #10b981; display: inline-block; margin: 4px 0; line-height: 1.5; white-space: pre-wrap;'
  );

  // 3. Compact Key-Value Metadata Summary
  console.log(
    '%c📋 Ingestion Metadata & Routing:',
    'color: #94a3b8; font-weight: bold; font-size: 11px;',
    {
      'Message ID': msg.id,
      'Sender': `${senderStr}${phoneStr}`,
      'Chat Destination': msg.chat_name || msg.chat_jid || 'Direct Message',
      'Chat Type': msg.chat_type,
      'From Me': Boolean(msg.is_from_me),
      'Has Media': Boolean(msg.has_media),
      'Timestamp': timeStr,
      'Media Attachment': msg.media || null,
      'Quoted Reply Context': msg.reply_to || null,
      'Raw Ingestion Envelope': msg.raw_envelope || null
    }
  );

  console.groupEnd();
}

/**
 * Logs a stylized initial connection banner when Vite starts monitoring the feed.
 */
export function logStreamListeningBanner(initialBufferCount: number): void {
  console.log(
    `%c⚡ Telcia • WhatsApp Live Message Stream Connected %c\n` +
    `%c📡 Real-time decrypted messages will appear here as they are captured by the collector.%c\n` +
    `%cLoaded ${initialBufferCount} historical messages into memory buffer. Window inspection available via %c__wapp_recent_messages%c.`,
    'background: #10b981; color: #022c22; font-weight: 800; font-size: 12px; padding: 3px 8px; border-radius: 4px;',
    '',
    'color: #38bdf8; font-size: 11px; font-weight: 500;',
    '',
    'color: #64748b; font-size: 11px;',
    'color: #f59e0b; font-family: monospace; font-weight: bold;',
    'color: #64748b; font-size: 11px;'
  );
}
