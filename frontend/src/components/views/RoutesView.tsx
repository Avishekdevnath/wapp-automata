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
} from 'lucide-react';
import { cleanPhone } from '../../utils/formatters';
import { ProfileAvatar } from '../common/ProfileAvatar';
import { fetchRoutes } from '../../api/client';
import { matchesRouteSlug } from '../../utils/slug';

export interface RouteItem {
  id: string;
  destination: string;
  code: string;
  flag: string;
  type: string;
  rate: number;
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

const DEFAULT_ROUTES: RouteItem[] = [
  {
    id: 'r1',
    destination: 'Bangladesh Mobile',
    code: '88017 / 88019',
    flag: '🇧🇩',
    type: 'Pure Direct CLI',
    rate: 0.0215,
    asr: 48,
    acd: 4.2,
    ports: 180,
    vendor: 'Apex Telecom Global',
    vendorPhone: '+44 7700 900142',
    isHot: true,
    activeAlert: {
      category: 'OUTAGE',
      text: 'Red Sea Subsea (+140ms)',
      urgent: true,
    },
  },
  {
    id: 'r2',
    destination: 'Pakistan Jazz',
    code: '92300',
    flag: '🇵🇰',
    type: 'Direct CLI Stable',
    rate: 0.0180,
    asr: 44,
    acd: 3.8,
    ports: 120,
    vendor: 'FastRoute Carrier Desk',
    vendorPhone: '+1 202 555 0198',
    isHot: true,
  },
  {
    id: 'r3',
    destination: 'India Airtel Clean',
    code: '9198',
    flag: '🇮🇳',
    type: 'FAS-Free Tier-1',
    rate: 0.0092,
    asr: 52,
    acd: 4.8,
    ports: 250,
    vendor: 'Nexus Voice Singapore',
    vendorPhone: '+65 6789 0123',
  },
  {
    id: 'r4',
    destination: 'USA CC Flat',
    code: '1',
    flag: '🇺🇸',
    type: 'Conversational CC',
    rate: 0.0045,
    asr: 65,
    acd: 5.5,
    ports: 500,
    vendor: 'AmeriVoIP Carrier',
    vendorPhone: '+1 415 555 2671',
  },
  {
    id: 'r5',
    destination: 'United Kingdom Mobile',
    code: '447',
    flag: '🇬🇧',
    type: 'Pure CLI Route',
    rate: 0.0125,
    asr: 49,
    acd: 4.1,
    ports: 160,
    vendor: 'BritTel Exchange',
    vendorPhone: '+44 20 7946 0912',
    activeAlert: {
      category: 'REGULATION',
      text: 'Ofcom CLI Block',
      urgent: false,
    },
  },
  {
    id: 'r6',
    destination: 'Egypt Vodafone',
    code: '2010',
    flag: '🇪🇬',
    type: 'Direct White Route',
    rate: 0.0850,
    asr: 38,
    acd: 3.2,
    ports: 80,
    vendor: 'NileCarrier Cairo',
    vendorPhone: '+20 100 123 4567',
  },
  {
    id: 'r7',
    destination: 'Philippines Globe',
    code: '639',
    flag: '🇵🇭',
    type: 'Direct NCLI High ACD',
    rate: 0.0450,
    asr: 42,
    acd: 3.9,
    ports: 90,
    vendor: 'Manila Voice Desk',
    vendorPhone: '+63 917 123 4567',
  },
];

const COUNTRY_METADATA: Record<string, { flag: string; code: string }> = {
  usa: { flag: '🇺🇸', code: '1' },
  'united states': { flag: '🇺🇸', code: '1' },
  canada: { flag: '🇨🇦', code: '1' },
  colombia: { flag: '🇨🇴', code: '57' },
  mexico: { flag: '🇲🇽', code: '52' },
  brazil: { flag: '🇧🇷', code: '55' },
  'united kingdom': { flag: '🇬🇧', code: '44' },
  uk: { flag: '🇬🇧', code: '44' },
  germany: { flag: '🇩🇪', code: '49' },
  australia: { flag: '🇦🇺', code: '61' },
  'hong kong': { flag: '🇭🇰', code: '852' },
  singapore: { flag: '🇸🇬', code: '65' },
  bangladesh: { flag: '🇧🇩', code: '880' },
  india: { flag: '🇮🇳', code: '91' },
  japan: { flag: '🇯🇵', code: '81' },
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

export interface RoutesViewProps {
  onSelectRoute?: (route: RouteItem) => void;
  onOpenPostRoute?: () => void;
}

export const RoutesView: React.FC<RoutesViewProps> = ({
  onSelectRoute,
  onOpenPostRoute,
}) => {
  const [routes, setRoutes] = useState<RouteItem[]>(DEFAULT_ROUTES);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { routeSlug } = useParams<{ routeSlug?: string }>();
  const lastOpenedSlugRef = useRef<string | null>(null);

  const loadRoutes = useCallback(async () => {
    try {
      const data = await fetchRoutes();
      if (data && data.routes && data.routes.length > 0) {
        const mapped: RouteItem[] = data.routes.map((r, i) => {
          const meta = getCountryMeta(r.country);
          return {
            id: r.id || `r_${i}`,
            destination: `${r.country} ${r.route_type}`,
            code: meta.code,
            flag: meta.flag,
            type: r.route_type || 'Direct CLI',
            rate: r.rate_per_min || 0.005,
            asr: 45 + (i % 20),
            acd: Number((3.5 + ((i % 5) * 0.4)).toFixed(1)),
            ports: 100 + (i * 20),
            vendor: r.vendor_name || r.company_name || 'Carrier Partner',
            vendorPhone: r.vendor_phone || '+8801874819713',
            isHot: Boolean(r.is_best_trusted_price || i < 3),
            activeAlert: r.active_news ? {
              category: (r.active_news.category as any) || 'OUTAGE',
              text: r.active_news.headline,
              urgent: r.active_news.urgency === 'HIGH'
            } : undefined
          };
        });
        setRoutes(mapped);
      }
    } catch (err) {
      console.warn('Failed to load routes:', err);
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

  // Deep-linking: auto-open modal if URL has a routeSlug matching an item
  useEffect(() => {
    if (routeSlug && routes.length > 0 && lastOpenedSlugRef.current !== routeSlug) {
      const found = routes.find((r) => matchesRouteSlug(r, routeSlug));
      if (found) {
        lastOpenedSlugRef.current = routeSlug;
        onSelectRoute?.(found);
      }
    } else if (!routeSlug) {
      lastOpenedSlugRef.current = null;
    }
  }, [routeSlug, routes, onSelectRoute]);

  const [sortField, setSortField] = useState<'destination' | 'type' | 'quality' | 'rate' | 'vendor'>('rate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: 'destination' | 'type' | 'quality' | 'rate' | 'vendor') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filtered = useMemo(() => {
    return routes.filter((r) => {
      if (typeFilter !== 'all' && !r.type.toLowerCase().includes(typeFilter.toLowerCase())) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.destination.toLowerCase().includes(q) ||
        r.code.includes(q) ||
        r.vendor.toLowerCase().includes(q) ||
        r.vendorPhone.includes(q)
      );
    });
  }, [routes, search, typeFilter]);

  const sortedRoutes = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'destination') {
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block">Across 16 destinations</span>
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
                ${(uniquePrices[0] ?? 0.0045).toFixed(4)}
              </span>
              <span className="text-[10px] text-slate-400">/min</span>
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block">
              🥇 #1 Market Floor
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
                1.8x
              </span>
              <span className="text-[10px] text-sky-400 font-medium">Buy/Sell Spread</span>
            </div>
            <span className="text-[10px] text-slate-500 block">Strong Trading Depth</span>
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
                $0.0180
              </span>
              <span className="text-[10px] text-slate-400">PK Jazz</span>
            </div>
            <span className="text-[10px] text-amber-400/80 font-medium block">
              High Margin 120 Ports
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Action Filter Bar */}
      <div className="glass-card rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-dark-700/80 shadow-md space-y-3 bg-white/80 dark:bg-dark-950/40">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search destination, country code, carrier name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Route Types</option>
              <option value="cli">Direct CLI</option>
              <option value="cc">Call Center (CC)</option>
              <option value="ncli">Non-CLI</option>
            </select>

            <button className="btn btn-secondary btn-sm flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={onOpenPostRoute}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Route</span>
            </button>
          </div>
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
                  onClick={() => toggleSort('rate')}
                  className="py-3 px-4 font-mono cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                  title="Sort by Rate ($/min)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Rate ($/min)</span>
                    {sortField === 'rate' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    )}
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
              {sortedRoutes.map((r) => {
                const rawP = cleanPhone(r.vendorPhone);
                const knockUrl = rawP ? `https://wa.me/${rawP}` : null;
                const rankIndex = uniquePrices.indexOf(r.rate);
                const bestPriceRank = rankIndex !== -1 ? rankIndex + 1 : 0;

                let rateColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
                let rankBadge = null;
                let cellBg = '';

                if (bestPriceRank === 1) {
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
                      <div className="flex flex-col items-start gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm tracking-tight ${rateColor}`}>
                            ${r.rate.toFixed(4)}
                          </span>
                          {rankBadge}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          /min • 1/1
                        </span>
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

                        {knockUrl && (
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
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
