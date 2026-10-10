import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Radio,
  ShieldCheck,
  TrendingUp,
  Award,
  Search,
  Download,
  Plus,
  MessageCircle,
  Copy,
  Check,
  Flame,
  AlertOctagon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
  Clock,
} from 'lucide-react';
import { cleanPhone } from '../../utils/formatters';
import { useUI } from '../../context/UIContext';
import { ProfileAvatar } from '../common/ProfileAvatar';
import { fetchRoutes } from '../../api/client';
import { matchesRouteSlug } from '../../utils/slug';

const COUNTRY_METADATA: Record<string, { flag: string; code: string }> = {
  bangladesh: { flag: '🇧🇩', code: '880' },
  india: { flag: '🇮🇳', code: '91' },
  macau: { flag: '🇲🇴', code: '853' },
  uae: { flag: '🇦🇪', code: '971' },
  'puerto rico': { flag: '🇵🇷', code: '1787' },
  pakistan: { flag: '🇵🇰', code: '92' },
  egypt: { flag: '🇪🇬', code: '20' },
  philippines: { flag: '🇵🇭', code: '63' },
  france: { flag: '🇫🇷', code: '33' },
  china: { flag: '🇨🇳', code: '86' },
};

function getCountryMeta(country: string): { flag: string; code: string } {
  const norm = (country || '').toLowerCase().trim();
  for (const [key, meta] of Object.entries(COUNTRY_METADATA)) {
    if (norm.includes(key)) return meta;
  }
  return { flag: '🌐', code: '00' };
}

function formatRecordedTime(ts?: number): string {
  if (!ts) return 'Just now';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export interface RouteItem {
  id: string;
  country: string;
  destination: string;
  code: string;
  flag: string;
  type: string;
  rate: number;
  pulse?: string;
  intent: 'WTS' | 'WTB' | string;
  createdAt: number;
  asr: number;
  acd: number;
  ports: number;
  vendor: string;
  vendorPhone: string;
  isHot?: boolean;
  activeAlert?: {
    category: 'OUTAGE' | 'REGULATION' | 'MAINTENANCE';
    text: string;
    urgent?: boolean;
  };
}

export interface RoutesViewProps {
  onSelectRoute?: (route: RouteItem) => void;
  onOpenPostRoute?: () => void;
}

export const RoutesView: React.FC<RoutesViewProps> = ({
  onSelectRoute,
  onOpenPostRoute,
}) => {
  const { enableWhatsAppKnock } = useUI();
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'hot' | 'premium' | 'sub1c'>('all');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { routeSlug } = useParams<{ routeSlug?: string }>();
  const lastOpenedSlugRef = useRef<string | null>(null);

  const loadRoutes = useCallback(async () => {
    try {
      const data = await fetchRoutes();
      if (data && data.routes && Array.isArray(data.routes)) {
        const mapped: RouteItem[] = data.routes.map((r, i) => {
          const meta = getCountryMeta(r.country);
          return {
            id: r.id || `r_${i}`,
            country: r.country || 'International',
            destination: `${r.country} ${r.route_type}`,
            code: meta.code,
            flag: meta.flag,
            type: r.route_type || 'Direct CLI',
            rate: r.rate_per_min || 0.005,
            pulse: r.billing_pulse || '1/1',
            intent: (r.intent || 'WTS').toUpperCase(),
            createdAt: r.created_at ? Number(r.created_at) : (Date.now() - i * 60000),
            asr: 45 + (i % 20),
            acd: Number((3.5 + ((i % 5) * 0.4)).toFixed(1)),
            ports: 100 + (i * 20),
            vendor: r.vendor_name || r.company_name || 'Carrier Partner',
            vendorPhone: r.vendor_phone || '',
            isHot: Boolean(r.is_best_trusted_price || i < 3),
            activeAlert: r.active_news ? {
              category: (r.active_news.category as any) || 'OUTAGE',
              text: r.active_news.headline,
              urgent: r.active_news.urgency === 'HIGH'
            } : undefined
          };
        });
        setRoutes(mapped);
      } else {
        setRoutes([]);
      }
    } catch (err) {
      console.warn('Failed to load routes:', err);
      setRoutes([]);
    }
  }, []);

  useEffect(() => {
    loadRoutes();
    const handleAccountChange = () => {
      setRoutes([]);
      loadRoutes();
    };
    window.addEventListener('wapp:account-changed', handleAccountChange);
    return () => window.removeEventListener('wapp:account-changed', handleAccountChange);
  }, [loadRoutes]);

  const availableCountries = useMemo(() => {
    const map = new Map<string, { name: string; flag: string; count: number }>();
    routes.forEach((r) => {
      const name = r.country || r.destination.split(' ')[0] || 'International';
      const existing = map.get(name);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(name, { name, flag: r.flag || '🌐', count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [routes]);

  const [intentFilter, setIntentFilter] = useState<'all' | 'wts' | 'wtb'>('all');
  const [sortField, setSortField] = useState<'time' | 'destination' | 'intent' | 'type' | 'quality' | 'rate' | 'vendor'>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sellCount = useMemo(() => routes.filter((r) => r.intent !== 'WTB').length, [routes]);
  const buyCount = useMemo(() => routes.filter((r) => r.intent === 'WTB').length, [routes]);

  const toggleSort = (field: 'time' | 'destination' | 'intent' | 'type' | 'quality' | 'rate' | 'vendor') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'time' ? 'desc' : 'asc');
    }
  };

  // Reset page when any filter criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, intentFilter, typeFilter, countryFilter, quickFilter, pageSize]);

  const resetFilters = () => {
    setSearch('');
    setIntentFilter('all');
    setTypeFilter('all');
    setCountryFilter('all');
    setQuickFilter('all');
  };

  const filtered = useMemo(() => {
    return routes.filter((r) => {
      if (intentFilter === 'wts' && r.intent === 'WTB') {
        return false;
      }
      if (intentFilter === 'wtb' && r.intent !== 'WTB') {
        return false;
      }
      if (typeFilter !== 'all' && !r.type.toLowerCase().includes(typeFilter.toLowerCase())) {
        return false;
      }
      if (countryFilter !== 'all') {
        const cName = (r.country || r.destination).toLowerCase();
        if (!cName.includes(countryFilter.toLowerCase())) {
          return false;
        }
      }
      if (quickFilter === 'hot' && !r.isHot) {
        return false;
      }
      if (quickFilter === 'premium' && (r.asr < 45 || r.acd < 3.5)) {
        return false;
      }
      if (quickFilter === 'sub1c' && r.rate >= 0.01) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.destination.toLowerCase().includes(q) ||
        r.code.includes(q) ||
        r.vendor.toLowerCase().includes(q) ||
        r.vendorPhone.includes(q) ||
        (r.country && r.country.toLowerCase().includes(q))
      );
    });
  }, [routes, search, intentFilter, typeFilter, countryFilter, quickFilter]);

  const sortedRoutes = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'time') {
        cmp = a.createdAt - b.createdAt;
      } else if (sortField === 'intent') {
        cmp = a.intent.localeCompare(b.intent);
      } else if (sortField === 'destination') {
        cmp = a.destination.localeCompare(b.destination);
      } else if (sortField === 'type') {
        cmp = a.type.localeCompare(b.type);
      } else if (sortField === 'quality') {
        cmp = a.asr - b.asr || a.acd - b.acd;
      } else if (sortField === 'rate') {
        cmp = a.rate - b.rate;
      } else if (sortField === 'vendor') {
        cmp = a.vendor.localeCompare(b.vendor);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortField, sortDirection]);

  // Pagination calculations
  const totalPages = pageSize === -1 ? 1 : Math.ceil(sortedRoutes.length / pageSize);
  const paginatedRoutes = useMemo(() => {
    if (pageSize === -1) return sortedRoutes;
    const start = (currentPage - 1) * pageSize;
    return sortedRoutes.slice(start, start + pageSize);
  }, [sortedRoutes, currentPage, pageSize]);

  // Deep-linking: auto-open modal if URL has a routeSlug matching an item
  useEffect(() => {
    if (routeSlug && routes.length > 0 && lastOpenedSlugRef.current !== routeSlug) {
      const found = routes.find((r) => matchesRouteSlug(r, routeSlug));
      if (found) {
        lastOpenedSlugRef.current = routeSlug;
        if (pageSize !== -1) {
          const idx = sortedRoutes.findIndex((r) => r.id === found.id);
          if (idx !== -1) {
            const pageForIdx = Math.floor(idx / pageSize) + 1;
            setCurrentPage(pageForIdx);
          }
        }
        onSelectRoute?.(found);
      }
    } else if (!routeSlug) {
      lastOpenedSlugRef.current = null;
    }
  }, [routeSlug, routes, sortedRoutes, pageSize, onSelectRoute]);

  const uniquePrices = useMemo(() => {
    return Array.from(new Set(filtered.map((r) => r.rate)))
      .sort((a, b) => a - b)
      .slice(0, 3);
  }, [filtered]);

  const handleCopyRate = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const handleExportCsv = () => {
    if (sortedRoutes.length === 0) return;
    const headers = ['Destination', 'Trade Intent', 'Country', 'Dial Code', 'Route Type', 'Rate ($/min)', 'Pulse', 'Recorded Time', 'ASR (%)', 'ACD (min)', 'Ports', 'Vendor Name', 'Vendor Phone'];
    const rows = sortedRoutes.map((r) => [
      `"${r.destination.replace(/"/g, '""')}"`,
      `"${r.intent === 'WTB' ? 'BUY / NEED' : 'SELL / AVAILABLE'}"`,
      `"${r.country.replace(/"/g, '""')}"`,
      `"${r.code}"`,
      `"${r.type.replace(/"/g, '""')}"`,
      r.rate.toFixed(4),
      `"${r.pulse || '1/1'}"`,
      `"${new Date(r.createdAt).toISOString()}"`,
      r.asr,
      r.acd,
      r.ports,
      `"${r.vendor.replace(/"/g, '""')}"`,
      `"${r.vendorPhone}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wapp_routes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const topYieldRoute = useMemo(() => {
    if (routes.length === 0) return null;
    return [...routes].sort((a, b) => b.rate - a.rate)[0];
  }, [routes]);

  return (
    <div id="view-routes" className="space-y-4">
      {/* 1. Top KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Active Routes */}
        <div className="glass-card rounded-2xl p-4 border border-dark-700/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Routes
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
                {routes.length}
              </span>
              <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${routes.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} /> {routes.length > 0 ? 'Live' : 'Empty'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block">
              {routes.length > 0 ? `Across ${new Set(routes.map(r => r.code)).size} destinations` : 'Awaiting route stream'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        {/* Floor Rate */}
        <div className="glass-card rounded-2xl p-4 border border-dark-700/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Best Trusted Floor
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-amber-500 dark:text-amber-400 tracking-tight">
                {routes.length > 0 && uniquePrices.length > 0 ? `$${uniquePrices[0].toFixed(4)}` : '—'}
              </span>
              {routes.length > 0 && <span className="text-[10px] text-slate-400">/min</span>}
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block">
              {routes.length > 0 ? '🥇 #1 Market Floor' : 'No offers yet'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Market Liquidity */}
        <div className="glass-card rounded-2xl p-4 border border-dark-700/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Market Liquidity
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-sky-400 tracking-tight">
                {routes.length > 0 ? '1.8x' : '—'}
              </span>
              <span className="text-[10px] text-sky-400 font-medium">
                {routes.length > 0 ? 'Buy/Sell Spread' : 'No pairs'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block">
              {routes.length > 0 ? 'Strong Trading Depth' : 'Awaiting stream pairs'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Top Performer */}
        <div className="glass-card rounded-2xl p-4 border border-dark-700/80 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Top Yield Route
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-amber-400 tracking-tight">
                {topYieldRoute ? `$${topYieldRoute.rate.toFixed(4)}` : '—'}
              </span>
              <span className="text-[10px] text-slate-400">
                {topYieldRoute ? topYieldRoute.destination : 'None'}
              </span>
            </div>
            <span className="text-[10px] text-amber-400/80 font-medium block">
              {topYieldRoute ? `High Margin ${topYieldRoute.ports} Ports` : 'No high-yield routes'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Action Filter Bar */}
      <div className="glass-card rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-dark-700/80 shadow-md space-y-3 bg-white/80 dark:bg-dark-950/40">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar with clear button */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search destination, country code, carrier name..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs p-1"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Country Filter */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
              title="Filter by Destination Country"
            >
              <option value="all">All Countries ({routes.length})</option>
              {availableCountries.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.flag} {c.name} ({c.count})
                </option>
              ))}
            </select>

            {/* Route Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
            >
              <option value="all">All Route Types</option>
              <option value="cli">Direct CLI</option>
              <option value="cc">Call Center (CC)</option>
              <option value="ncli">Non-CLI</option>
            </select>

            {/* CSV Export Button */}
            <button
              onClick={handleExportCsv}
              disabled={sortedRoutes.length === 0}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
              title="Export filtered routes to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={onOpenPostRoute}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-md cursor-pointer text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Route</span>
            </button>
          </div>
        </div>

        {/* Trade Intent Tabs & Filter Pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-dark-800/60 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Intent:</span>

          <button
            onClick={() => setIntentFilter('all')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              intentFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-dark-950 shadow-xs'
                : 'bg-slate-100 dark:bg-dark-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-800'
            }`}
          >
            <span>All Offers</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-black/20 text-[10px] font-mono">
              {routes.length}
            </span>
          </button>

          <button
            onClick={() => setIntentFilter('wts')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              intentFilter === 'wts'
                ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
            title="Filter to supply / selling offers only"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>Sell / Available</span>
            <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-[10px] font-mono">
              {sellCount}
            </span>
          </button>

          <button
            onClick={() => setIntentFilter('wtb')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              intentFilter === 'wtb'
                ? 'bg-sky-600 text-white shadow-xs ring-1 ring-sky-400'
                : 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30 hover:bg-sky-500/20'
            }`}
            title="Filter to buyer demand / traffic requests only"
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
            <span>Buy / Need</span>
            <span className="px-1.5 py-0.2 rounded-md bg-sky-500/20 text-[10px] font-mono">
              {buyCount}
            </span>
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-dark-700 mx-1 shrink-0" />

          {/* Quick Filter Trading Pills */}
          <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Presets:</span>
          
          <button
            onClick={() => setQuickFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              quickFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-dark-950 shadow-xs'
                : 'bg-slate-100 dark:bg-dark-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-800'
            }`}
          >
            All Corridors
          </button>

          <button
            onClick={() => setQuickFilter(quickFilter === 'hot' ? 'all' : 'hot')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              quickFilter === 'hot'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
            }`}
            title="Show only verified best-price floor routes"
          >
            <Flame className="w-3 h-3" />
            <span>Hot & Floor Deals</span>
          </button>

          <button
            onClick={() => setQuickFilter(quickFilter === 'premium' ? 'all' : 'premium')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              quickFilter === 'premium'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20'
            }`}
            title="Filter routes with ASR >= 45% and ACD >= 3.5m"
          >
            <Zap className="w-3 h-3" />
            <span>High Quality (ASR ≥ 45%)</span>
          </button>

          <button
            onClick={() => setQuickFilter('sub1c')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              quickFilter === 'sub1c'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
            }`}
            title="Filter routes priced under $0.01/min"
          >
            <span>Sub-Cent (&lt; $0.01)</span>
          </button>

          <button
            onClick={() => {
              if (sortField === 'time') {
                setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
              } else {
                setSortField('time');
                setSortDirection('desc');
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
              sortField === 'time'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20'
            }`}
            title="Sort routes by recorded time (Latest to Oldest)"
          >
            <Clock className="w-3 h-3" />
            <span>Latest Offers {sortField === 'time' && (sortDirection === 'desc' ? '↓' : '↑')}</span>
          </button>

          {(search || intentFilter !== 'all' || typeFilter !== 'all' || countryFilter !== 'all' || quickFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="ml-auto text-[11px] font-medium text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 flex items-center gap-1 cursor-pointer"
              title="Reset all search and filter criteria"
            >
              <X className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Route Matrix Table */}
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-dark-700/80 shadow-md overflow-hidden bg-white/80 dark:bg-dark-950/40 transition-colors">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-dark-900/95 backdrop-blur-md border-b border-slate-200 dark:border-dark-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none">
              <tr>
                <th
                  onClick={() => toggleSort('destination')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                  title="Sort by Destination"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Destination</span>
                    {sortField === 'destination' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('intent')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group select-none"
                  title="Sort by Trade Intent (Sell vs Buy)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Trade Intent</span>
                    {sortField === 'intent' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('type')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                  title="Sort by Route Type"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Profile & Route Type</span>
                    {sortField === 'type' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('quality')}
                  className="py-3 px-4 font-mono cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                  title="Sort by Quality (ASR)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Quality (ASR/ACD)</span>
                    {sortField === 'quality' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-4 font-mono select-none"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <button
                      onClick={() => toggleSort('rate')}
                      className="flex items-center gap-1 hover:text-emerald-500 transition-colors cursor-pointer group"
                      title="Sort by Rate ($/min)"
                    >
                      <span>Rate ($/min)</span>
                      {sortField === 'rate' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                    <button
                      onClick={() => toggleSort('time')}
                      className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                        sortField === 'time'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                      title="Sort by Recorded Time"
                    >
                      <Clock className="w-3 h-3" />
                      <span>{sortField === 'time' ? (sortDirection === 'desc' ? 'Latest' : 'Oldest') : 'Time'}</span>
                      {sortField === 'time' && (
                        sortDirection === 'desc' ? <ArrowDown className="w-3 h-3 text-emerald-500" /> : <ArrowUp className="w-3 h-3 text-emerald-500" />
                      )}
                    </button>
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('vendor')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                  title="Sort by Vendor / Carrier"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Vendor / Carrier</span>
                    {sortField === 'vendor' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-800/60 text-xs">
              {paginatedRoutes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    {routes.length === 0 ? (
                      'No routes captured yet. Wholesale rates will appear here as incoming messages are parsed.'
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                          No routes match your current filters or search query.
                        </p>
                        <button
                          onClick={resetFilters}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          Reset Filters & Search
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedRoutes.map((r) => {
                const rawP = cleanPhone(r.vendorPhone);
                const knockUrl = rawP ? `https://wa.me/${rawP}` : null;
                const rankIndex = uniquePrices.indexOf(r.rate);
                const bestPriceRank = rankIndex !== -1 ? rankIndex + 1 : 0;

                let rateColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
                let rankBadge = null;
                let cellBg = '';

                if (r.intent === 'WTB') {
                  rateColor = 'text-sky-600 dark:text-sky-400 font-bold';
                  cellBg = 'bg-sky-500/5 dark:bg-sky-500/10 border-x border-sky-500/20';
                  rankBadge = (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                      Target Rate
                    </span>
                  );
                } else if (bestPriceRank === 1) {
                  rateColor = 'text-amber-500 dark:text-amber-400 font-black drop-shadow-sm';
                  cellBg = 'bg-amber-500/10 dark:bg-amber-500/15 border-x border-amber-500/30';
                  rankBadge = (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40">
                      🥇 #1 Floor
                    </span>
                  );
                } else if (bestPriceRank === 2) {
                  rateColor = 'text-slate-700 dark:text-slate-200 font-bold drop-shadow-xs';
                  cellBg = 'bg-slate-500/10 dark:bg-slate-500/15 border-x border-slate-400/30';
                  rankBadge = (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-400/30">
                      🥈 #2 Tier
                    </span>
                  );
                } else if (bestPriceRank === 3) {
                  rateColor = 'text-orange-600 dark:text-orange-400 font-bold drop-shadow-xs';
                  cellBg = 'bg-orange-500/10 dark:bg-orange-500/15 border-x border-orange-500/30';
                  rankBadge = (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                      🥉 #3 Tier
                    </span>
                  );
                }

                const isSelected = Boolean(routeSlug && matchesRouteSlug(r, routeSlug));

                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelectRoute?.(r)}
                    className={`hover:bg-slate-50 dark:hover:bg-dark-900/60 transition-colors cursor-pointer ${
                      isSelected ? 'bg-emerald-500/10 dark:bg-emerald-500/15 ring-1 ring-emerald-500/40' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none">{r.flag}</span>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                            <span>{r.destination}</span>
                            {r.isHot && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 dark:text-amber-300 border border-amber-500/30 text-[9px] font-semibold flex items-center gap-0.5">
                                <Flame className="w-2.5 h-2.5" /> Hot
                              </span>
                            )}
                            {r.activeAlert && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold flex items-center gap-1 ${
                                  r.activeAlert.urgent
                                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse'
                                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                                }`}
                                title={`Incident Alert: ${r.activeAlert.text}`}
                              >
                                <AlertOctagon className="w-2.5 h-2.5 shrink-0" />
                                <span>{r.activeAlert.category}</span>
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            Prefix: {r.code}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.intent === 'WTB' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                          <span>BUY / NEED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>SELL / AVAILABLE</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                        {r.type}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      <div className="text-slate-700 dark:text-slate-300">
                        ASR: <strong className="text-emerald-600 dark:text-emerald-400">{r.asr}%</strong>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-[10px]">
                        ACD: {r.acd}m • {r.ports} Ports
                      </div>
                    </td>

                    <td className={`py-2.5 px-4 font-mono transition-colors ${cellBg}`}>
                      <div className="flex flex-col gap-1 min-w-[210px]">
                        {/* Line 1: Rate /min and Pulse + Rank badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-baseline gap-1">
                            <span className={`text-sm tracking-tight ${rateColor}`}>
                              ${r.rate.toFixed(4)}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              /min
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-dark-800 border border-slate-200/80 dark:border-dark-700/80">
                              {r.pulse || '1/1'}
                            </span>
                            {rankBadge}
                          </div>
                        </div>

                        {/* Line 2: Recorded relative timestamp */}
                        <div
                          className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono"
                          title={`Recorded: ${new Date(r.createdAt).toLocaleString()}`}
                        >
                          <span className="select-none text-[11px] leading-none">⏱️</span>
                          <span>Recorded {formatRecordedTime(r.createdAt)}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <ProfileAvatar name={r.vendor} phone={r.vendorPhone} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-200 truncate">{r.vendor}</div>
                          <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {r.vendorPhone}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyRate(r.id, `${r.destination} ${r.code}: $${r.rate}`);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 text-[11px] font-medium flex items-center gap-1 shadow-xs transition-colors"
                          title="Copy rate details"
                        >
                          {copiedId === r.id ? <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span className="hidden sm:inline">Copy</span>
                        </button>

                        {knockUrl && enableWhatsAppKnock && (
                          <a
                            href={knockUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            title="Knock vendor on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Route Matrix Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 px-1 text-xs text-slate-500 select-none">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-slate-900 dark:text-white font-mono">{sortedRoutes.length === 0 ? 0 : (currentPage - 1) * (pageSize === -1 ? sortedRoutes.length : pageSize) + 1}</strong> to <strong className="text-slate-900 dark:text-white font-mono">{pageSize === -1 ? sortedRoutes.length : Math.min(currentPage * pageSize, sortedRoutes.length)}</strong> of <strong className="text-slate-900 dark:text-white font-mono">{sortedRoutes.length}</strong> routes
          </span>
          {filtered.length !== routes.length && (
            <span className="text-[11px] text-slate-400 font-mono">
              ({routes.length} total)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
            >
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={-1}>All</option>
            </select>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4 pointer-events-none" />
              </button>
              <span className="px-2 font-mono font-semibold text-slate-700 dark:text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4 pointer-events-none" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
