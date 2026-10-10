import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  HelpCircle,
  Search,
  Sparkles,
  Smartphone,
  Layers,
  ShieldCheck,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Bot,
  Loader2,
  RefreshCw,
  ExternalLink,
  X
} from 'lucide-react';
import {
  fetchHelpArticles,
  askHelpConcierge,
  fetchAiSettings,
  type HelpArticleItem
} from '../../api/client';
import { WhatsAppMarkdown } from '../common/WhatsAppMarkdown';

export interface HelpViewProps {
  onOpenDeviceModal: () => void;
  onOpenAiSettingsModal: () => void;
  onSwitchView: (view: any) => void;
}

export const HelpView: React.FC<HelpViewProps> = ({
  onOpenDeviceModal,
  onOpenAiSettingsModal,
  onSwitchView,
}) => {
  const [articles, setArticles] = useState<HelpArticleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI RAG state
  const [aiSettings, setAiSettings] = useState<{ provider: string; hasConfiguredKey: boolean }>({
    provider: 'deepseek',
    hasConfiguredKey: false,
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [aiResponse, setAiResponse] = useState<{
    answer: string;
    provider?: string;
    mode: 'ai' | 'local';
    matchedArticleIds?: string[];
    fallbackReason?: string;
  } | null>(null);

  // Load database-stored articles and AI configuration
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedArticles, fetchedAi] = await Promise.all([
        fetchHelpArticles(selectedCategory, searchQuery),
        fetchAiSettings(),
      ]);
      setArticles(fetchedArticles);
      setAiSettings({
        provider: fetchedAi.provider,
        hasConfiguredKey: fetchedAi.hasConfiguredKey,
      });
    } catch (err) {
      console.error('Failed to load help data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side instant filter fallback for sub-millisecond typing
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles;
    const q = searchQuery.toLowerCase().trim();
    return articles.filter(
      (a) =>
        a.question.toLowerCase().includes(q) ||
        a.shortAnswer.toLowerCase().includes(q) ||
        a.detailedSteps.some((s) => s.toLowerCase().includes(q)) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [articles, searchQuery]);

  // Handle AI Concierge Question
  const handleAskAi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = (aiPrompt.trim() || searchQuery.trim());
    if (!query) return;

    setIsAskingAi(true);
    setAiResponse(null);

    try {
      const res = await askHelpConcierge(query);
      if (res.mode === 'ai' && res.answer) {
        setAiResponse({
          mode: 'ai',
          answer: res.answer,
          provider: res.provider,
          matchedArticleIds: res.matchedArticleIds,
        });
      } else {
        setAiResponse({
          mode: 'local',
          answer: res.message || 'No AI key configured. Found relevant knowledge base articles below.',
          matchedArticleIds: res.matchedArticleIds,
          fallbackReason: res.fallbackReason,
        });
      }
    } catch (err: any) {
      setAiResponse({
        mode: 'local',
        answer: 'Search completed from local database.',
        fallbackReason: err?.message,
      });
    } finally {
      setIsAskingAi(false);
    }
  };

  const handleAction = (action?: string) => {
    if (!action) return;
    if (action === 'device-modal') onOpenDeviceModal();
    else if (action === 'ai-settings') onOpenAiSettingsModal();
    else if (action === 'settings') onSwitchView('settings');
    else if (action === 'stream') onSwitchView('terminal');
    else if (action === 'routes') onSwitchView('routes');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. HERO HEADER */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl relative overflow-hidden transition-colors">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <HelpCircle className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  TELCIA Knowledge Base & Concierge
                </h1>
                <p className="text-[11px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                  Telecom Cognitive Intelligent Agent
                </p>
              </div>
            </div>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Step-by-step business guides, operational wait times, multi-desk setup, and instant troubleshooting for your wholesale voice trading intelligence desk.
            </p>
          </div>

          {/* AI Mode Status Pill */}
          <div className="shrink-0 flex items-center gap-2">
            {aiSettings.hasConfiguredKey ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/25 text-purple-700 dark:text-purple-300 text-xs font-semibold shadow-xs">
                <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400 animate-pulse" />
                <span>AI RAG Active ({aiSettings.provider.toUpperCase()})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Standard Database Search</span>
                <button
                  type="button"
                  onClick={onOpenAiSettingsModal}
                  className="ml-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-white underline cursor-pointer"
                >
                  Enable AI
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search & Natural Language Query Box */}
        <form onSubmit={handleAskAi} className="mt-6 relative z-10">
          <div className="relative flex items-center rounded-xl bg-white dark:bg-slate-950/90 border border-slate-300 dark:border-slate-700/80 shadow-xs dark:shadow-inner focus-within:border-emerald-500 dark:focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
            <Search className="w-4 h-4 text-slate-400 ml-3.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setAiPrompt(e.target.value);
              }}
              placeholder="Search guides, wait times, or ask a question (e.g., 'How long does pairing take?')..."
              className="w-full bg-transparent px-3 py-3 text-xs md:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setAiPrompt('');
                  setAiResponse(null);
                }}
                className="p-1 mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={isAskingAi || (!searchQuery.trim() && !aiPrompt.trim())}
              className="mr-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {isAskingAi ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask Concierge</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 2. AI CONCIERGE RESPONSE CARD (IF ACTIVE) */}
      {aiResponse && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-500/30 shadow-md dark:shadow-2xl relative space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
              <Bot className="w-4 h-4" />
              <span>
                {aiResponse.mode === 'ai'
                  ? `AI Concierge Synthesized Answer (${aiResponse.provider?.toUpperCase()})`
                  : 'Grounded Knowledge Retrieval'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAiResponse(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>

          <div className="text-slate-800 dark:text-slate-200 text-xs md:text-sm leading-relaxed">
            <WhatsAppMarkdown content={aiResponse.answer} />
          </div>

          {aiResponse.fallbackReason && (
            <div className="text-[11px] text-amber-800 dark:text-amber-300 font-mono bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-lg border border-amber-200 dark:border-amber-500/20">
              Note: {aiResponse.fallbackReason}
            </div>
          )}
        </div>
      )}

      {/* 3. QUICK ACTION HIGHLIGHT CARDS (3 PILLARS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pillar 1: WhatsApp Pairing */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-md dark:hover:shadow-emerald-900/10 transition-all shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-mono">
              ⏳ 3 – 5 Min Sync
            </span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">WhatsApp Pairing</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Keep phone awake on Wi-Fi for 3–5 minutes while encryption keys and trading groups buffer.
          </p>
          <button
            type="button"
            onClick={onOpenDeviceModal}
            className="pt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
          >
            <span>Open Pairing Modal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pillar 2: Multi-Desk Workspaces */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:shadow-md dark:hover:shadow-purple-900/10 transition-all shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-mono">
              100% Isolated
            </span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Multi-Desk Separation</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Run Voice, SMS, and Sales desks in independent SQLite databases with zero cross-talk.
          </p>
          <button
            type="button"
            onClick={() => onSwitchView('settings')}
            className="pt-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 cursor-pointer"
          >
            <span>Manage Desks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pillar 3: Security & OTP */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:shadow-md dark:hover:shadow-sky-900/10 transition-all shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 font-mono">
              ⚡ 5–15s Delivery
            </span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Password WhatsApp OTP</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Forgot password? Receive an encrypted 6-digit recovery PIN directly on your linked phone.
          </p>
          <button
            type="button"
            onClick={() => onSwitchView('settings')}
            className="pt-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 cursor-pointer"
          >
            <span>Security Controls</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. CATEGORY PILL FILTER */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'All Topics' },
          { id: 'pairing', label: 'WhatsApp Pairing' },
          { id: 'stream', label: 'Live Stream' },
          { id: 'desks', label: 'Multi-Desk' },
          { id: 'security', label: 'Login & Security' },
          { id: 'wholesale', label: 'Rates & Routes' },
          { id: 'troubleshooting', label: 'Troubleshooting' },
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-emerald-600 text-white font-semibold shadow-sm shadow-emerald-600/30'
                : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white shadow-xs'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 5. DATABASE ARTICLES ACCORDION LIST */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
          <span>Showing {filteredArticles.length} Database Knowledge Articles</span>
          <button
            type="button"
            onClick={loadData}
            className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync DB</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="text-xs font-mono">Loading Knowledge Base from SQLite...</span>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2 shadow-xs">
            <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-white">No Matching Articles Found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Try a different keyword or ask the AI Concierge above for personalized assistance.
            </p>
          </div>
        ) : (
          filteredArticles.map((article) => {
            const isExpanded = expandedId === article.id;
            return (
              <div
                key={article.id}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isExpanded
                    ? 'bg-white dark:bg-slate-900 border-emerald-500/50 shadow-md dark:shadow-xl'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                }`}
              >
                {/* Accordion Question Header */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : article.id)}
                  className="w-full p-4 flex items-start justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/50 text-[10px] font-semibold uppercase tracking-wider">
                        {article.categoryLabel}
                      </span>
                      {article.waitTime && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{article.waitTime}</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {article.question}
                    </h3>
                    {!isExpanded && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 pt-0.5">
                        {article.shortAnswer}
                      </p>
                    )}
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 shrink-0 mt-0.5">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded Answer & Step-by-Step Procedure */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-4 text-xs">
                    {/* Short Answer Callout */}
                    <div className="p-3 rounded-lg bg-emerald-50/80 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                      {article.shortAnswer}
                    </div>

                    {/* Step-by-step checklist */}
                    {article.detailedSteps && article.detailedSteps.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Step-by-Step Action Guide
                        </span>
                        <ul className="space-y-2">
                          {article.detailedSteps.map((step, stepIdx) => (
                            <li key={stepIdx} className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                              <span className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {stepIdx + 1}
                              </span>
                              <span className="flex-1">{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Footer Tags & Direct Action Button */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <div className="flex flex-wrap gap-1">
                        {article.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-transparent font-mono"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {article.actionLink && (
                        <button
                          type="button"
                          onClick={() => handleAction(article.actionLink?.action)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ml-auto shadow-xs"
                        >
                          <span>{article.actionLink.label}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 6. SUPPORT ESCALATION FOOTER */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Need technical escalation? Contact Bijoytel Network NOC support</span>
        </div>
        <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
          TELCIA (Telecom Cognitive Intelligent Agent) v2.5 • SQLite Durable Engine
        </div>
      </div>
    </div>
  );
};
