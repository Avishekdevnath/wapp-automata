import React, { useState } from 'react';
import { X, UserPlus, Phone, Building2, User, Globe, Route, DollarSign, Loader2 } from 'lucide-react';
import { createVendor, type CreateVendorPayload } from '../../api/client';

interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const AddVendorModal: React.FC<AddVendorModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState('');
  const [includeRoute, setIncludeRoute] = useState(false);
  const [destination, setDestination] = useState('');
  const [routeType, setRouteType] = useState('CLI');
  const [pulse, setPulse] = useState('1/1');
  const [rate, setRate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const detectCountryFromPhone = (p: string): string => {
    const clean = p.replace(/\D/g, '');
    if (clean.startsWith('880')) return 'Bangladesh 🇧🇩';
    if (clean.startsWith('44')) return 'United Kingdom 🇬🇧';
    if (clean.startsWith('1')) return 'United States 🇺🇸';
    if (clean.startsWith('971')) return 'United Arab Emirates 🇦🇪';
    if (clean.startsWith('65')) return 'Singapore 🇸🇬';
    if (clean.startsWith('92')) return 'Pakistan 🇵🇰';
    if (clean.startsWith('91')) return 'India 🇮🇳';
    if (clean.startsWith('49')) return 'Germany 🇩🇪';
    if (clean.startsWith('33')) return 'France 🇫🇷';
    if (clean.startsWith('86')) return 'China 🇨🇳';
    if (clean.startsWith('60')) return 'Malaysia 🇲🇾';
    if (clean.startsWith('966')) return 'Saudi Arabia 🇸🇦';
    if (clean.startsWith('62')) return 'Indonesia 🇮🇩';
    if (clean.startsWith('63')) return 'Philippines 🇵🇭';
    if (clean.startsWith('84')) return 'Vietnam 🇻🇳';
    return 'International 🌐';
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (!country || country === 'International 🌐') {
      const detected = detectCountryFromPhone(val);
      if (detected !== 'International 🌐') {
        setCountry(detected);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanP = phone.trim();
    if (!cleanP) {
      setError('WhatsApp phone number is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: CreateVendorPayload = {
      phone: cleanP.startsWith('+') ? cleanP : `+${cleanP.replace(/\D/g, '')}`,
      name: name.trim() || company.trim() || cleanP,
      company: company.trim() || undefined,
      country: country.trim() || detectCountryFromPhone(cleanP),
    };

    if (includeRoute && destination.trim()) {
      payload.destination = destination.trim();
      payload.route_type = routeType;
      payload.billing_pulse = pulse;
      if (rate.trim()) {
        const parsedRate = parseFloat(rate);
        if (!isNaN(parsedRate) && parsedRate > 0) {
          payload.rate_per_min = parsedRate;
        }
      }
    }

    try {
      const res = await createVendor(payload);
      if (res) {
        onCreated();
        onClose();
      } else {
        setError('Failed to create vendor entity. Please verify phone number.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error creating vendor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="glass-card w-full max-w-lg rounded-2xl border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-dark-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <UserPlus className="w-5 h-5 pointer-events-none" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Verified Carrier Partner
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Register an authentic telecom desk, interconnect partner, or account manager.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Phone Number (Required) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-purple-500" />
              WhatsApp Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. +12025550199 or +447700900077"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Carrier / Company */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-purple-500" />
                Company / Carrier Name
              </label>
              <input
                type="text"
                placeholder="e.g. VoiceTrade LLC"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Contact Person */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-500" />
                Contact Person Name
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-purple-500" />
              Country / Headquarters
            </label>
            <input
              type="text"
              placeholder="e.g. United States 🇺🇸"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Toggle Optional Initial Route */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIncludeRoute(!includeRoute)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>{includeRoute ? '− Remove Initial Route Offer' : '+ Attach Initial Route Offer'}</span>
            </button>
          </div>

          {includeRoute && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Route className="w-3 h-3 text-purple-500" />
                    Destination Country
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Colombia, USA"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Route Type
                  </label>
                  <select
                    value={routeType}
                    onChange={(e) => setRouteType(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="CLI">CLI</option>
                    <option value="CC CLI">CC CLI</option>
                    <option value="Non-CLI">Non-CLI</option>
                    <option value="IVR">IVR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-500" />
                    Rate ($/min)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 0.0055"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Billing Pulse
                  </label>
                  <select
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                  >
                    <option value="1/1">1/1</option>
                    <option value="60/1">60/1</option>
                    <option value="60/60">60/60</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-dark-800">
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
              className="btn btn-primary btn-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Carrier...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Save & Verify Carrier</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
