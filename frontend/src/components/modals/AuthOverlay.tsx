import React, { useState, useEffect } from 'react';
import {
  Radio,
  KeyRound,
  ArrowRight,
  Loader2,
  Smartphone,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import {
  loginWithPassword,
  fetchOtpStatus,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  type OtpStatusResponse
} from '../../api/client';

interface AuthOverlayProps {
  onSuccess: () => void;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({ onSuccess }) => {
  // Modes: 'login' | 'forgot'
  const [mode, setMode] = useState<'login' | 'forgot'>('login');

  // Login Form State
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot Password / OTP State
  const [otpStatus, setOtpStatus] = useState<OtpStatusResponse | null>(null);
  const [otpStatusLoading, setOtpStatusLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Load OTP status when switching to forgot mode
  useEffect(() => {
    if (mode === 'forgot') {
      setErrorMsg(null);
      setResetSuccessMsg(null);
      setOtpStatusLoading(true);
      fetchOtpStatus()
        .then((s) => {
          setOtpStatus(s);
          if (s.cooldownSeconds > 0) {
            setCooldown(s.cooldownSeconds);
          }
          if (s.hasActiveCode) {
            setOtpSent(true);
          }
        })
        .finally(() => setOtpStatusLoading(false));
    }
  }, [mode]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
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

  const handleSendOtp = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await requestPasswordResetOtp();
      if (res.success) {
        setOtpSent(true);
        setCooldown(60);
        setResetSuccessMsg('6-digit code sent to your linked WhatsApp device!');
      } else {
        setErrorMsg(res.error || 'Failed to deliver OTP to WhatsApp.');
      }
    } catch {
      setErrorMsg('Network error while requesting code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !newPassword) return;

    if (newPassword.length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await verifyPasswordResetOtp(otpCode.trim(), newPassword.trim());
      if (res.success) {
        setResetSuccessMsg('Password reset successfully! Logging in...');
        if (remember) {
          localStorage.setItem('wapp_authenticated', 'true');
        } else {
          sessionStorage.setItem('wapp_authenticated', 'true');
        }
        setTimeout(() => {
          onSuccess();
        }, 900);
      } else {
        setErrorMsg(res.error || 'Invalid or expired code.');
      }
    } catch {
      setErrorMsg('Network error while verifying code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/95 backdrop-blur-xl select-none">
      <div className="glass-card max-w-md w-full rounded-3xl p-7 sm:p-8 border border-dark-700 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Branding Icon (Telco Man Bangladesh Motif) */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#006a4e] via-emerald-600 to-[#004d38] p-[1.5px] mx-auto shadow-xl shadow-emerald-950/40 relative">
          <div className="w-full h-full bg-slate-950 dark:bg-dark-950 rounded-[15px] flex items-center justify-center relative overflow-hidden">
            <span className="absolute w-6 h-6 rounded-full bg-[#f42a41] opacity-90 shadow-[0_0_12px_rgba(244,42,65,0.7)]" />
            <Radio className="w-7 h-7 text-white relative z-10 drop-shadow-sm" />
          </div>
        </div>

        {/* 1. STANDARD LOGIN MODE */}
        {mode === 'login' ? (
          <>
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

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Terminal Access Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    id="auth-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoFocus
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Keep Logged In Option & Forgot Password */}
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

                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMsg(null);
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 font-medium text-center">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
          </>
        ) : (
          /* 2. FORGOT PASSWORD / WHATSAPP OTP RESET MODE */
          <>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Reset Password</h2>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  WhatsApp OTP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {otpSent
                  ? 'Enter the 6-digit verification code sent to your linked phone.'
                  : 'Receive a temporary one-time password code on your linked WhatsApp account.'}
              </p>
            </div>

            {/* OTP Status Box */}
            {otpStatusLoading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Checking linked WhatsApp companion status...</span>
              </div>
            ) : !otpStatus?.connected ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-left space-y-2.5">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>WhatsApp Not Connected</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  WhatsApp is not connected to receive an OTP verification code.
                </p>
                <div className="p-2.5 rounded-xl bg-dark-900/80 border border-amber-500/30 text-[11px] text-amber-300 font-medium">
                  🔑 If you forgot your password, please ask the developer for the password.
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-left">
                {/* Linked Phone Banner */}
                <div className="p-3 rounded-xl bg-slate-900 border border-dark-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-slate-400 text-[11px]">Linked Number:</span>
                  </div>
                  <span className="font-mono font-bold text-white text-xs">
                    {otpStatus.phone || 'Active WhatsApp'}
                  </span>
                </div>

                {!otpSent ? (
                  /* STEP 1: REQUEST OTP */
                  <div className="space-y-3 pt-1">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading || cooldown > 0}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4" />
                          <span>{cooldown > 0 ? `Wait ${cooldown}s to Resend` : 'Send Code to WhatsApp'}</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* STEP 2: VERIFY OTP & CHOOSE NEW PASSWORD */
                  <form onSubmit={handleVerifyOtpSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="• • • • • •"
                        required
                        autoFocus
                        className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-2 text-center text-base tracking-[0.35em] font-mono font-bold text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        required
                        className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={loading || cooldown > 0}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 6}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Reset Password & Unlock</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {resetSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 font-medium text-center">
                {resetSuccessMsg}
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 font-medium text-center">
                {errorMsg}
              </div>
            )}

            {/* Back to Login Link */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setResetSuccessMsg(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </>
        )}

        <p className="text-[11px] text-slate-500">End-to-End Encrypted Gateway • Bijoytel Network</p>
      </div>
    </div>
  );
};
