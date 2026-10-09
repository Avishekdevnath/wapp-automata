import React, { useState, useEffect } from 'react';
import { X, Edit3, Building2, User, Globe, Phone, Loader2 } from 'lucide-react';
import { createVendor, type BackendVendorItem } from '../../api/client';

interface EditVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  vendor: BackendVendorItem | null;
}

export const EditVendorModal: React.FC<EditVendorModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
  vendor,
}) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vendor) {
      setName(vendor.name || '');
      setCompany(vendor.company || '');
      setCountry(vendor.country || '');
      setError(null);
    }
  }, [vendor]);

  if (!isOpen || !vendor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Carrier name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createVendor({
        phone: vendor.phone,
        name: name.trim(),
        company: company.trim() || undefined,
        country: country.trim() || vendor.country,
      });

      if (res) {
        onUpdated();
        onClose();
      } else {
        setError('Failed to update carrier.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error updating carrier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-2xl shadow-2xl overflow-hidden select-text flex flex-col transition-colors"
        role="dialog"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-dark-800 flex items-center justify-between bg-slate-50 dark:bg-dark-950">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Edit3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Edit Carrier / Account Manager</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Read-only Phone */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>WhatsApp Phone (Fixed Identifier)</span>
            </label>
            <input
              type="text"
              readOnly
              value={vendor.phone}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-dark-950/70 border border-slate-200 dark:border-dark-800 text-slate-500 font-mono text-xs cursor-not-allowed select-all"
            />
          </div>

          {/* Carrier Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-500" />
              <span>Carrier / Trader Name</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe, Hani Echolink"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-dark-950 border border-slate-200 dark:border-dark-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Company */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Company / Wholesale Desk</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Echolink Tel Ltd, Tata Wholesale"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-dark-950 border border-slate-200 dark:border-dark-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Country */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              <span>Country / Region</span>
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Bangladesh 🇧🇩, United Kingdom 🇬🇧"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-dark-950 border border-slate-200 dark:border-dark-700 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary btn-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin pointer-events-none" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
