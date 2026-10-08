import React, { useState } from 'react';
import { PlusCircle, X, Loader2, Info } from 'lucide-react';
import type { RouteDetailItem } from './RouteDetailModal';

interface PostRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostRoute: (route: Partial<RouteDetailItem>) => Promise<boolean>;
}

export const PostRouteModal: React.FC<PostRouteModalProps> = ({
  isOpen,
  onClose,
  onPostRoute,
}) => {
  const [country, setCountry] = useState('');
  const [intent, setIntent] = useState('WTS');
  const [routeType, setRouteType] = useState('Direct CLI');
  const [pulse, setPulse] = useState('1/1');
  const [rate, setRate] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [fasFree, setFasFree] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const ok = await onPostRoute({
        destination: `${country} Mobile`,
        code: country === 'Bangladesh' ? '880' : '1',
        flag: country === 'Bangladesh' ? '🇧🇩' : '🌐',
        type: routeType,
        intent,
        pulse,
        rate: parseFloat(rate) || 0.01,
        vendor: vendorName || 'Direct Carrier Desk',
        vendorPhone,
        notes,
        fasFree,
      });
      if (ok) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-dark-700 shadow-2xl space-y-4 p-5 relative bg-white dark:bg-dark-950 overflow-hidden select-text transition-colors"
      >
        {/* Title bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-700 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <PlusCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight truncate">Post Wholesale Voice Route</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Broadcast offer or demand to terminal rate matrix</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative group/info">
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors cursor-pointer"
                title="Post route guidance"
              >
                <Info className="w-4 h-4 pointer-events-none" />
              </button>
              <div className="absolute top-full right-0 mt-1.5 hidden group-hover/info:flex flex-col items-end z-50 pointer-events-none">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-dark-950 text-white text-[11px] font-medium whitespace-nowrap shadow-xl border border-slate-700/80 max-w-xs">
                  Wholesale Route Posting • Broadcast live rates and port availability to the trading matrix
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

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Destination Country *</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="Bangladesh">🇧🇩 Bangladesh</option>
                <option value="USA">🇺🇸 USA</option>
                <option value="United Kingdom">🇬🇧 United Kingdom</option>
                <option value="Pakistan">🇵🇰 Pakistan</option>
                <option value="India">🇮🇳 India</option>
                <option value="Canada">🇨🇦 Canada</option>
                <option value="Singapore">🇸🇬 Singapore</option>
                <option value="Germany">🇩🇪 Germany</option>
                <option value="UAE">🇦🇪 UAE</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Trading Intent *</label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="WTS">🟢 Selling (WTS Offer)</option>
                <option value="WTB">🟡 Buying (WTB Requirement)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Route Type *</label>
              <select
                value={routeType}
                onChange={(e) => setRouteType(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="Direct CLI">Direct CLI</option>
                <option value="CC CLI">CC CLI</option>
                <option value="Direct NCLI">Direct NCLI</option>
                <option value="IVR">IVR</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Pulse *</label>
              <select
                value={pulse}
                onChange={(e) => setPulse(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="1/1">1/1</option>
                <option value="60/1">60/1</option>
                <option value="60/60">60/60</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Rate ($/min) *</label>
              <input
                type="number"
                step="0.0001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
                placeholder="0.0210"
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Vendor / Carrier Name</label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Apex Telecom Global"
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">WhatsApp Phone *</label>
              <input
                type="text"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                required
                placeholder="+1234567890"
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Quality Notes / Ports / Codecs</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 500 ports available, G711u/a, Clean ASR 45%, ACD 4.2m"
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="post-fas-free"
              checked={fasFree}
              onChange={(e) => setFasFree(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 text-emerald-500 accent-emerald-500 cursor-pointer"
            />
            <label htmlFor="post-fas-free" className="text-xs text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              100% FAS-Free Verified (No false answer billing)
            </label>
          </div>

          {/* Action Buttons: Clean 1-Word Entities */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-dark-800">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap shadow-xs"
              title="Discard offer and close modal"
            >
              <X className="w-3.5 h-3.5 shrink-0 pointer-events-none" />
              <span>Cancel</span>
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all whitespace-nowrap"
              title="Broadcast wholesale voice route to market matrix"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 pointer-events-none" /> : <PlusCircle className="w-3.5 h-3.5 shrink-0 pointer-events-none" />}
              <span>Post</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
