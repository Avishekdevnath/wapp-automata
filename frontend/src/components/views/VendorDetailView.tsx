import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  Copy,
  Check,
  RefreshCw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  Globe,
  Clock,
  Radio,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Phone
} from 'lucide-react';
import {
  fetchVendorDetail,
  type VendorDetailItem,
  type VendorRouteOffer
} from '../../api/client';
import { ProfileAvatar } from '../common/ProfileAvatar';
import { cleanPhone } from '../../utils/formatters';
import { useUI } from '../../context/UIContext';

// Relative time formatting helper
const formatRelativeTime = (timestamp?: number | string): string => {
  if (!timestamp) return 'No activity';
  const timeMs = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (isNaN(timeMs)) return 'Unknown';
  const diffMs = Date.now() - timeMs;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timeMs).toLocaleDateString();
};

export const VendorDetailView: React.FC = () => {
  const { vendorSlug } = useParams<{ vendorSlug: string }>();
  const navigate = useNavigate();
  const { enableWhatsAppKnock } = useUI();

  const [vendor, setVendor] = useState<VendorDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [intentFilter, setIntentFilter] = useState<'all' | 'wts' | 'wtb'>('all');
  const [sortField, setSortField] = useState<'rate' | 'time' | 'destination' | 'type'>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showBroadcasts, setShowBroadcasts] = useState<boolean>(true);

  // Load Carrier Data
  const loadCarrier = useCallback(async () => {
    if (!vendorSlug) return;
    setLoading(true);
    try {
      const data = await fetchVendorDetail(vendorSlug);
      setVendor(data);
    } finally {
      setLoading(false);
    }
  }, [vendorSlug]);

  useEffect(() => {
    loadCarrier();
  }, [loadCarrier]);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setCopiedText(label);
    setTimeout(() => {
      setCopied(false);
      setCopiedText(null);
    }, 1500);
  };

  // Toggle Sorting
  const toggleSort = (field: 'rate' | 'time' | 'destination' | 'type') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'rate' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  // Filtered & Sorted Routes
  const filteredRoutes = useMemo(() => {
    if (!vendor || !Array.isArray(vendor.routes)) return [];

    let list = [...vendor.routes];

    // Intent filter
    if (intentFilter === 'wts') {
      list = list.filter(r => (r.intent || 'WTS').toUpperCase() === 'WTS');
    } else if (intentFilter === 'wtb') {
      list = list.filter(r => (r.intent || '').toUpperCase() === 'WTB');
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        r =>
          (r.country || '').toLowerCase().includes(term) ||
          (r.route_type || '').toLowerCase().includes(term) ||
          (r.billing_pulse || '').toLowerCase().includes(term) ||
          (r.raw_text || '').toLowerCase().includes(term)
      );
    }

    // Sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'rate') {
        const rateA = a.rate_per_min ?? (sortDirection === 'asc' ? Infinity : -Infinity);
        const rateB = b.rate_per_min ?? (sortDirection === 'asc' ? Infinity : -Infinity);
        comparison = rateA - rateB;
      } else if (sortField === 'time') {
        comparison = (a.created_at || 0) - (b.created_at || 0);
      } else if (sortField === 'destination') {
        comparison = (a.country || '').localeCompare(b.country || '');
      } else if (sortField === 'type') {
        comparison = (a.route_type || '').localeCompare(b.route_type || '');
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [vendor, intentFilter, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredRoutes.length / pageSize) || 1;
  const paginatedRoutes = useMemo(() => {
    if (pageSize === -1) return filteredRoutes;
    const start = (currentPage - 1) * pageSize;
    return filteredRoutes.slice(start, start + pageSize);
  }, [filteredRoutes, currentPage, pageSize]);

  // Active counts
  const totalRoutesCount = vendor?.routes?.length || 0;
  const sellRoutesCount = vendor?.routes?.filter(r => (r.intent || 'WTS').toUpperCase() === 'WTS').length || 0;
  const buyRoutesCount = vendor?.routes?.filter(r => (r.intent || '').toUpperCase() === 'WTB').length || 0;

  const rawPhone = cleanPhone(vendor?.phone || '');
  const knockGeneralUrl = rawPhone
    ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(
        `Hi ${vendor?.name || 'there'}, reaching out from Telcia Wholesale regarding your telecom route offerings.`
      )}`
    : null;

  // Render Skeleton while loading
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-dark-800 rounded-lg" />
        <div className="h-44 bg-slate-200 dark:bg-dark-800 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-dark-800 rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-dark-800 rounded-2xl" />
      </div>
    );
  }

  // Render 404 / Empty state if carrier not found
  if (!vendor) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center max-w-lg mx-auto my-12 border border-slate-200 dark:border-dark-800 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
          <Phone className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Carrier Profile Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No carrier or account manager matched the requested identifier ({vendorSlug}). They may have been removed or have no active session.
        </p>
        <button
          onClick={() => navigate('/vendors')}
          className="btn btn-primary btn-sm inline-flex items-center gap-2 cursor-pointer font-semibold text-xs mx-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Carriers Directory</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Navigation Bar & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Link
            to="/vendors"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Carriers Directory</span>
          </Link>
          <span className="text-slate-400">/</span>
          <span className="font-bold text-slate-900 dark:text-white truncate max-w-xs">
            {vendor.company || vendor.name || vendor.phone}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCarrier}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="Refresh carrier dossier"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
            <span>Refresh</span>
          </button>

          {knockGeneralUrl && enableWhatsAppKnock && (
            <a
              href={knockGeneralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs font-semibold shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-200" />
              <span>Knock Carrier (WhatsApp)</span>
            </a>
          )}
        </div>
      </div>

      {/* 2. Carrier Profile Hero Card */}
      <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-dark-800 shadow-xs relative overflow-hidden bg-gradient-to-br from-white via-white to-slate-50 dark:from-dark-900 dark:via-dark-900 dark:to-dark-950">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <ProfileAvatar name={vendor.name || vendor.company} phone={vendor.phone} size="lg" />
              {vendor.verified && (
                <div
                  className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm"
                  title="Verified Carrier"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {vendor.name || 'Account Manager'}
                </h1>
                {vendor.verified && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    Verified Desk
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-dark-700">
                  {vendor.country || 'International 🌐'}
                </span>
              </div>

              {vendor.company && (
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {vendor.company}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => handleCopy(vendor.phone, 'Phone')}
                  className="inline-flex items-center gap-1 font-mono hover:text-emerald-500 transition-colors cursor-pointer"
                  title="Click to copy phone number"
                >
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{vendor.phone}</span>
                  {copied && copiedText === 'Phone' ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-50 hover:opacity-100" />
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span title={vendor.lastSeen}>Active {formatRelativeTime(vendor.lastSeen)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Knock Bar */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {knockGeneralUrl && enableWhatsAppKnock && (
              <a
                href={knockGeneralUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                <span>Open in WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 3. KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Total Offers */}
        <div className="glass-card rounded-xl p-3.5 border border-slate-200 dark:border-dark-800/80 bg-white dark:bg-dark-900/60 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Offers
            </span>
            <Radio className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1.5 font-mono">
            {totalRoutesCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Active wholesale routes</p>
        </div>

        {/* Sell / Available */}
        <div className="glass-card rounded-xl p-3.5 border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Sell / Available
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
          </div>
          <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1.5 font-mono">
            {sellRoutesCount}
          </div>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Supply / Outbound corridors</p>
        </div>

        {/* Buy / Need */}
        <div className="glass-card rounded-xl p-3.5 border border-sky-500/20 bg-sky-500/5 dark:bg-sky-500/10 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
              Buy / Need
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-xs" />
          </div>
          <div className="text-xl font-extrabold text-sky-700 dark:text-sky-300 mt-1.5 font-mono">
            {buyRoutesCount}
          </div>
          <p className="text-[10px] text-sky-600/80 dark:text-sky-400/80 mt-0.5">Buyer demand / Corridors needed</p>
        </div>

        {/* Active Destinations */}
        <div className="glass-card rounded-xl p-3.5 border border-slate-200 dark:border-dark-800/80 bg-white dark:bg-dark-900/60 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Destinations
            </span>
            <Globe className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1.5 font-mono">
            {vendor.destinationsCount || vendor.destinations?.length || 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Unique countries traded</p>
        </div>
      </div>

      {/* 4. Dedicated Carrier Route Matrix */}
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-dark-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Carrier's Route Offers</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 font-mono">
                  {filteredRoutes.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                All live wholesale voice corridors posted by {vendor.name || vendor.phone}
              </p>
            </div>

            {/* In-table Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search destination, quality..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Trade Intent Tabs */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-dark-800 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Intent:</span>

            <button
              onClick={() => {
                setIntentFilter('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                intentFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-dark-950 shadow-xs'
                  : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-700'
              }`}
            >
              <span>All Offers</span>
              <span className="px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-black/20 text-[10px] font-mono">
                {totalRoutesCount}
              </span>
            </button>

            <button
              onClick={() => {
                setIntentFilter('wts');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                intentFilter === 'wts'
                  ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Sell / Available</span>
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-[10px] font-mono">
                {sellRoutesCount}
              </span>
            </button>

            <button
              onClick={() => {
                setIntentFilter('wtb');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                intentFilter === 'wtb'
                  ? 'bg-sky-600 text-white shadow-xs ring-1 ring-sky-400'
                  : 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30 hover:bg-sky-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
              <span>Buy / Need</span>
              <span className="px-1.5 py-0.2 rounded-md bg-sky-500/20 text-[10px] font-mono">
                {buyRoutesCount}
              </span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/90 dark:bg-dark-950/80 border-b border-slate-200 dark:border-dark-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none">
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

                <th className="py-3 px-4 select-none">Trade Intent</th>

                <th
                  onClick={() => toggleSort('type')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                  title="Sort by Route Quality"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Quality / Type</span>
                    {sortField === 'type' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>

                <th className="py-3 px-4 font-mono">Billing Pulse</th>

                <th className="py-3 px-4 font-mono select-none">
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
                      title="Sort by Recorded Timestamp"
                    >
                      <span>Time</span>
                      {sortField === 'time' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  </div>
                </th>

                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-dark-800/60 text-xs">
              {paginatedRoutes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    {totalRoutesCount === 0 ? (
                      'No active route offers recorded yet for this carrier.'
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                          No routes match your current filter or search criteria.
                        </p>
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setIntentFilter('all');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedRoutes.map((r: VendorRouteOffer) => {
                  const isWtb = r.intent === 'WTB';
                  const rateStr = r.rate_per_min !== null && r.rate_per_min !== undefined
                    ? `$${Number(r.rate_per_min).toFixed(4)}`
                    : 'On Demand';

                  const prefilledPitch = `Hi ${vendor.name || 'there'}, I saw your ${
                    isWtb ? 'demand / BUY' : 'offer for'
                  } ${r.country} (${r.route_type}) at ${rateStr}/min (${r.billing_pulse}). Is this still open?`;

                  const knockOfferUrl = rawPhone
                    ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(prefilledPitch)}`
                    : null;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50 dark:hover:bg-dark-900/60 transition-colors"
                    >
                      {/* Destination */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{r.country}</span>
                        </div>
                      </td>

                      {/* Trade Intent */}
                      <td className="py-3 px-4">
                        {isWtb ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            <span>BUY / NEED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>SELL / AVAIL</span>
                          </span>
                        )}
                      </td>

                      {/* Quality / Route Type */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700">
                          {r.route_type}
                        </span>
                      </td>

                      {/* Billing Pulse */}
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 text-xs">
                        {r.billing_pulse || '1/1'}
                      </td>

                      {/* Rate / Min with Recorded Timestamp */}
                      <td className="py-3 px-4 font-mono">
                        <div className="space-y-0.5">
                          <div
                            className={`text-xs ${
                              isWtb
                                ? 'text-sky-600 dark:text-sky-400 font-bold'
                                : 'text-emerald-600 dark:text-emerald-400 font-bold'
                            }`}
                          >
                            {rateStr} <span className="text-[10px] font-normal text-slate-400">/min</span>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-sans">
                            <span>⏱️ Recorded</span>
                            <span title={new Date(r.created_at).toLocaleString()}>
                              {formatRelativeTime(r.created_at)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Knock Action */}
                      <td className="py-3 px-4 text-right">
                        {knockOfferUrl && enableWhatsAppKnock ? (
                          <a
                            href={knockOfferUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/50 cursor-pointer shadow-2xs"
                            title="Send prefilled WhatsApp negotiation pitch"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Knock Rate</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredRoutes.length > 10 && (
          <div className="p-3 border-t border-slate-200 dark:border-dark-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Show:</span>
              {[10, 25, 50, -1].map(size => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-0.5 rounded font-mono text-xs cursor-pointer transition-colors ${
                    pageSize === size
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'hover:bg-slate-100 dark:hover:bg-dark-800'
                  }`}
                >
                  {size === -1 ? 'All' : size}
                </button>
              ))}
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-dark-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-dark-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Recent Raw Broadcasts from this Carrier */}
      {Array.isArray(vendor.recentMessages) && vendor.recentMessages.length > 0 && (
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-900 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBroadcasts(prev => !prev)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-dark-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-emerald-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Recent WhatsApp Broadcasts & Chats ({vendor.recentMessages.length})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Raw verbatim message pitches captured from {vendor.name || vendor.phone}
                </p>
              </div>
            </div>
            {showBroadcasts ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showBroadcasts && (
            <div className="p-4 pt-0 divide-y divide-slate-100 dark:divide-dark-800/60">
              {vendor.recentMessages.map(msg => (
                <div key={msg.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {msg.chat_name || 'Direct / Group Chat'}
                    </span>
                    <span title={new Date(msg.timestamp).toLocaleString()}>
                      ⏱️ {formatRelativeTime(msg.timestamp)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-dark-950/60 p-3 rounded-xl border border-slate-200/60 dark:border-dark-800/80 font-mono whitespace-pre-wrap break-words leading-relaxed">
                    {msg.message_text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
