import React, { useState } from 'react';
import { Radio, KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { loginWithPassword } from '../../api/client';

interface AuthOverlayProps {
  onSuccess: () => void;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const ok = await loginWithPassword(password);
      if (ok) {
        if (remember) {
          localStorage.setItem('wapp_authenticated', 'true');
        } else {
          sessionStorage.setItem('wapp_authenticated', 'true');
        }
        onSuccess();
      } else {
        setErrorMsg('Invalid password. Please check your credentials.');
      }
    } catch {
      setErrorMsg('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/95 backdrop-blur-xl">
      <div className="glass-card max-w-md w-full rounded-3xl p-8 border border-dark-700 shadow-2xl space-y-6 text-center">
        {/* Icon & Branding (Telco Man Bangladesh Motif) */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#006a4e] via-emerald-600 to-[#004d38] p-[1.5px] mx-auto shadow-xl shadow-emerald-950/40 relative">
          <div className="w-full h-full bg-slate-950 dark:bg-dark-950 rounded-[15px] flex items-center justify-center relative overflow-hidden">
            <span className="absolute w-6 h-6 rounded-full bg-[#f42a41] opacity-90 shadow-[0_0_12px_rgba(244,42,65,0.7)]" />
            <Radio className="w-7 h-7 text-white relative z-10 drop-shadow-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Telcia</h2>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-[#006a4e]/25 text-emerald-400 border border-[#006a4e]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f42a41] animate-pulse" />
              AI
            </span>
          </div>
          <p className="text-xs text-slate-400">Telecom Intelligent Agent • Wholesale Carrier Terminal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Terminal Access Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                id="auth-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (default: wapp2026)"
                required
                className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Keep Logged In Option */}
          <div className="flex items-center justify-between text-xs text-slate-400 py-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-emerald-500 focus:ring-emerald-500/20 accent-emerald-500 cursor-pointer"
              />
              <span className="text-slate-300 font-medium text-xs">Stay logged in</span>
            </label>
            <span className="text-[11px] text-slate-500">Persistent across reloads</span>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 font-medium text-center">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Unlock Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-slate-500">End-to-End Encrypted Gateway • Bijoytel Network</p>
      </div>
    </div>
  );
};
