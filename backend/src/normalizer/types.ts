/**
 * Canonical Normalized Message Envelope Types
 */

export type ChatType = 'individual' | 'group' | 'channel' | 'unknown';
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'contact' | 'location';

export interface MediaMetadata {
  type: MediaType;
  mimetype: string | null;
  fileName: string | null;
  fileSize: number | null;
  durationSeconds?: number | null;
  isVoiceNote?: boolean;
}

export interface SharedContact {
  name: string;
  phone: string;
  vcard?: string | null;
}

export interface SharedLocation {
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
}

export interface ReplyContext {
  messageId: string;
  senderId: string;
  quotedText: string | null;
}

export interface NormalizedEnvelope {
  /** Canonical WhatsApp message ID (wamid) */
  id: string;

  /** Remote chat JID (e.g. 1234567890-1612345678@g.us or 1234567890@s.whatsapp.net) */
  chatId: string;

  /** Group subject or contact push name if available; null otherwise */
  chatName: string | null;

  /** Categorized chat type */
  chatType: ChatType;

  /** Author/participant JID within the chat */
  senderId: string;

  /** Author's WhatsApp push name if available; null otherwise */
  senderName: string | null;

  /** Original Unix epoch timestamp in seconds from WhatsApp network */
  timestamp: number;

  /** Verbatim extracted message text or caption; empty string if media-only without caption */
  text: string;

  /** True if the message carries media attachments */
  hasMedia: boolean;

  /** Media metadata if hasMedia is true; null otherwise */
  media: MediaMetadata | null;

  /** Shared contact card if present */
  contact?: SharedContact | null;

  /** Shared location if present */
  location?: SharedLocation | null;

  /** True if message was sent from this device/account */
  isFromMe?: boolean;

  /** True if chat/group is marked as archived in WhatsApp */
  isArchived?: boolean;

  /** Quoted message context if this message was a reply; null otherwise */
  replyTo: ReplyContext | null;

  /** Complete unaltered provider event object for auditing and downstream re-processing */
  rawPayload: Record<string, unknown>;
}
