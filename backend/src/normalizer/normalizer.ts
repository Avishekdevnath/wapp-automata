import { NormalizedEnvelope, ChatType, MediaType, MediaMetadata, ReplyContext, SharedContact, SharedLocation } from './types';

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
  const isFromMe = Boolean(key.fromMe);
  const isArchived = Boolean((event as Record<string, unknown>).isArchived || (event as Record<string, unknown>).archived);

  let senderId = (typeof key.participant === 'string' && key.participant.trim() !== '')
    ? key.participant.trim()
    : (typeof event.participant === 'string' && event.participant.trim() !== '')
      ? event.participant.trim()
      : remoteJid;

  if (isFromMe && chatType === 'individual' && !key.participant) {
    senderId = typeof (event as Record<string, unknown>).accountJid === 'string'
      ? (event as Record<string, unknown>).accountJid as string
      : 'me';
  }

  const senderName = typeof event.pushName === 'string' && event.pushName.trim() !== ''
    ? event.pushName.trim()
    : (isFromMe ? 'You' : null);

  const chatName = typeof event.chatName === 'string' && event.chatName.trim() !== ''
    ? event.chatName.trim()
    : null;

  const timestamp = parseTimestamp(event.messageTimestamp);

  let text = '';
  let hasMedia = false;
  let media: MediaMetadata | null = null;
  let replyTo: ReplyContext | null = null;
  let contact: SharedContact | null = null;
  let location: SharedLocation | null = null;

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

        const isVoiceNote = Boolean(mediaObj.ptt);
        const durationSeconds = typeof mediaObj.seconds === 'number' ? mediaObj.seconds : null;

        media = {
          type: m.type,
          mimetype,
          fileName,
          fileSize,
          durationSeconds,
          isVoiceNote
        };

        if (!replyTo && mediaObj.contextInfo && typeof mediaObj.contextInfo === 'object') {
          replyTo = extractReplyContext(mediaObj.contextInfo as Record<string, unknown>);
        }

        break;
      }
    }

    // 4. Contact Cards (vCards)
    if (!hasMedia && msg.contactMessage && typeof msg.contactMessage === 'object') {
      const c = msg.contactMessage as Record<string, unknown>;
      const name = typeof c.displayName === 'string' ? c.displayName : 'Shared Contact';
      const vcard = typeof c.vcard === 'string' ? c.vcard : '';
      let phone = '';
      const waidMatch = vcard.match(/waid=(\d+)/i) || vcard.match(/TEL[^:]*:([^\r\n]+)/i);
      if (waidMatch) phone = '+' + waidMatch[1].replace(/[^0-9]/g, '');
      contact = { name, phone, vcard };
      if (!text) text = `📇 Contact Card: ${name}${phone ? ` (${phone})` : ''}`;
      hasMedia = true;
      media = {
        type: 'contact',
        mimetype: 'text/vcard',
        fileName: `${name}.vcf`,
        fileSize: vcard.length
      };
    } else if (!hasMedia && msg.contactsArrayMessage && typeof msg.contactsArrayMessage === 'object') {
      const ca = msg.contactsArrayMessage as Record<string, unknown>;
      const contactsList = Array.isArray(ca.contacts) ? ca.contacts as Array<Record<string, unknown>> : [];
      if (contactsList.length > 0) {
        const first = contactsList[0];
        const name = typeof first.displayName === 'string' ? first.displayName : (typeof ca.displayName === 'string' ? ca.displayName : 'Shared Contacts');
        const vcard = typeof first.vcard === 'string' ? first.vcard : '';
        let phone = '';
        const waidMatch = vcard.match(/waid=(\d+)/i) || vcard.match(/TEL[^:]*:([^\r\n]+)/i);
        if (waidMatch) phone = '+' + waidMatch[1].replace(/[^0-9]/g, '');
        contact = { name, phone, vcard };
        if (!text) text = `📇 Shared Contacts (${contactsList.length}): ${name}${phone ? ` (${phone})` : ''}`;
        hasMedia = true;
        media = {
          type: 'contact',
          mimetype: 'text/vcard',
          fileName: `${name}.vcf`,
          fileSize: vcard.length
        };
      }
    }

    // 5. Location Messages
    else if (!hasMedia && msg.locationMessage && typeof msg.locationMessage === 'object') {
      const loc = msg.locationMessage as Record<string, unknown>;
      const lat = Number(loc.degreesLatitude) || 0;
      const lng = Number(loc.degreesLongitude) || 0;
      const locName = typeof loc.name === 'string' ? loc.name : null;
      const locAddress = typeof loc.address === 'string' ? loc.address : null;
      location = { latitude: lat, longitude: lng, name: locName, address: locAddress };
      if (!text) text = `📍 Shared Location: ${[locName, locAddress].filter(Boolean).join(', ') || `${lat}, ${lng}`}`;
      hasMedia = true;
      media = {
        type: 'location',
        mimetype: 'application/geo+json',
        fileName: null,
        fileSize: null
      };
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
    contact,
    location,
    isFromMe,
    isArchived,
    replyTo,
    rawPayload: event
  };
}
