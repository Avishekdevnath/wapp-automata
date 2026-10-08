import React, { useState, useEffect } from 'react';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import { fetchDmSettings, updateDmSettings } from '../../../api/client';
import { ToggleSwitch } from './ToggleSwitch';

export const DmRecordingCard: React.FC = () => {
  const [recordDms, setRecordDms] = useState(false);
  const [dmLoading, setDmLoading] = useState(false);
  const [dmFeedback, setDmFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetchDmSettings().then((val) => setRecordDms(val));
  }, []);

  const handleToggleDms = async (checked: boolean) => {
    setDmLoading(true);
    try {
      const ok = await updateDmSettings(checked);
      setRecordDms(ok);
      setDmFeedback(
        ok
          ? 'DM recording enabled (Zero-Seen guarantee: no blue ticks)'
          : 'DM recording disabled. Ingesting groups only.'
      );
      setTimeout(() => setDmFeedback(null), 3000);
    } catch {
      setDmFeedback('Failed to update DM recording setting');
      setTimeout(() => setDmFeedback(null), 3000);
    } finally {
      setDmLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900/60 shadow-md dark:shadow-xl space-y-4 flex flex-col justify-between">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                Direct Message (DM) Ingestion
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Selective 1-on-1 chat recording with Zero-Seen Guarantee
              </p>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
              recordDms
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30'
            }`}
          >
            {recordDms ? 'DMs Recorded (Zero-Seen)' : 'DMs Ignored'}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {/* Toggle Switch Row */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-900 dark:text-white block">
                Record Direct Messages (DMs)
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
                Capture 1-on-1 private WhatsApp messages alongside groups
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold ${
                  recordDms ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {recordDms ? 'ON' : 'OFF'}
              </span>
              <ToggleSwitch
                checked={recordDms}
                disabled={dmLoading}
                onChange={handleToggleDms}
                size="md"
              />
            </div>
          </div>

          {dmFeedback && (
            <div className="text-[11px] p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
              {dmFeedback}
            </div>
          )}

          {/* Zero-Seen Guarantee Callout */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-slate-800 dark:text-emerald-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Zero-Seen Guarantee Active</span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-emerald-400/80 leading-relaxed">
              WhatsApp read receipts are strictly disabled for 1-on-1 chats. Messages remain unread on the
              sender's device even when recorded. Groups (@g.us) are marked as seen automatically to clear
              notification badges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
