import React, { useState } from 'react';
import {
  Copy,
  Check,
  Eye,
  MessageCircle,
  FileSpreadsheet,
  Mic,
  Image,
  Video,
  UserCheck,
  MapPin,
  Paperclip,
  Reply,
  Archive,
  Users
} from 'lucide-react';
import type { WhatsAppMessage } from '../../types/message';
import { formatTime, formatDate, cleanPhone } from '../../utils/formatters';
import { useUI } from '../../context/UIContext';
import { ProfileAvatar } from '../common/ProfileAvatar';
import { WhatsAppMarkdown } from '../common/WhatsAppMarkdown';

interface MessageRowProps {
  message: WhatsAppMessage;
  onViewDetail: (message: WhatsAppMessage) => void;
}

const MessageRowInner: React.FC<MessageRowProps> = ({ message, onViewDetail }) => {
  const { enableWhatsAppKnock } = useUI();
  const [copied, setCopied] = useState(false);

  const isOutbound = Boolean(message.is_from_me);
  const isArchived = Boolean(message.is_archived);
  const isGroup = message.chat_type === 'group';

  const timeStr = formatTime(message.occurred_at || message.timestamp);
  const dateStr = formatDate(message.occurred_at || message.timestamp);
  const rawPhone = cleanPhone(message.sender_phone);
  const knockUrl = (!isOutbound && rawPhone) ? `https://wa.me/${rawPhone}` : null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = message.text || '';
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Media Chip Rendering
  const mediaObj = message.media || message.raw_envelope?.message?.media;
  const mediaType = mediaObj?.type || (message.has_media ? 'media' : null);

  const renderMediaChip = () => {
    if (!mediaType) return null;

    if (mediaType === 'audio') {
      const dur = mediaObj?.durationSeconds
        ? `${Math.floor(mediaObj.durationSeconds / 60)}:${String(mediaObj.durationSeconds % 60).padStart(2, '0')}`
        : '';
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] font-semibold">
          <Mic className="w-2.5 h-2.5 text-purple-400" />
          <span>Voice Note{dur ? ` (${dur})` : ''}</span>
        </span>
      );
    }

    if (mediaType === 'document') {
      const docName = mediaObj?.fileName || 'Document';
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-[10px] font-semibold max-w-[180px] truncate" title={docName}>
          <FileSpreadsheet className="w-2.5 h-2.5 text-sky-400 shrink-0" />
          <span className="truncate">{docName}</span>
        </span>
      );
    }

    if (mediaType === 'image') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-semibold">
          <Image className="w-2.5 h-2.5 text-emerald-400" />
          <span>Photo Attachment</span>
        </span>
      );
    }

    if (mediaType === 'video') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-semibold">
          <Video className="w-2.5 h-2.5 text-rose-400" />
          <span>Video</span>
        </span>
      );
    }

    if (mediaType === 'contact') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-semibold">
          <UserCheck className="w-2.5 h-2.5 text-amber-400" />
          <span>Contact Card</span>
        </span>
      );
    }

    if (mediaType === 'location') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-semibold">
          <MapPin className="w-2.5 h-2.5 text-rose-400" />
          <span>Location</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-semibold">
        <Paperclip className="w-2.5 h-2.5" />
        <span className="capitalize">{mediaType}</span>
      </span>
    );
  };

  return (
    <tr
      onClick={() => onViewDetail(message)}
      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors cursor-pointer group"
    >
      {/* Col 1: Time & Date */}
      <td className="py-3 px-4 align-top w-28 sm:w-32 shrink-0 select-none">
        <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">{timeStr}</div>
        {dateStr && <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tracking-tight mt-0.5">{dateStr}</div>}
      </td>

      {/* Col 2: Sender & Chat Context */}
      <td className="py-3 px-4 align-top w-48 sm:w-60 min-w-0">
        <div className="flex items-start gap-2.5">
          <ProfileAvatar
            name={message.sender_name}
            phone={message.sender_phone}
            isGroup={isGroup}
            isOutbound={isOutbound}
            avatarUrl={message.contact?.profile_picture}
            size="md"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 leading-tight">
              <span
                className={`font-bold text-xs truncate ${
                  isOutbound ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-900 dark:text-white'
                }`}
                title={message.sender_name || message.sender_phone || 'Carrier'}
              >
                {message.sender_name || (isOutbound ? 'You' : message.sender_phone || 'Carrier Trader')}
              </span>
            </div>

            {message.sender_phone && !isOutbound && message.sender_name && (
              <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {message.sender_phone}
              </div>
            )}

            <div className="flex items-center gap-1 flex-wrap mt-1.5">
              {isOutbound && (
                <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 text-[9px] font-semibold">
                  You
                </span>
              )}
              {isArchived && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 text-[9px] font-semibold flex items-center gap-0.5">
                  <Archive className="w-2.5 h-2.5" />
                  <span>Archived</span>
                </span>
              )}
              {isGroup ? (
                <span
                  className="px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 text-[9px] font-semibold truncate max-w-[130px] flex items-center gap-0.5"
                  title={message.chat_name || 'Group'}
                >
                  <Users className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{message.chat_name || 'Group'}</span>
                </span>
              ) : (
                !isOutbound && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-medium">
                    Direct
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Col 3: Message Content */}
      <td className="py-3 px-4 align-top min-w-0 select-text">
        <div className="space-y-1.5">
          {renderMediaChip()}

          {message.reply_to && (
            <div className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Reply className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400" />
              <span>Quoted reply</span>
            </div>
          )}

          {message.text ? (
            <div className="space-y-1">
              <div
                className="text-xs text-slate-800 dark:text-slate-200 font-sans leading-relaxed break-words line-clamp-2 sm:line-clamp-3 select-text group-hover:text-emerald-800 dark:group-hover:text-emerald-200 transition-colors"
                title="Click row to open full message modal"
              >
                <WhatsAppMarkdown content={message.text.trim()} compact />
              </div>
              {(message.text.length > 100 || message.text.includes('\n')) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetail(message);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline transition-colors cursor-pointer select-none"
                  title="View full message in modal"
                >
                  <Eye className="w-3 h-3" />
                  <span>Show full message</span>
                </button>
              )}
            </div>
          ) : (
            !mediaType && (
              <div className="italic text-slate-400 dark:text-slate-500 text-xs">[No text content]</div>
            )
          )}
        </div>
      </td>

      {/* Col 4: Actions */}
      <td
        className="py-3 px-4 align-top w-28 text-right shrink-0 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={handleCopy}
            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all text-[11px] font-medium flex items-center gap-1 shadow-xs"
            title="Copy message text"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </button>

          <button
            onClick={() => onViewDetail(message)}
            className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-600 text-emerald-600 dark:text-emerald-300 hover:text-white transition-all text-[11px] font-semibold flex items-center gap-1 shadow-xs"
            title="View message inspector modal"
          >
            <Eye className="w-3 h-3" />
            <span>View</span>
          </button>

          {knockUrl && enableWhatsAppKnock && (
            <a
              href={knockUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              title="Chat on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
};

export const MessageRow = React.memo(MessageRowInner, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.occurred_at === next.message.occurred_at &&
    prev.message.text === next.message.text &&
    prev.message.is_archived === next.message.is_archived
  );
});
