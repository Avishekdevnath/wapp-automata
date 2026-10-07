import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Radio,
  ShieldAlert,
  MapPin,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Clock,
  Search,
  Filter,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Share2,
} from 'lucide-react';
import { fetchNews, type BackendNewsItem } from '../../api/client';
import { matchesNewsSlug, getNewsSlug } from '../../utils/slug';

export type SortMode = 'priority-recency' | 'newest-first' | 'high-priority' | 'oldest-first';
export type PageSizeOption = 6 | 12 | 24 | 'ALL';

interface NormalizedNewsItem {
  id: string;
  messageId: string;
  category: string;
  headline: string;
  affectedCountries: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  rawText: string;
  createdAt: number;
  timeAgo: string;
}

const FALLBACK_NEWS: BackendNewsItem[] = [
  {
    id: 'news_bm_0',
    message_id: 'bm_news_msg_0',
    category: 'OUTAGE',
    headline: 'Red Sea Subsea Cable Cut (SMW4/AAE-1) Severing Primary Europe-Asia Latency Corridor',
    affected_countries: 'Egypt, India, Bangladesh, UAE',
    urgency: 'HIGH',
    raw_text: 'CRITICAL ALERT: Physical subsea cable cut confirmed in Red Sea corridor near Jeddah. Latency increased by 140ms on South Asia voice trunks. Carriers rerouting via terrestrial and Cape of Good Hope routes with heavy transit congestion.',
    created_at: Date.now() - 720000,
  },
  {
    id: 'news_bm_1',
    message_id: 'bm_news_msg_1',
    category: 'REGULATION',
    headline: 'BTRC Bangladesh Mandates Real-Time A-Number Verification on Inbound International Gateways',
    affected_countries: 'Bangladesh, India',
    urgency: 'HIGH',
    raw_text: 'DIRECTIVE: BTRC order 2026-BTRC-04 requires Tier-1 ICX and IGW operators to drop non-standard ANI/CLI strings. Unregistered VoIP traffic terminating to BD Mobile 880 prefixes facing immediate 403 Forbidden response.',
    created_at: Date.now() - 2880000,
  },
  {
    id: 'news_bm_2',
    message_id: 'bm_news_msg_2',
    category: 'OUTAGE',
    headline: 'Backbone Terrestrial Fiber Cut Near Bogota Impacting Tier-1 Interconnects',
    affected_countries: 'Colombia, Panama, Ecuador',
    urgency: 'HIGH',
    raw_text: 'ALERT: Major terrestrial fiber cut reported on Bogota-Medellin mountain pass. Multiple carriers reporting 35% ASR drop on Colombia Mobile Claro/Tigo. Microwave failover active with reduced capacity.',
    created_at: Date.now() - 5400000,
  },
  {
    id: 'news_bm_3',
    message_id: 'bm_news_msg_3',
    category: 'FRAUD',
    headline: 'High-Volume False Answer Supervision (FAS) Burst Detected on Pakistan Mobile 923 Ranges',
    affected_countries: 'Pakistan, UAE, UK',
    urgency: 'HIGH',
    raw_text: 'FRAUD WARNING: Telecom security sensors detected unauthorized 12-second pre-answer audio loops on rogue Pakistan route offers. Immediate vendor quarantine advised for untrusted VoIP accounts.',
    created_at: Date.now() - 7920000,
  },
  {
    id: 'news_bm_4',
    message_id: 'bm_news_msg_4',
    category: 'REGULATION',
    headline: 'FCC STIR/SHAKEN Mandate: Robocall Mitigation Database Verification for US 800 Toll-Free Trunks',
    affected_countries: 'USA, Canada',
    urgency: 'HIGH',
    raw_text: 'REGULATORY: FCC Tier-1 enforcement deadline reached. Intermediate providers must block all incoming session initiation protocol calls lacking full Level-A cryptographic attestation tokens.',
    created_at: Date.now() - 12600000,
  },
  {
    id: 'news_bm_5',
    message_id: 'bm_news_msg_5',
    category: 'MAINTENANCE',
    headline: 'Tata Communications Scheduled Subsea Core Gateway Maintenance (02:00 - 04:00 GMT)',
    affected_countries: 'India, Singapore, UAE',
    urgency: 'MEDIUM',
    raw_text: 'SCHEDULED: Core router firmware upgrade on Europe-Asia subsea transit. Minimal latency fluctuations of 15-25ms anticipated during failover convergence.',
    created_at: Date.now() - 23400000,
  },
  {
    id: 'news_bm_6',
    message_id: 'bm_news_msg_6',
    category: 'REGULATION',
    headline: 'UK Ofcom Anti-Spoofing Directive on International VoIP Inbound to +44 7 Mobile Ranges',
    affected_countries: 'United Kingdom, Germany',
    urgency: 'MEDIUM',
    raw_text: 'BULLETIN: Ofcom implementation guidance mandates carrier boundary drop for foreign CLI claiming UK local origin without roaming clearinghouse tokens.',
    created_at: Date.now() - 28800000,
  },
  {
    id: 'news_bm_7',
    message_id: 'bm_news_msg_7',
    category: 'MAINTENANCE',
    headline: 'SEACOM West Africa Subsea Cable Emergency Wet Plant Maintenance',
    affected_countries: 'South Africa, Kenya, Tanzania',
    urgency: 'MEDIUM',
    raw_text: 'ADVISORY: Repair ship dispatched off the coast of Mtunzini. Traffic rerouted via WACS and Equiano fiber systems during scheduled daylight hours.',
    created_at: Date.now() - 36000000,
  },
  {
    id: 'news_bm_8',
    message_id: 'bm_news_msg_8',
    category: 'INFRASTRUCTURE',
    headline: 'PLDT Trans-Pacific AAG Segment Fault Repairs Successfully Completed',
    affected_countries: 'Philippines, USA, Japan',
    urgency: 'LOW',
    raw_text: 'RECOVERY: Full restoration confirmed on Asia-America Gateway segment 1. Latency on Manila-San Jose voice trunks returned to baseline 155ms.',
    created_at: Date.now() - 68400000,
  },
];

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getCategoryColor(category: string): { bg: string; text: string; border: string } {
  const c = (category || '').toUpperCase();
  if (c.includes('OUTAGE')) {
    return {
      bg: 'bg-rose-500/15',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-500/30',
    };
  }
  if (c.includes('REGULAT')) {
    return {
      bg: 'bg-purple-500/15',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-500/30',
    };
  }
  if (c.includes('MAINTENANCE')) {
    return {
      bg: 'bg-amber-500/15',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/30',
    };
  }
  if (c.includes('FRAUD')) {
    return {
      bg: 'bg-orange-500/15',
      text: 'text-orange-600 dark:text-orange-400',
      border: 'border-orange-500/30',
    };
  }
  return {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/30',
  };
}

export const NewsView: React.FC = () => {
  // 1. Data State
  const [newsItems, setNewsItems] = useState<NormalizedNewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // 2. Feed Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('priority-recency');

  // 3. Pagination State
  const [pageSize, setPageSize] = useState<PageSizeOption>(12);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Router deep-linking
  const { newsSlug } = useParams<{ newsSlug?: string }>();
  const navigate = useNavigate();

  // 4. UI Accents & Interaction
  const [isBriefingExpanded, setIsBriefingExpanded] = useState<boolean>(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const feedScrollRef = useRef<HTMLDivElement>(null);

  // Normalize Backend Items
  const normalizeNews = useCallback((items: BackendNewsItem[]): NormalizedNewsItem[] => {
    return items.map((item) => {
      let rawUrgency = (item.urgency || 'MEDIUM').toUpperCase();
      if (!['HIGH', 'MEDIUM', 'LOW'].includes(rawUrgency)) {
        rawUrgency = 'MEDIUM';
      }
      return {
        id: item.id || `news_${Math.random()}`,
        messageId: item.message_id || '',
        category: (item.category || 'INFRASTRUCTURE').toUpperCase(),
        headline: item.headline || 'Carrier Advisory Bulletin',
        affectedCountries: item.affected_countries || 'Global Interconnect',
        urgency: rawUrgency as 'HIGH' | 'MEDIUM' | 'LOW',
        rawText: item.raw_text || '',
        createdAt: Number(item.created_at) || Date.now(),
        timeAgo: formatRelativeTime(Number(item.created_at) || Date.now()),
      };
    });
  }, []);

  // Fetch Live News from API
  const loadNewsData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const data = await fetchNews(200);
      if (Array.isArray(data)) {
        setNewsItems(normalizeNews(data));
      } else {
        setNewsItems(normalizeNews(FALLBACK_NEWS));
      }
      setLastRefreshed(new Date());
      window.dispatchEvent(new CustomEvent('wapp:news-changed'));
    } catch (err) {
      console.warn('NewsView API fallback:', err);
      setNewsItems(normalizeNews(FALLBACK_NEWS));
      window.dispatchEvent(new CustomEvent('wapp:news-changed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normalizeNews]);

  useEffect(() => {
    loadNewsData();
    // Refresh interval every 30 seconds
    const interval = setInterval(() => {
      loadNewsData(true);
    }, 30000);

    const handleAccountChange = () => {
      setNewsItems([]);
      loadNewsData();
    };
    window.addEventListener('wapp:account-changed', handleAccountChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('wapp:account-changed', handleAccountChange);
    };
  }, [loadNewsData]);

  // Extract Categories with Dynamic Item Counts
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = { ALL: newsItems.length };
    newsItems.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [newsItems]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    newsItems.forEach((i) => set.add(i.category));
    return ['ALL', ...Array.from(set)];
  }, [newsItems]);

  // Urgency Counts
  const urgencyCounts = useMemo(() => {
    return {
      high: newsItems.filter((i) => i.urgency === 'HIGH').length,
      medium: newsItems.filter((i) => i.urgency === 'MEDIUM').length,
      low: newsItems.filter((i) => i.urgency === 'LOW').length,
    };
  }, [newsItems]);

  // Priority & Recency Sorting + Multi-Factor Filtering
  const filteredAndSortedNews = useMemo(() => {
    let result = [...newsItems];

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.headline.toLowerCase().includes(q) ||
          item.affectedCountries.toLowerCase().includes(q) ||
          item.rawText.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    // Filter by Category
    if (categoryFilter !== 'ALL') {
      result = result.filter((item) => item.category === categoryFilter);
    }

    // Filter by Urgency
    if (urgencyFilter !== 'ALL') {
      result = result.filter((item) => item.urgency === urgencyFilter);
    }

    // Sort Engine
    result.sort((a, b) => {
      if (sortMode === 'newest-first') {
        return b.createdAt - a.createdAt;
      }
      if (sortMode === 'oldest-first') {
        return a.createdAt - b.createdAt;
      }
      if (sortMode === 'high-priority') {
        // High urgency first, then newest
        const aIsHigh = a.urgency === 'HIGH' ? 1 : 0;
        const bIsHigh = b.urgency === 'HIGH' ? 1 : 0;
        if (aIsHigh !== bIsHigh) return bIsHigh - aIsHigh;
        return b.createdAt - a.createdAt;
      }

      // Default: 'priority-recency'
      // 1. HIGH urgency (weight 3000) > MEDIUM (weight 2000) > LOW (weight 1000)
      // 2. Within each tier, most recent alert first
      const urgencyScore = (u: string) => {
        if (u === 'HIGH') return 3000;
        if (u === 'MEDIUM') return 2000;
        return 1000;
      };
      const scoreDiff = urgencyScore(b.urgency) - urgencyScore(a.urgency);
      if (scoreDiff !== 0) return scoreDiff;
      return b.createdAt - a.createdAt;
    });

    return result;
  }, [newsItems, searchQuery, categoryFilter, urgencyFilter, sortMode]);

  // Total Pages Calculation
  const totalItems = filteredAndSortedNews.length;
  const numericPageSize = pageSize === 'ALL' ? totalItems || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / numericPageSize));

  // Clamped Current Page
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Paginated Sliced Alerts
  const paginatedAlerts = useMemo(() => {
    if (pageSize === 'ALL') return filteredAndSortedNews;
    const start = (safeCurrentPage - 1) * numericPageSize;
    return filteredAndSortedNews.slice(start, start + numericPageSize);
  }, [filteredAndSortedNews, safeCurrentPage, numericPageSize, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, urgencyFilter, sortMode, pageSize]);

  // Card Text Expand Toggle with URL synchronization
  const toggleExpand = (target: string | NormalizedNewsItem) => {
    const id = typeof target === 'string' ? target : target.id;
    const item = typeof target === 'string' ? newsItems.find((i) => i.id === target) : target;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (item && newsSlug && matchesNewsSlug(item, newsSlug)) {
          navigate('/news');
        }
      } else {
        next.add(id);
        if (item) {
          navigate(`/news/${getNewsSlug(item)}`);
        }
      }
      return next;
    });
  };

  // Deep-linking: auto-expand and scroll to alert when newsSlug is provided
  useEffect(() => {
    if (newsSlug && newsItems.length > 0) {
      const match = newsItems.find((item) => matchesNewsSlug(item, newsSlug));
      if (match) {
        setExpandedIds((prev) => new Set(prev).add(match.id));
        if (pageSize !== 'ALL') {
          const idx = filteredAndSortedNews.findIndex((i) => i.id === match.id);
          if (idx !== -1) {
            const pageForIdx = Math.floor(idx / (pageSize as number)) + 1;
            setCurrentPage(pageForIdx);
          }
        }
        setTimeout(() => {
          const cardEl = document.getElementById(`news-card-${match.id}`);
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      }
    }
  }, [newsSlug, newsItems, filteredAndSortedNews, pageSize]);

  // Copy Alert Handler
  const handleCopyAlert = async (item: NormalizedNewsItem) => {
    const textToCopy = `[${item.urgency} ALERT] ${item.headline}\nCategory: ${item.category}\nAffected Corridors: ${item.affectedCountries}\nAdvisory: ${item.rawText || item.headline}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Scroll to Top of Feed Container
  const scrollToFeedTop = () => {
    if (feedScrollRef.current) {
      feedScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const hasActiveFilters = searchQuery !== '' || categoryFilter !== 'ALL' || urgencyFilter !== 'ALL';

  const resetAllFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setUrgencyFilter('ALL');
    setSortMode('priority-recency');
  };

  // Dynamic Global Risk Assessment
  const globalRiskAssessment = useMemo(() => {
    const highCount = urgencyCounts.high;
    if (highCount >= 4) {
      return {
        level: 'CRITICAL GLOBAL RISK',
        color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
        badge: 'bg-rose-500',
        headline: 'Multiple Primary Subsea Corridors Degraded • South Asia & Europe Latency High',
        traderAction: 'Reroute urgent voice traffic via Singapore direct hubs. Push premium rates for low-latency pure CLI.',
      };
    }
    if (highCount >= 2) {
      return {
        level: 'MODERATE GLOBAL RISK',
        color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        badge: 'bg-amber-500',
        headline: 'South Asia Transit Latency Degraded • Western Europe Pure CLI Stable',
        traderAction: 'Reroute affected A-number corridors. Monitor transit ASR drops on Pakistan & Colombia.',
      };
    }
    return {
      level: 'NORMAL NETWORK STATUS',
      color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      badge: 'bg-emerald-500',
      headline: 'Global Wholesale Voice Corridors Operating Within Standard Latency Baselines',
      traderAction: 'Standard routing operational. Maintain existing wholesale floor rates and carrier peering.',
    };
  }, [urgencyCounts]);

  // Dynamic Critical Corridors extracted from live active alerts
  const criticalCorridors = useMemo(() => {
    const highAlerts = newsItems.filter((i) => i.urgency === 'HIGH');
    const sourceList = highAlerts.length > 0 ? highAlerts : newsItems;
    if (sourceList.length === 0) return [];

    const tags: Array<{ label: string; urgency: 'HIGH' | 'MEDIUM' | 'LOW' }> = [];
    const seen = new Set<string>();

    for (const item of sourceList) {
      if (item.affectedCountries && item.affectedCountries !== 'Global Interconnect') {
        const countries = item.affectedCountries.split(',').map((c) => c.trim()).filter(Boolean);
        for (const country of countries) {
          if (!seen.has(country) && tags.length < 4) {
            seen.add(country);
            tags.push({ label: `${country} (${item.category})`, urgency: item.urgency });
          }
        }
      } else if (!seen.has(item.headline) && tags.length < 4) {
        seen.add(item.headline);
        const short = item.headline.length > 25 ? item.headline.slice(0, 23) + '...' : item.headline;
        tags.push({ label: short, urgency: item.urgency });
      }
    }
    return tags;
  }, [newsItems]);

  // Dynamic Signal Diagnostics
  const carrierSignalDiagnostics = useMemo(() => {
    if (newsItems.length === 0) {
      return 'All carrier signaling baselines operating nominally. Zero active disruptions detected across voice trunks.';
    }
    const highAlerts = newsItems.filter((i) => i.urgency === 'HIGH');
    if (highAlerts.length > 0) {
      const top = highAlerts[0];
      return `Critical advisory: ${top.headline} (${top.affectedCountries || 'Global'}). Recommended to verify transit jitter and routing quality.`;
    }
    const top = newsItems[0];
    return `Latest advisory: ${top.headline} (${top.category}). Peering conditions stable.`;
  }, [newsItems]);

  return (
    <div id="view-news" className="space-y-5">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
              </span>
              <span>Global Telecom Outages & Regulatory Feed</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase tracking-wider hidden sm:inline-flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" />
              Live Radar
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time carrier incident intelligence synthesized via DeepSeek AI • {newsItems.length} active advisories
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsBriefingExpanded((prev) => !prev)}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer text-xs"
            title={isBriefingExpanded ? 'Collapse AI Briefing' : 'Expand AI Briefing'}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>{isBriefingExpanded ? 'Hide Briefing' : 'Show Briefing'}</span>
            {isBriefingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => loadNewsData()}
            disabled={refreshing}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer text-xs"
            title="Refresh feed alerts from backend"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
            <span>{refreshing ? 'Updating...' : 'Refresh Feed'}</span>
          </button>
        </div>
      </div>

      {/* 2. AI Executive Outage & Risk Briefing Card (Collapsible) */}
      {isBriefingExpanded && (
        <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-dark-700/80 space-y-4 shadow-xl transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-dark-800">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                </span>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1.5 animate-pulse ${globalRiskAssessment.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${globalRiskAssessment.badge} animate-ping shrink-0`} />
                    {globalRiskAssessment.level}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Updated {formatRelativeTime(lastRefreshed.getTime())}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {globalRiskAssessment.headline}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-xs font-mono text-slate-700 dark:text-slate-300">
                High Urgency: <strong className="text-rose-500 dark:text-rose-400 font-bold">{urgencyCounts.high}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-xs font-mono text-slate-700 dark:text-slate-300">
                Total Alerts: <strong className="text-slate-900 dark:text-white font-bold">{newsItems.length}</strong>
              </span>
            </div>
          </div>

          {/* 3-Column Tactical Intelligence Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-900/90 border border-slate-200/80 dark:border-dark-800 space-y-2">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>Critical Corridors at Risk</span>
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {criticalCorridors.length === 0 ? (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    All voice corridors nominal • Zero active outages
                  </span>
                ) : (
                  criticalCorridors.map((c, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                        c.urgency === 'HIGH'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 animate-pulse'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          c.urgency === 'HIGH' ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                      />
                      {c.label}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-900/90 border border-slate-200/80 dark:border-dark-800 space-y-2">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Carrier Signal Diagnostics</span>
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {carrierSignalDiagnostics}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-dark-900/90 border border-slate-200/80 dark:border-dark-800 space-y-2">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-emerald-500" />
                <span>Recommended Trader Action</span>
              </span>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed font-medium">
                {globalRiskAssessment.traderAction}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. News Feed Command & Filter Toolbar (Sticky UX) */}
      <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-dark-700/80 space-y-3 shadow-md bg-white/70 dark:bg-dark-900/70 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search headline, country, advisory, category..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-100 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Selectors & Sort Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Urgency Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">Urgency:</span>
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Urgencies ({newsItems.length})</option>
                <option value="HIGH">🚨 High Urgency ({urgencyCounts.high})</option>
                <option value="MEDIUM">⚠️ Medium ({urgencyCounts.medium})</option>
                <option value="LOW">ℹ️ Low ({urgencyCounts.low})</option>
              </select>
            </div>

            {/* Sort Mode Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">Sort:</span>
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="priority-recency">⭐ Priority & Recency (Top Urgency First)</option>
                  <option value="newest-first">⏱️ Newest First (Chronological)</option>
                  <option value="high-priority">🔥 High Priority Only</option>
                  <option value="oldest-first">⏳ Oldest First</option>
                </select>
              </div>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                title="Reset all active search and filter constraints"
              >
                <X className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Pill Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            <span>Category:</span>
          </span>
          {uniqueCategories.map((cat) => {
            const isActive = categoryFilter === cat;
            const count = categoryStats[cat] || 0;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700 border border-slate-200/80 dark:border-dark-700/80'
                }`}
              >
                <span>{cat === 'ALL' ? 'All Feeds' : cat}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-dark-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Scrollable Feed Header & Stats Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-slate-900 dark:text-white font-bold">{paginatedAlerts.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white font-bold">{totalItems}</strong> alerts
          </span>
          {sortMode === 'priority-recency' && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium hidden sm:inline">
              Urgency Weighted Priority Active
            </span>
          )}
        </div>

        {totalPages > 1 && (
          <span className="font-mono text-[11px]">
            Page {safeCurrentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* 5. Scrollable News Feed Viewport Container */}
      <div
        ref={feedScrollRef}
        className="overflow-y-auto max-h-[640px] xl:max-h-[680px] space-y-3 pr-1 rounded-2xl scroll-smooth"
        style={{ overscrollBehavior: 'contain' }}
      >
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 glass-card rounded-2xl border border-slate-200 dark:border-dark-700">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Querying carrier incident radar...
            </span>
          </div>
        ) : paginatedAlerts.length === 0 ? (
          <div className="p-12 text-center glass-card rounded-2xl border border-slate-200 dark:border-dark-700 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Matching Telecom Incidents Found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              There are no carrier alerts matching your current search or filter combination.
            </p>
            <button
              onClick={resetAllFilters}
              className="btn btn-secondary btn-sm cursor-pointer mx-auto text-xs"
            >
              Clear Filters & Show All
            </button>
          </div>
        ) : (
          paginatedAlerts.map((alert) => {
            const isHigh = alert.urgency === 'HIGH';
            const isMed = alert.urgency === 'MEDIUM';
            const isExpanded = expandedIds.has(alert.id);
            const isCopied = copiedId === alert.id;
            const categoryStyle = getCategoryColor(alert.category);
            const isSlugMatch = Boolean(newsSlug && matchesNewsSlug(alert, newsSlug));

            return (
              <div
                key={alert.id}
                id={`news-card-${alert.id}`}
                className={`glass-card rounded-2xl p-5 space-y-3 transition-all shadow-sm ${
                  isHigh
                    ? 'border-2 border-rose-500/50 dark:border-rose-500/40 hover:border-rose-500 bg-rose-500/[0.03] shadow-rose-500/5'
                    : isMed
                    ? 'border border-amber-500/40 dark:border-amber-500/30 hover:border-amber-400 bg-amber-500/[0.015]'
                    : 'border border-slate-200 dark:border-dark-700/80 hover:border-slate-400 dark:hover:border-slate-600'
                } ${isSlugMatch ? 'ring-2 ring-emerald-500/60 shadow-lg' : ''}`}
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Urgency Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[10px] uppercase font-bold flex items-center gap-1.5 ${
                        isHigh
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/40 animate-pulse'
                          : isMed
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {isHigh ? (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                        </span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      )}
                      <span>{alert.urgency} Impact</span>
                    </span>

                    {/* Category Tag */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
                    >
                      {alert.category}
                    </span>

                    {/* Affected Corridors */}
                    <div className="flex items-center gap-1 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      <Globe className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>{alert.affectedCountries}</span>
                    </div>
                  </div>

                  {/* Relative Timestamp */}
                  <div
                    className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-mono shrink-0"
                    title={new Date(alert.createdAt).toLocaleString()}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{alert.timeAgo}</span>
                  </div>
                </div>

                {/* Headline */}
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                  {alert.headline}
                </h4>

                {/* Advisory Content / Summary */}
                {alert.rawText && (
                  <div className="space-y-1.5">
                    <p
                      className={`text-xs text-slate-600 dark:text-slate-300 leading-relaxed ${
                        isExpanded ? '' : 'line-clamp-2'
                      }`}
                    >
                      {alert.rawText}
                    </p>
                    {alert.rawText.length > 120 && (
                      <button
                        onClick={() => toggleExpand(alert.id)}
                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        <span>{isExpanded ? 'Collapse advisory' : 'Read full advisory'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                )}

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-dark-800 text-xs">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    <span>ID: {alert.id}</span>
                    <span>•</span>
                    <span>Source: Carrier Telemetry AI</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/news/${getNewsSlug(alert)}`;
                        navigator.clipboard.writeText(url);
                        setCopiedId(`link_${alert.id}`);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-dark-700 hover:bg-slate-200 dark:hover:bg-dark-700"
                      title="Copy direct link to this advisory"
                    >
                      {copiedId === `link_${alert.id}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3 h-3" />
                          <span>Share</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleCopyAlert(alert)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                        isCopied
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                          : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-dark-700 hover:bg-slate-200 dark:hover:bg-dark-700'
                      }`}
                      title="Copy alert headline and advisory text"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Alert</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 6. Pinned Feed Pagination Bar */}
      {totalItems > 0 && (
        <div className="glass-card rounded-2xl p-3 border border-slate-200 dark:border-dark-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm bg-white/70 dark:bg-dark-900/70">
          {/* Per Page Selector */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>Alerts per page:</span>
            <div className="flex items-center gap-1">
              {([6, 12, 24, 'ALL'] as PageSizeOption[]).map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    scrollToFeedTop();
                  }}
                  className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                    pageSize === size
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation Controls */}
          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setCurrentPage(1);
                  scrollToFeedTop();
                }}
                disabled={safeCurrentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  scrollToFeedTop();
                }}
                disabled={safeCurrentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 5) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - safeCurrentPage) <= 1;
                  })
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && (
                          <span className="px-1 text-xs text-slate-400">...</span>
                        )}
                        <button
                          onClick={() => {
                            setCurrentPage(p);
                            scrollToFeedTop();
                          }}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-center ${
                            safeCurrentPage === p
                              ? 'bg-emerald-500 text-white font-bold shadow-xs'
                              : 'bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  scrollToFeedTop();
                }}
                disabled={safeCurrentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setCurrentPage(totalPages);
                  scrollToFeedTop();
                }}
                disabled={safeCurrentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Showing{' '}
            <strong className="text-slate-900 dark:text-white">
              {totalItems === 0
                ? 0
                : `${(safeCurrentPage - 1) * numericPageSize + 1}–${Math.min(
                    safeCurrentPage * numericPageSize,
                    totalItems
                  )}`}
            </strong>{' '}
            of <strong className="text-slate-900 dark:text-white">{totalItems}</strong>
          </div>
        </div>
      )}
    </div>
  );
};
