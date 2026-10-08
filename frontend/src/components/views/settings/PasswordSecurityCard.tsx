import React, { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { updateTerminalPassword } from '../../../api/client';

export const PasswordSecurityCard: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', text: 'New passwords do not match. Please re-enter.' });
      return;
    }
    if (newPassword.length < 4) {
      setPasswordFeedback({ type: 'error', text: 'New password must be at least 4 characters long.' });
      return;
    }

    setPasswordLoading(true);
    setPasswordFeedback(null);
    try {
      const res = await updateTerminalPassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordFeedback({ type: 'success', text: 'Password successfully updated and persisted!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordFeedback({ type: 'error', text: res.message });
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900/60 shadow-md dark:shadow-xl space-y-4 flex flex-col justify-between">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                Terminal Password & Security
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Change dashboard gate password (persisted in .env)
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
            Protected
          </span>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-2.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={4}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 4 chars"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={4}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {passwordFeedback && (
            <div
              className={`text-[11px] p-2.5 rounded-lg font-medium border ${
                passwordFeedback.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30'
              }`}
            >
              {passwordFeedback.text}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={passwordLoading}
              className="btn btn-primary btn-sm text-xs font-semibold flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{passwordLoading ? 'Saving...' : 'Save & Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
