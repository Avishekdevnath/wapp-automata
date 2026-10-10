import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  KeyRound,
  ArrowRight,
  Loader2,
  Smartphone,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock
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
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Forgot Password / OTP State
  const [otpStatus, setOtpStatus] = useState<OtpStatusResponse | null>(null);
  const [otpStatusLoading, setOtpStatusLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus password on mount
  useEffect(() => {
    if (mode === 'login' && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [mode]);

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

  // Caps lock detection
  const handleKeyModifier = (e: React.KeyboardEvent) => {
    const isCaps = e.getModifierState && e.getModifierState('CapsLock');
    setCapsLockActive(Boolean(isCaps));
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

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
        triggerShake();
        setErrorMsg('Invalid terminal password. Access denied.');
      }
    } catch {
      triggerShake();
      setErrorMsg('Gateway connection error. Please verify server connectivity.');
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
        setResetSuccessMsg('6-digit security code dispatched to linked WhatsApp companion!');
      } else {
        setErrorMsg(res.error || 'Failed to dispatch OTP to WhatsApp companion.');
      }
    } catch {
      setErrorMsg('Gateway network error while dispatching code.');
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
        setResetSuccessMsg('Credentials updated successfully! Initializing terminal...');
        if (remember) {
          localStorage.setItem('wapp_authenticated', 'true');
        } else {
          sessionStorage.setItem('wapp_authenticated', 'true');
        }
        setTimeout(() => {
          onSuccess();
        }, 900);
      } else {
        setErrorMsg(res.error || 'Invalid or expired OTP code.');
      }
    } catch {
      setErrorMsg('Network error while verifying OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060a14] overflow-hidden select-none"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.12) 0%, transparent 60%),
          radial-gradient(circle at 100% 100%, rgba(244, 42, 65, 0.08) 0%, transparent 60%),
          linear-gradient(to bottom, #060a14 0%, #030712 100%)
        `
      }}
    >
      {/* Background Matrix Grid Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #38bdf8 1px, transparent 1px),
            linear-gradient(to bottom, #38bdf8 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px'
        }}
      />

      {/* Top Telemetry Header */}
      <div className="absolute top-4 sm:top-6 inset-x-0 px-6 flex items-center justify-between text-[11px] text-slate-400 font-mono pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="font-semibold text-slate-300 tracking-wide">TELCIA GATEWAY</span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-500 hidden sm:inline">SOVEREIGN NODE ACTIVE</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
            <Lock className="w-3 h-3 text-emerald-400" />
            TLS 1.3 / E2EE
          </span>
        </div>
      </div>

      {/* Main Smart Card */}
      <div
        className={`relative max-w-[440px] w-full rounded-3xl bg-slate-900/90 border border-slate-800/90 p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl space-y-6 text-center transition-transform duration-200 ${
          isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
        }`}
        style={{
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 40px rgba(16, 185, 129, 0.08)'
        }}
      >
        {/* Subtle top card glow line */}
        <div className="absolute -top-px left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-75" />

        {/* Brand Icon (Bangladesh Sovereign Telecom Motif) */}
        <div className="relative mx-auto w-16 h-16 group">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#006a4e] via-emerald-500 to-teal-400 blur-md opacity-40 group-hover:opacity-75 transition-opacity duration-500" />
          <div className="relative w-full h-full rounded-2xl bg-gradient-to-tr from-[#006a4e] via-emerald-600 to-[#004d38] p-[1.5px] shadow-xl">
            <div className="w-full h-full bg-[#070d18] rounded-[14px] flex items-center justify-center relative overflow-hidden">
              {/* Sovereign Bangladesh Red Core Glow */}
              <span className="absolute w-7 h-7 rounded-full bg-[#f42a41] opacity-90 shadow-[0_0_14px_rgba(244,42,65,0.85)] animate-pulse" />
              <Radio className="w-7 h-7 text-white relative z-10 drop-shadow-md" />
            </div>
          </div>
        </div>

        {/* 1. STANDARD LOGIN MODE */}
        {mode === 'login' ? (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-black text-white tracking-tight font-sans">
                  Telcia
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AI TERMINAL
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Telecom Cognitive Intelligence & Trading Desk
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-password"
                    className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Terminal Access Password</span>
                  </label>
                  {capsLockActive && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 animate-pulse">
                      CAPS LOCK ON
                    </span>
                  )}
                </div>

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    id="auth-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyModifier}
                    onKeyUp={handleKeyModifier}
                    placeholder="Enter terminal password"
                    required
                    autoFocus
                    autoComplete="current-password"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Keep Logged In Option & Forgot Password */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20 accent-emerald-500 cursor-pointer"
                  />
                  <span className="text-slate-300 group-hover:text-white font-medium text-xs transition-colors">
                    Stay logged in
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Forgot password?</span>
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-medium flex items-center gap-2 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating Gateway...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Terminal</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono text-emerald-200">
                      ↵
                    </span>
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          /* 2. FORGOT PASSWORD / WHATSAPP OTP RESET MODE */
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Reset Password</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  WhatsApp OTP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {otpSent
                  ? 'Enter the 6-digit verification code sent to your linked WhatsApp companion.'
                  : 'Dispatch a secure one-time password code directly to your WhatsApp companion.'}
              </p>
            </div>

            {/* OTP Status Box */}
            {otpStatusLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Checking linked WhatsApp companion status...</span>
              </div>
            ) : !otpStatus?.connected ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-left space-y-2.5">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>WhatsApp Companion Offline</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  WhatsApp is not currently connected to receive an OTP verification code.
                </p>
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/30 text-[11px] text-amber-300 font-medium">
                  🔑 Please contact system administrator for manual credential recovery.
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-left">
                {/* Linked Phone Banner */}
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-slate-400 text-[11px]">Linked Companion:</span>
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
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4" />
                          <span>{cooldown > 0 ? `Wait ${cooldown}s to Resend` : 'Dispatch Code to WhatsApp'}</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* STEP 2: VERIFY OTP & CHOOSE NEW PASSWORD */
                  <form onSubmit={handleVerifyOtpSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        6-Digit Security Code
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="• • • • • •"
                        required
                        autoFocus
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-lg tracking-[0.4em] font-mono font-bold text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">New Password</label>
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          {showNewPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        required
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
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
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
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
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-medium text-center">
                {resetSuccessMsg}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-medium text-center">
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

        {/* Footer Security Watermark */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[10px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/60" />
          <span>Encrypted Gateway • Sovereign Bijoytel Network</span>
        </div>
      </div>
    </div>
  );
};
