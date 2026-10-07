export interface MediaAttachment {
  type?: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'contact' | 'location';
  mimetype?: string;
  fileName?: string;
  fileSize?: number;
  durationSeconds?: number;
  isVoiceNote?: boolean;
  caption?: string;
}

export interface ReplyContext {
  senderId?: string;
  senderName?: string;
  quotedText?: string;
  messageId?: string;
}

export interface ContactData {
  name?: string;
  phone?: string;
  profile_picture?: string;
}

export interface LocationData {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
}

export interface WhatsAppMessage {
  id: string;
  timestamp?: string;
  occurred_at?: string;
  sender_name?: string | null;
  sender_phone?: string | null;
  sender_avatar_url?: string | null;
  avatar_url?: string | null;
  is_from_me?: boolean;
  chat_jid?: string;
  chat_name?: string | null;
  chat_type?: 'group' | 'direct' | 'individual' | 'status';
  is_archived?: boolean;
  text?: string | null;
  has_media?: boolean;
  media?: MediaAttachment | null;
  media_id?: string | null;
  reply_to?: ReplyContext | null;
  contact?: ContactData | null;
  location?: LocationData | null;
  raw_envelope?: {
    message?: {
      media?: MediaAttachment;
      reply_to?: ReplyContext;
      raw_payload?: Record<string, unknown>;
    };
    [key: string]: unknown;
  } | null;
}

export interface StreamStats {
  total: number;
  groups: number;
  archived: number;
  senders: number;
}
