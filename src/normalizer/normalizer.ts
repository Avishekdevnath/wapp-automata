import { NormalizedEnvelope, ChatType, MediaType, MediaMetadata, ReplyContext } from './types';

/**
 * Classifies remote JID into standard ChatType.
 */
export function classifyChatType(jid: string): ChatType {
  if (jid.endsWith('@g.us')) {
    return 'group';
  }
  if (jid.endsWith('@newsletter')) {
    return 'channel';
  }
  if (jid.endsWith('@s.whatsapp.net')) {
    return 'individual';
  }
  return 'unknown';
}

/**
 * Coerces WhatsApp timestamp (number, Long object, or string) to Unix epoch seconds.
 */
function parseTimestamp(rawTimestamp: unknown): number {
  if (typeof rawTimestamp === 'number') {
    return rawTimestamp;
  }
  if (rawTimestamp && typeof rawTimestamp === 'object' && 'low' in rawTimestamp) {
    return Number((rawTimestamp as { low: number }).low);
  }
  if (typeof rawTimestamp === 'string') {
    const parsed = Number(rawTimestamp);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return Math.floor(Date.now() / 1000);
}

/**
 * Unwraps view-once, ephemeral, or container wrappers to reach the inner WhatsApp message.
 */
function unwrapMessage(msg: Record<string, unknown>): Record<string, unknown> {
  let current = msg;

  if (current.ephemeralMessage && typeof current.ephemeralMessage === 'object') {
    const inner = (current.ephemeralMessage as Record<string, unknown>).message;
    if (inner && typeof inner === 'object') current = inner as Record<string, unknown>;
  }

  if (current.viewOnceMessage && typeof current.viewOnceMessage === 'object') {
    const inner = (current.viewOnceMessage as Record<string, unknown>).message;
    if (inner && typeof inner === 'object') current = inner as Record<string, unknown>;
  }

  if (current.viewOnceMessageV2 && typeof current.viewOnceMessageV2 === 'object') {
    const inner = (current.viewOnceMessageV2 as Record<string, unknown>).message;
    if (inner && typeof inner === 'object') current = inner as Record<string, unknown>;
  }

  if (current.documentWithCaptionMessage && typeof current.documentWithCaptionMessage === 'object') {
    const inner = (current.documentWithCaptionMessage as Record<string, unknown>).message;
    if (inner && typeof inner === 'object') current = inner as Record<string, unknown>;
  }

  return current;
}

/**
 * Extracts quoted reply context if contextInfo is present.
 */
function extractReplyContext(contextInfo: Record<string, unknown> | undefined): ReplyContext | null {
  if (!contextInfo || typeof contextInfo !== 'object') {
    return null;
  }

  const stanzaId = typeof contextInfo.stanzaId === 'string' ? contextInfo.stanzaId : null;
  const participant = typeof contextInfo.participant === 'string' ? contextInfo.participant : null;

  if (!stanzaId || !participant) {
    return null;
  }

  let quotedText: string | null = null;
  if (contextInfo.quotedMessage && typeof contextInfo.quotedMessage === 'object') {
    const quoted = unwrapMessage(contextInfo.quotedMessage as Record<string, unknown>);
    if (typeof quoted.conversation === 'string') {
      quotedText = quoted.conversation;
    } else if (quoted.extendedTextMessage && typeof (quoted.extendedTextMessage as Record<string, unknown>).text === 'string') {
      quotedText = (quoted.extendedTextMessage as Record<string, unknown>).text as string;
    } else if (quoted.imageMessage && typeof (quoted.imageMessage as Record<string, unknown>).caption === 'string') {
      quotedText = (quoted.imageMessage as Record<string, unknown>).caption as string;
    } else if (quoted.videoMessage && typeof (quoted.videoMessage as Record<string, unknown>).caption === 'string') {
      quotedText = (quoted.videoMessage as Record<string, unknown>).caption as string;
    }
  }

  return {
    messageId: stanzaId,
    senderId: participant,
    quotedText
  };
}

/**
 * Normalizes an arbitrary raw WhatsApp event into a standardized NormalizedEnvelope.
 * Returns null if the event is malformed or lacks essential routing identifiers.
 */
export function normalizeMessage(rawEvent: unknown): NormalizedEnvelope | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  const key = (event.key || {}) as Record<string, unknown>;

  const id = typeof key.id === 'string' ? key.id.trim() : null;
  const remoteJid = typeof key.remoteJid === 'string' ? key.remoteJid.trim() : null;

  if (!id || !remoteJid) {
    return null;
  }

  const chatType = classifyChatType(remoteJid);
  const senderId = (typeof key.participant === 'string' && key.participant.trim() !== '')
    ? key.participant.trim()
    : (typeof event.participant === 'string' && event.participant.trim() !== '')
      ? event.participant.trim()
      : remoteJid;

  const senderName = typeof event.pushName === 'string' && event.pushName.trim() !== ''
    ? event.pushName.trim()
    : null;

  const chatName = typeof event.chatName === 'string' && event.chatName.trim() !== ''
    ? event.chatName.trim()
    : null;

  const timestamp = parseTimestamp(event.messageTimestamp);

  let text = '';
  let hasMedia = false;
  let media: MediaMetadata | null = null;
  let replyTo: ReplyContext | null = null;

  if (event.message && typeof event.message === 'object') {
    const msg = unwrapMessage(event.message as Record<string, unknown>);

    // 1. Plain Text
    if (typeof msg.conversation === 'string') {
      text = msg.conversation;
    }

    // 2. Extended Text Message
    else if (msg.extendedTextMessage && typeof msg.extendedTextMessage === 'object') {
      const ext = msg.extendedTextMessage as Record<string, unknown>;
      text = typeof ext.text === 'string' ? ext.text : '';
      replyTo = extractReplyContext(ext.contextInfo as Record<string, unknown> | undefined);
    }

    // 3. Media Messages
    const mediaTypes: Array<{ key: string; type: MediaType }> = [
      { key: 'imageMessage', type: 'image' },
      { key: 'videoMessage', type: 'video' },
      { key: 'audioMessage', type: 'audio' },
      { key: 'documentMessage', type: 'document' },
      { key: 'stickerMessage', type: 'sticker' }
    ];

    for (const m of mediaTypes) {
      if (msg[m.key] && typeof msg[m.key] === 'object') {
        const mediaObj = msg[m.key] as Record<string, unknown>;
        hasMedia = true;

        if (typeof mediaObj.caption === 'string') {
          text = mediaObj.caption;
        }

        const mimetype = typeof mediaObj.mimetype === 'string' ? mediaObj.mimetype : null;
        const fileName = typeof mediaObj.fileName === 'string' ? mediaObj.fileName : null;
        const fileSize = typeof mediaObj.fileLength === 'number'
          ? mediaObj.fileLength
          : typeof mediaObj.fileLength === 'string'
            ? Number(mediaObj.fileLength) || null
            : null;

        media = {
          type: m.type,
          mimetype,
          fileName,
          fileSize
        };

        if (!replyTo && mediaObj.contextInfo && typeof mediaObj.contextInfo === 'object') {
          replyTo = extractReplyContext(mediaObj.contextInfo as Record<string, unknown>);
        }

        break;
      }
    }
  }

  // Explicitly reject internal protocol events or encryption key exchanges
  if (event.message && typeof event.message === 'object') {
    const rawMsg = event.message as Record<string, unknown>;
    if (rawMsg.protocolMessage || rawMsg.senderKeyDistributionMessage) {
      return null;
    }
  }

  // Reject contentless events that have neither text nor media (e.g. status/handshake pings)
  if ((!text || text.trim() === '') && !hasMedia) {
    return null;
  }

  return {
    id,
    chatId: remoteJid,
    chatName,
    chatType,
    senderId,
    senderName,
    timestamp,
    text,
    hasMedia,
    media,
    replyTo,
    rawPayload: event
  };
}
