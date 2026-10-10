import React, { useState, useEffect } from 'react';
import { Sparkles, MessageCircle, TrendingUp, Bot, Key, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useUI } from '../../../context/UIContext';
import { ToggleSwitch } from './ToggleSwitch';
import { fetchAiSettings, saveAiSettings, testAiConnection } from '../../../api/client';

export const AiTradingFeaturesCard: React.FC = () => {
  const {
    showPitchGenerator,
    setShowPitchGenerator,
    enableWhatsAppKnock,
    setEnableWhatsAppKnock,
    showArbitrageSignals,
    setShowArbitrageSignals,
  } = useUI();

  // AI Backend Config State
  const [provider, setProvider] = useState<'deepseek' | 'openai' | 'grok' | 'local'>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [hasConfiguredKey, setHasConfiguredKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchAiSettings()
      .then((cfg) => {
        if (cfg.provider) setProvider(cfg.provider as any);
        const activeKey =
          cfg.provider === 'openai'
            ? cfg.openaiKey
            : cfg.provider === 'grok'
            ? cfg.grokKey
            : cfg.deepseekKey;
        if (activeKey) setApiKey(activeKey);
        setHasConfiguredKey(Boolean(cfg.hasConfiguredKey));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const payload: any = { provider };
      if (provider === 'deepseek') payload.deepseekKey = apiKey.trim();
      else if (provider === 'openai') payload.openaiKey = apiKey.trim();
      else if (provider === 'grok') payload.grokKey = apiKey.trim();

      const res = await saveAiSettings(payload);
      if (res.success) {
        setHasConfiguredKey(Boolean(apiKey.trim() || provider === 'local'));
        setFeedback({ type: 'success', text: 'AI configuration saved successfully!' });
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to save configuration' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setFeedback(null);
    try {
      const res = await testAiConnection(provider);
      if (res.success) {
        setFeedback({ type: 'success', text: `Connection successful: ${res.message || 'AI engine responding!'}` });
      } else {
        setFeedback({ type: 'error', text: res.error || 'Connection failed. Please verify API key.' });
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900/60 shadow-md dark:shadow-xl space-y-4 flex flex-col justify-between">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                AI & Trading Pitch Controls
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Cognitive trade pitch synthesis, WhatsApp knocks & model keys
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            {isLoading ? 'Checking...' : hasConfiguredKey ? 'AI Ready' : 'Local Rules'}
          </span>
        </div>

        {/* 1. Feature Toggles */}
        <div className="space-y-2.5">
          {/* Toggle: AI Trade Pitch Generator */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
            <div className="flex items-center gap-2.5 pr-2">
              <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white text-xs block">
                  AI Trade Pitch Generator
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                  Display 1-Click AI negotiation pitches in Insights, Route Modals & Carrier Dossiers
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[10px] font-bold ${
                  showPitchGenerator ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'
                }`}
              >
                {showPitchGenerator ? 'ON' : 'OFF'}
              </span>
              <ToggleSwitch
                checked={showPitchGenerator}
                onChange={() => setShowPitchGenerator(!showPitchGenerator)}
                size="md"
              />
            </div>
          </div>

          {/* Toggle: 1-Click WhatsApp Knocking */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
            <div className="flex items-center gap-2.5 pr-2">
              <MessageCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white text-xs block">
                  1-Click WhatsApp Knocking
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                  Show direct WhatsApp outreach and prefilled trade deal action buttons
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[10px] font-bold ${
                  enableWhatsAppKnock ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}
              >
                {enableWhatsAppKnock ? 'ON' : 'OFF'}
              </span>
              <ToggleSwitch
                checked={enableWhatsAppKnock}
                onChange={() => setEnableWhatsAppKnock(!enableWhatsAppKnock)}
                size="md"
              />
            </div>
          </div>

          {/* Toggle: Bilateral Spread & Arbitrage */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800">
            <div className="flex items-center gap-2.5 pr-2">
              <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white text-xs block">
                  Market Spreads & Arbitrage Signals
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                  Calculate real-time price margins between buy and sell corridors
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[10px] font-bold ${
                  showArbitrageSignals ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                }`}
              >
                {showArbitrageSignals ? 'ON' : 'OFF'}
              </span>
              <ToggleSwitch
                checked={showArbitrageSignals}
                onChange={() => setShowArbitrageSignals(!showArbitrageSignals)}
                size="md"
              />
            </div>
          </div>
        </div>

        {/* 2. AI Model & Key Configuration */}
        <form onSubmit={handleSaveAi} className="pt-2 border-t border-slate-200 dark:border-dark-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-500" />
              <span>Cognitive Model Engine</span>
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
              className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-dark-950 border border-slate-300 dark:border-dark-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="deepseek">DeepSeek (Recommended)</option>
              <option value="openai">OpenAI (GPT-4o-mini)</option>
              <option value="grok">Grok (xAI Beta)</option>
              <option value="local">Local Ollama (Offline)</option>
            </select>
          </div>

          {provider !== 'local' && (
            <div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter ${provider.toUpperCase()} API Key (sk-...)`}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          )}

          {feedback && (
            <div
              className={`p-2 rounded-xl text-[11px] font-medium flex items-center gap-1.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              <span>Save AI Model</span>
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || (!apiKey && provider !== 'local')}
              className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-dark-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span>Test API</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
