import React, { useState, useEffect } from 'react';
import {
  Bot,
  X,
  Eye,
  EyeOff,
  FlaskConical,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info
} from 'lucide-react';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [provider, setProvider] = useState<'deepseek' | 'openai' | 'grok' | 'local'>('deepseek');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [grokKey, setGrokKey] = useState('');

  const [showDeepseek, setShowDeepseek] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGrok, setShowGrok] = useState(false);

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ status: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/ai/settings')
        .then((res) => res.json())
        .then((data) => {
          if (data.provider) setProvider(data.provider);
          if (data.deepseekKey) setDeepseekKey(data.deepseekKey);
          if (data.openaiKey) setOpenaiKey(data.openaiKey);
          if (data.grokKey) setGrokKey(data.grokKey);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const activeKey = provider === 'deepseek' ? deepseekKey : provider === 'openai' ? openaiKey : grokKey;
      const token = localStorage.getItem('wapp_token');
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          provider,
          apiKey: activeKey,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.status === 'ok' || data.success === true)) {
        setFeedback({ status: 'ok', message: data.message || `${provider.toUpperCase()} connection successful!` });
      } else {
        setFeedback({ status: 'error', message: data.error || data.message || 'Connection failed. Check API key.' });
      }
    } catch {
      setFeedback({ status: 'error', message: 'Network error communicating with AI endpoint.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem('wapp_token');
      const res = await fetch('/api/ai/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          provider,
          deepseekKey,
          openaiKey,
          grokKey,
        }),
      });
      if (res.ok) {
        setFeedback({ status: 'ok', message: 'AI configuration saved successfully!' });
        setTimeout(() => onClose(), 1200);
      } else {
        setFeedback({ status: 'error', message: 'Failed to save settings.' });
      }
    } catch {
      setFeedback({ status: 'error', message: 'Network error saving settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-modal win-window max-w-lg w-full rounded-2xl border border-slate-200 dark:border-dark-700 shadow-2xl space-y-4 p-5 relative bg-white dark:bg-dark-950/95 transition-colors"
      >
        {/* Title bar */}
        <div className="win-titlebar flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-700 select-none">
          <div className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">AI Intelligence & Parser Settings</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Configure LLM keys for automated voice route extraction</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 win-controls">
            <div className="relative group/info">
              <button
                type="button"
                className="win-btn p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
                title="AI Settings info"
              >
                <Info className="w-3.5 h-3.5 pointer-events-none" />
              </button>
              <div className="absolute top-full right-0 mt-1.5 hidden group-hover/info:block z-50 pointer-events-none w-64 max-w-[calc(100vw-4rem)]">
                <div className="px-3 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 text-white text-[11px] font-medium whitespace-normal break-words leading-relaxed text-left shadow-2xl border border-slate-700">
                  AI Intelligence & Parser • Configure DeepSeek or Local Regex engines for automated telecom extraction
                </div>
              </div>
            </div>
            <button
              type="button"
              className="win-btn win-btn-close p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 cursor-pointer"
              title="Close dialog"
              onClick={onClose}
            >
              <X className="w-3.5 h-3.5 pointer-events-none" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Active Provider Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Active AI Intelligence Engine:</label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                  provider === 'deepseek'
                    ? 'border-purple-500/60 bg-purple-500/10'
                    : 'border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="deepseek"
                  checked={provider === 'deepseek'}
                  onChange={() => setProvider('deepseek')}
                  className="accent-purple-500"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">DeepSeek</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400">deepseek-chat (Ultra fast)</span>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                  provider === 'openai'
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="openai"
                  checked={provider === 'openai'}
                  onChange={() => setProvider('openai')}
                  className="accent-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">ChatGPT (OpenAI)</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">gpt-4o-mini</span>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                  provider === 'grok'
                    ? 'border-sky-500/60 bg-sky-500/10'
                    : 'border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="grok"
                  checked={provider === 'grok'}
                  onChange={() => setProvider('grok')}
                  className="accent-sky-500"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">xAI Grok</span>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400">grok-beta</span>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                  provider === 'local'
                    ? 'border-slate-400/60 bg-slate-500/10'
                    : 'border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="local"
                  checked={provider === 'local'}
                  onChange={() => setProvider('local')}
                  className="accent-slate-400"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">Local Regex</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">100% Offline (Free)</span>
                </div>
              </label>
            </div>
          </div>

          {/* DeepSeek API Key */}
          {provider === 'deepseek' && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">DeepSeek API Key</label>
              <div className="relative">
                <input
                  type={showDeepseek ? 'text' : 'password'}
                  value={deepseekKey}
                  onChange={(e) => setDeepseekKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono pr-9 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowDeepseek(!showDeepseek)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  {showDeepseek ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* OpenAI API Key */}
          {provider === 'openai' && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">OpenAI API Key</label>
              <div className="relative">
                <input
                  type={showOpenai ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono pr-9 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenai(!showOpenai)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Grok API Key */}
          {provider === 'grok' && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">xAI Grok API Key</label>
              <div className="relative">
                <input
                  type={showGrok ? 'text' : 'password'}
                  value={grokKey}
                  onChange={(e) => setGrokKey(e.target.value)}
                  placeholder="xai-..."
                  className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono pr-9 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowGrok(!showGrok)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  {showGrok ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {feedback && (
            <div
              className={`p-3 rounded-xl border text-[11px] flex items-center gap-2 ${
                feedback.status === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
              }`}
            >
              {feedback.status === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-dark-800">
            {/* Test Connection Entity */}
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || provider === 'local'}
              className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              title="Verify LLM API credentials"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin text-purple-500 pointer-events-none" /> : <FlaskConical className="w-4 h-4 text-purple-500 pointer-events-none" />}
              <span>Test</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-dark-700 text-xs font-semibold flex items-center transition-all cursor-pointer"
                title="Discard changes"
              >
                <span>Cancel</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all"
                title="Save AI settings"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin pointer-events-none" />}
                <span>Save</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
