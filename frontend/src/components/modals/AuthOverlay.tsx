import React, { useState, useEffect, useRef } from 'react';
import {
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
  Lock,
  Sun,
  Moon
} from 'lucide-react';
import {
  loginWithPassword,
  fetchOtpStatus,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  type OtpStatusResponse
} from '../../api/client';
import { useUI } from '../../context/UIContext';
import { TelciaLogo } from '../common/TelciaLogo';

interface AuthOverlayProps {
  onSuccess: () => void;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({ onSuccess }) => {
  const { isDarkMode, toggleTheme } = useUI();

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
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-300 select-none overflow-y-auto ${
        isDarkMode
          ? 'bg-[#070b16]'
          : 'bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/50'
      }`}
      style={{
        backgroundImage: isDarkMode
          ? `radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 60%),
             radial-gradient(circle at 100% 100%, rgba(244, 42, 65, 0.1) 0%, transparent 60%),
             linear-gradient(to bottom, #070b16 0%, #03060f 100%)`
          : `radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
             radial-gradient(circle at 100% 100%, rgba(244, 42, 65, 0.05) 0%, transparent 50%),
             linear-gradient(to bottom, #f1f5f9 0%, #e2e8f0 100%)`
      }}
    >
      {/* Background Matrix Grid Pattern */}
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDarkMode ? 'opacity-[0.04]' : 'opacity-[0.03]'
        }`}
        style={{
          backgroundImage: `
            linear-gradient(to right, ${isDarkMode ? '#38bdf8' : '#0f172a'} 1px, transparent 1px),
            linear-gradient(to bottom, ${isDarkMode ? '#38bdf8' : '#0f172a'} 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px'
        }}
      />

      {/* Top Telemetry & Controls Bar */}
      <div className="absolute top-4 sm:top-6 inset-x-0 px-6 sm:px-10 flex items-center justify-between text-xs font-mono z-10">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
          <span
            className={`font-bold tracking-wider text-xs ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            TELCIA GATEWAY
          </span>
          <span className={`${isDarkMode ? 'text-slate-600' : 'text-slate-400'} hidden sm:inline`}>•</span>
          <span
            className={`text-xs font-semibold hidden sm:inline ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            SOVEREIGN NODE ACTIVE
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Light / Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm transition-all duration-200 ${
              isDarkMode
                ? 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-100 hover:text-white'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 hover:text-slate-900'
            }`}
            title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} theme`}
          >
            {isDarkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Dark Mode</span>
              </>
            )}
          </button>

          {/* Encryption Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-xs ${
              isDarkMode
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-emerald-100/90 border-emerald-300 text-emerald-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>TLS 1.3 / E2EE</span>
          </span>
        </div>
      </div>

      {/* Main Smart Card Container */}
      <div
        className={`relative max-w-[450px] w-full rounded-3xl p-7 sm:p-9 border shadow-2xl transition-all duration-200 text-center space-y-6 my-auto ${
          isDarkMode
            ? 'bg-slate-900/95 border-slate-800/90 text-slate-100 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl'
            : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-md'
        } ${isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
        style={{
          boxShadow: isDarkMode
            ? '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.08)'
            : '0 20px 50px rgba(15, 23, 42, 0.1), 0 0 30px rgba(16, 185, 129, 0.05)'
        }}
      >
        {/* Top Card Gradient Accent Line */}
        <div className="absolute -top-px left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-80" />

        {/* Brand Icon (Bangladesh Sovereign Telecom Motif) */}
        <TelciaLogo size="xl" className="mx-auto" />

        {/* 1. STANDARD LOGIN MODE */}
        {mode === 'login' ? (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <h2
                  className={`text-2xl sm:text-3xl font-black tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Telcia
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${
                    isDarkMode
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  AI TERMINAL
                </span>
              </div>
              <p
                className={`text-xs sm:text-sm font-semibold ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                Telecom Cognitive Intelligence & Trading Desk
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-password"
                    className={`text-xs sm:text-sm font-bold flex items-center gap-1.5 ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    <KeyRound className="w-4 h-4 text-emerald-500" />
                    <span>Terminal Access Password</span>
                  </label>
                  {capsLockActive && (
                    <span className="text-[10px] font-extrabold text-amber-500 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/35 animate-pulse">
                      CAPS LOCK ON
                    </span>
                  )}
                </div>

                <div className="relative group">
                  <div
                    className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                      isDarkMode ? 'text-slate-400 group-focus-within:text-emerald-400' : 'text-slate-500 group-focus-within:text-emerald-600'
                    }`}
                  >
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
                    className={`w-full rounded-xl pl-10 pr-11 py-3 text-sm sm:text-base font-mono transition-all border outline-none focus:ring-2 ${
                      isDarkMode
                        ? 'bg-slate-950/90 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500/25'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:ring-emerald-500/20 shadow-xs'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className={`absolute inset-y-0 right-0 pr-3.5 flex items-center transition-colors cursor-pointer ${
                      isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Stay Logged In & Forgot Password */}
              <div className="flex items-center justify-between text-xs sm:text-sm pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500/20 accent-emerald-600 cursor-pointer"
                  />
                  <span
                    className={`font-semibold text-xs transition-colors ${
                      isDarkMode ? 'text-slate-300 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'
                    }`}
                  >
                    Stay logged in
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMsg(null);
                  }}
                  className={`text-xs font-bold underline transition-colors cursor-pointer ${
                    isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-700 hover:text-emerald-800'
                  }`}
                >
                  Forgot password?
                </button>
              </div>

              {errorMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
                    isDarkMode
                      ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                      : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
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
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-black/25 text-[10px] font-mono text-emerald-100">
                      ↵ Enter
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
                <h2
                  className={`text-xl sm:text-2xl font-black tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Reset Password
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${
                    isDarkMode
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                >
                  WhatsApp OTP
                </span>
              </div>
              <p
                className={`text-xs sm:text-sm font-semibold leading-relaxed ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                {otpSent
                  ? 'Enter the 6-digit security code dispatched to your linked WhatsApp companion.'
                  : 'Dispatch a secure one-time password code directly to your WhatsApp companion.'}
              </p>
            </div>

            {/* OTP Status Box */}
            {otpStatusLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs font-semibold">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                  Checking linked WhatsApp companion status...
                </span>
              </div>
            ) : !otpStatus?.connected ? (
              <div
                className={`p-4 rounded-2xl border text-left space-y-2.5 ${
                  isDarkMode
                    ? 'bg-amber-500/15 border-amber-500/35 text-slate-200'
                    : 'bg-amber-50 border-amber-300 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs sm:text-sm font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>WhatsApp Companion Offline</span>
                </div>
                <p className="text-xs font-semibold leading-relaxed">
                  WhatsApp is not currently connected to receive an OTP verification code.
                </p>
                <div
                  className={`p-2.5 rounded-xl border text-xs font-bold ${
                    isDarkMode
                      ? 'bg-slate-950/80 border-amber-500/30 text-amber-300'
                      : 'bg-white border-amber-300 text-amber-800'
                  }`}
                >
                  🔑 Please contact system administrator for manual credential recovery.
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-left">
                {/* Linked Phone Banner */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm ${
                    isDarkMode
                      ? 'bg-slate-950/90 border-slate-800'
                      : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span
                      className={`font-semibold ${
                        isDarkMode ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      Linked Companion:
                    </span>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
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
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4" />
                          <span>
                            {cooldown > 0 ? `Wait ${cooldown}s to Resend` : 'Dispatch Code to WhatsApp'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* STEP 2: VERIFY OTP & CHOOSE NEW PASSWORD */
                  <form onSubmit={handleVerifyOtpSubmit} className="space-y-3.5">
                    <div>
                      <label
                        className={`block text-xs sm:text-sm font-bold mb-1 ${
                          isDarkMode ? 'text-slate-200' : 'text-slate-800'
                        }`}
                      >
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
                        className={`w-full rounded-xl px-4 py-2.5 text-center text-lg tracking-[0.4em] font-mono font-bold transition-all border outline-none focus:ring-2 ${
                          isDarkMode
                            ? 'bg-slate-950/90 border-slate-700 text-emerald-400 placeholder-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20'
                            : 'bg-white border-slate-300 text-emerald-700 placeholder-slate-400 focus:border-emerald-600 focus:ring-emerald-500/20'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          className={`text-xs sm:text-sm font-bold ${
                            isDarkMode ? 'text-slate-200' : 'text-slate-800'
                          }`}
                        >
                          New Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className={`text-xs font-semibold ${
                            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
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
                        className={`w-full rounded-xl px-3 py-2 text-sm border outline-none transition-colors ${
                          isDarkMode
                            ? 'bg-slate-950/90 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                            : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
                        }`}
                      />
                    </div>

                    <div>
                      <label
                        className={`block text-xs sm:text-sm font-bold mb-1 ${
                          isDarkMode ? 'text-slate-200' : 'text-slate-800'
                        }`}
                      >
                        Confirm New Password
                      </label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        required
                        className={`w-full rounded-xl px-3 py-2 text-sm border outline-none transition-colors ${
                          isDarkMode
                            ? 'bg-slate-950/90 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                            : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={loading || cooldown > 0}
                        className={`text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                          isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 6}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
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
              <div
                className={`p-3 rounded-xl border text-xs sm:text-sm font-semibold text-center ${
                  isDarkMode
                    ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                }`}
              >
                {resetSuccessMsg}
              </div>
            )}

            {errorMsg && (
              <div
                className={`p-3 rounded-xl border text-xs sm:text-sm font-semibold text-center ${
                  isDarkMode
                    ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
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
                className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </>
        )}

        {/* Footer Security Watermark */}
        <div
          className={`pt-3 border-t flex items-center justify-center gap-2 text-xs font-semibold ${
            isDarkMode
              ? 'border-slate-800/80 text-slate-400'
              : 'border-slate-200 text-slate-600'
          }`}
        >
          <ShieldCheck
            className={`w-4 h-4 shrink-0 ${
              isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
            }`}
          />
          <span>Encrypted Gateway • Sovereign Bijoytel Network</span>
        </div>
      </div>
    </div>
  );
};
