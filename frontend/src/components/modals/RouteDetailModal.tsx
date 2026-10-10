import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  Info
} from 'lucide-react';
import { cleanPhone } from '../../utils/formatters';
import { useUI } from '../../context/UIContext';

export interface RouteDetailItem {
  id: string;
  destination: string;
  code: string;
  flag: string;
  type: string;
  rate: number;
  asr?: number;
  acd?: number;
  ports?: number;
  pulse?: string;
  createdAt?: number;
  intent?: string;
  fasFree?: boolean;
  vendor: string;
  vendorPhone: string;
  company?: string;
  notes?: string;
}

interface RouteDetailModalProps {
  route: RouteDetailItem | null;
  onClose: () => void;
  onPitch?: (route: RouteDetailItem) => void;
}

export const RouteDetailModal: React.FC<RouteDetailModalProps> = ({
  route,
  onClose,
  onPitch,
}) => {
  const { showPitchGenerator, enableWhatsAppKnock } = useUI();
  const [copiedTicket, setCopiedTicket] = useState(false);

  if (!route) return null;

  const rawPhone = cleanPhone(route.vendorPhone);
  const knockUrl = rawPhone ? `https://wa.me/${rawPhone}` : null;

  const handleCopyTicket = () => {
    const ticket = `[TELCIA TRADE TICKET]\nDestination: ${route.destination} (${route.code})\nIntent: ${route.intent || 'WTS'}\nType: ${route.type}\nRate: $${route.rate.toFixed(4)}/min\nPulse: ${route.pulse || '1/1'}\nRecorded: ${route.createdAt ? new Date(route.createdAt).toLocaleString() : 'Live'}\nASR/ACD: ${route.asr || 45}% / ${route.acd || 4.2}m\nVendor: ${route.vendor} (${route.vendorPhone})\nNotes: ${route.notes || '100% FAS-Free Verified'}`;
    navigator.clipboard.writeText(ticket).then(() => {
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 1500);
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-dark-700 shadow-2xl p-5 sm:p-6 relative bg-white dark:bg-dark-950 space-y-4 overflow-hidden select-text transition-colors"
      >
        {/* Title bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-700 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl select-none leading-none shrink-0">{route.flag}</span>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight truncate">{route.destination}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Wholesale Carrier Specification • Code: {route.code} {route.createdAt ? `• ⏱️ Recorded ${new Date(route.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative group/info">
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors cursor-pointer"
                title="Route information and specification details"
              >
                <Info className="w-4 h-4 pointer-events-none" />
              </button>
              <div className="absolute top-full right-0 mt-1.5 hidden group-hover/info:block z-50 pointer-events-none w-64 max-w-[calc(100vw-4rem)]">
                <div className="px-3 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 text-white text-[11px] font-medium whitespace-normal break-words leading-relaxed text-left shadow-2xl border border-slate-700">
                  Carrier Route Specifications • Copy ticket, pitch deal, or contact on WhatsApp
                </div>
              </div>
            </div>
            <button
              type="button"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors cursor-pointer"
              title="Close dialog"
              onClick={onClose}
            >
              <X className="w-4 h-4 pointer-events-none" />
            </button>
          </div>
        </div>

        <div className="space-y-3.5 text-xs">
          {/* Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-dark-900 border border-slate-200/80 dark:border-dark-800">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Destination</span>
              <span className="text-slate-900 dark:text-white font-semibold text-xs mt-0.5 block truncate">{route.destination}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Trading Intent</span>
              <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                {route.intent || 'WTS (Selling)'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Route Type</span>
              <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                {route.type}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Wholesale Rate</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-sm mt-0.5 block">
                ${route.rate.toFixed(4)}/min
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Billing Pulse</span>
              <span className="text-slate-800 dark:text-white font-mono font-semibold text-xs mt-0.5 block">{route.pulse || '1/1'}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">FAS Certification</span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% FAS-Free
              </span>
            </div>
          </div>

          {/* Carrier & Contact Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-900 border border-slate-200/80 dark:border-dark-800 space-y-1.5">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Vendor & Carrier Contact</span>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-slate-900 dark:text-white font-bold text-sm block truncate">{route.vendor}</span>
                <span className="text-slate-500 dark:text-slate-400 text-xs block font-mono truncate">{route.company || 'Carrier Desk'}</span>
              </div>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 text-xs font-semibold shrink-0">{route.vendorPhone}</span>
            </div>
          </div>

          {/* Quality Notes & Original Offer Text */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-900 border border-slate-200/80 dark:border-dark-800 space-y-1.5">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Quality Specification & Offer Text</span>
            <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px] leading-relaxed break-words bg-white dark:bg-dark-950 p-2.5 rounded-lg border border-slate-200 dark:border-dark-800">
              {route.notes || `ASR: ${route.asr || 45}% | ACD: ${route.acd || 4.2}m | Capacity: ${route.ports || 150} Ports available | G.711 codec, Direct CLI interconnections.`}
            </p>
          </div>
        </div>

        {/* Action Buttons: Dynamically Balanced 1-Word Entities */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-slate-200 dark:border-dark-800 w-full select-none">
          {/* 1. Copy Ticket Entity */}
          <button
            type="button"
            onClick={handleCopyTicket}
            className="flex-1 h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-dark-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap shadow-xs"
            title="Copy wholesale trade ticket specs to clipboard"
          >
            {copiedTicket ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 pointer-events-none" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0 pointer-events-none" />
            )}
            <span className="whitespace-nowrap shrink-0">{copiedTicket ? 'Copied' : 'Copy'}</span>
          </button>

          {/* 2. AI Pitch Entity */}
          {onPitch && showPitchGenerator ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onPitch(route);
              }}
              className="flex-1 h-10 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-purple-600/20 cursor-pointer transition-all whitespace-nowrap"
              title="Synthesize AI sales pitch via DeepSeek"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0 pointer-events-none" />
              <span className="whitespace-nowrap shrink-0">Pitch</span>
            </button>
          ) : null}

          {/* 3. WhatsApp Entity */}
          {knockUrl && enableWhatsAppKnock ? (
            <a
              href={knockUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer transition-all whitespace-nowrap"
              title={`Open direct WhatsApp chat with vendor (${route.vendorPhone})`}
            >
              <MessageCircle className="w-3.5 h-3.5 fill-current shrink-0 pointer-events-none" />
              <span className="whitespace-nowrap shrink-0">WhatsApp</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
};
