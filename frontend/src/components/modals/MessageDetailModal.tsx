import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  MessageCircle,
  FileSpreadsheet,
  Download,
  Mic,
  ChevronDown,
  ChevronUp,
  Reply,
  ShieldAlert
} from 'lucide-react';
import type { WhatsAppMessage } from '../../types/message';
import { formatTime, formatDate, cleanPhone } from '../../utils/formatters';
import { useUI } from '../../context/UIContext';
import { ProfileAvatar } from '../common/ProfileAvatar';
import { WhatsAppMarkdown } from '../common/WhatsAppMarkdown';

interface MessageDetailModalProps {
  message: WhatsAppMessage | null;
  onClose: () => void;
}

export const MessageDetailModal: React.FC<MessageDetailModalProps> = ({ message, onClose }) => {
  const { enableWhatsAppKnock } = useUI();
  const [copiedText, setCopiedText] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [viewRawText, setViewRawText] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [message?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!message) return null;

  const isOutbound = Boolean(message.is_from_me);
  const isGroup = message.chat_type === 'group';
  const rawPhone = cleanPhone(message.sender_phone);
  const knockUrl = (!isOutbound && rawPhone) ? `https://wa.me/${rawPhone}` : null;

  const handleCopyText = () => {
    if (!message.text) return;
    navigator.clipboard.writeText(message.text).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 1500);
    });
  };

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(message, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1500);
    });
  };

  const mediaObj = message.media || message.raw_envelope?.message?.media;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-text transition-colors"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/80 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <ProfileAvatar
              name={message.sender_name}
              phone={message.sender_phone}
              isGroup={isGroup}
              isOutbound={isOutbound}
              avatarUrl={message.contact?.profile_picture}
              size="lg"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {message.sender_name || (isOutbound ? 'You' : message.sender_phone || 'Carrier Trader')}
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                <span>ID: {message.id}</span>
                <span>•</span>
                <span>
                  {formatTime(message.occurred_at || message.timestamp)}{' '}
                  {formatDate(message.occurred_at || message.timestamp)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5 pointer-events-none" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div ref={bodyRef} className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Quoted Reply Context */}
          {message.reply_to && (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border-l-4 border-emerald-500 text-slate-700 dark:text-slate-300 space-y-1">
              <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Reply className="w-3.5 h-3.5" />
                <span>In Reply to {message.reply_to.senderName || message.reply_to.senderId || 'Message'}</span>
              </div>
              {message.reply_to.quotedText && (
                <div className="italic text-slate-400 whitespace-pre-wrap">
                  {message.reply_to.quotedText}
                </div>
              )}
            </div>
          )}

          {/* Media Attachments */}
          {mediaObj && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              {mediaObj.type === 'audio' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-200">
                      <Mic className="w-4 h-4 text-purple-400" />
                      <span>{mediaObj.isVoiceNote ? 'Voice Note' : 'Audio Message'}</span>
                    </div>
                    {mediaObj.durationSeconds && (
                      <span className="font-mono text-purple-400">
                        {Math.floor(mediaObj.durationSeconds / 60)}:
                        {String(mediaObj.durationSeconds % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                  {message.media_id ? (
                    <audio controls src={`/api/media/${message.media_id}`} className="w-full h-8 mt-1" />
                  ) : (
                    <div className="text-[11px] text-slate-500">Audio recorded on WhatsApp</div>
                  )}
                </div>
              )}

              {mediaObj.type === 'document' && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 truncate">
                        {mediaObj.fileName || 'Rate Sheet Document'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {mediaObj.fileSize ? `${Math.round(mediaObj.fileSize / 1024)} KB` : 'Attached File'}
                      </div>
                    </div>
                  </div>
                  {message.media_id && (
                    <a
                      href={`/api/media/${message.media_id}`}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white flex items-center gap-1.5 text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Full Verbatim Text Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span>Message Text</span>
                {message.text && message.text.trim() && (
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800/80 border border-slate-300/50 dark:border-slate-700/60 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setViewRawText(false)}
                      className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                        !viewRawText
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Formatted
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewRawText(true)}
                      className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                        viewRawText
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Raw
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 font-mono transition-colors cursor-pointer text-[11px]"
                title="Copy message text to clipboard"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500 pointer-events-none" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 pointer-events-none" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 font-sans text-xs text-slate-900 dark:text-slate-100 leading-relaxed break-words select-text selection:bg-emerald-500/30">
              {message.text && message.text.trim() ? (
                viewRawText ? (
                  <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed select-text text-slate-800 dark:text-slate-200">
                    {message.text.trim()}
                  </pre>
                ) : (
                  <WhatsAppMarkdown content={message.text.trim()} />
                )
              ) : (
                <span className="italic text-slate-400 dark:text-slate-500">
                  {mediaObj ? '[Media attachment without text caption]' : '[No text payload]'}
                </span>
              )}
            </div>
          </div>

          {/* Collapsible Raw JSON Envelope Inspector */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                <span>Raw WhatsApp Payload (JSON)</span>
              </div>
              <div className="flex items-center gap-2">
                {showRawJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showRawJson && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 font-mono cursor-pointer"
                  >
                    {copiedJson ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500 pointer-events-none" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 pointer-events-none" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 text-[11px] font-mono text-slate-800 dark:text-slate-300 overflow-x-auto max-h-60">
                  {JSON.stringify(message, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs">
          <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">Press ESC to close</div>
          <div className="flex items-center gap-2">
            {knockUrl && enableWhatsAppKnock && (
              <a
                href={knockUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                title={`Open direct WhatsApp chat with ${cleanPhone(message.sender_phone) || 'sender'}`}
              >
                <MessageCircle className="w-4 h-4 fill-current pointer-events-none shrink-0" />
                <span>Open in WhatsApp</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-semibold flex items-center transition-colors cursor-pointer"
              title="Close message inspector dialog"
            >
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
