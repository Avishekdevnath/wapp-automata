import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Scale,
  Sparkles,
  Zap,
  Copy,
  Check,
  ArrowRight,
  MessageCircle,
  RefreshCw,
  SlidersHorizontal,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  fetchArbitrage,
  fetchInsightsData,
  fetchRoutes,
  requestAiTradePitch,
  type ArbitrageOpportunity,
  type TradePitchItem,
  type InsightsSummary,
} from '../../api/client';
import { useUI } from '../../context/UIContext';

export const InsightsView: React.FC = () => {
  const {
    showPitchGenerator,
    enableWhatsAppKnock,
    showArbitrageSignals,
    setShowArbitrageSignals,
  } = useUI();
  const [loading, setLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [summary, setSummary] = useState<InsightsSummary>({
    totalRoutes: 21,
    totalCountries: 16,
    totalVendors: 8,
    urgentNews: 0,
  });

  // Pitch form state
  const [destination, setDestination] = useState('');
  const [currentQuote, setCurrentQuote] = useState('');
  const [targetOffer, setTargetOffer] = useState('');
  const [volume, setVolume] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');

  const [pitches, setPitches] = useState<TradePitchItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Arbitrage Filter & Sort State
  const [arbSearch, setArbSearch] = useState('');
  const [arbRouteType, setArbRouteType] = useState('all');
  const [arbProfitableOnly, setArbProfitableOnly] = useState(false);
  const [arbSort, setArbSort] = useState<'spread_desc' | 'margin_desc' | 'country_asc'>('spread_desc');
  const [arbPage, setArbPage] = useState(1);
  const ARB_PAGE_SIZE = 6;

  const filteredOpportunities = useMemo(() => {
    let list = opportunities.filter((opp) => {
      if (arbProfitableOnly && opp.spread <= 0) return false;
      if (arbRouteType !== 'all' && !(opp.route_type || '').toLowerCase().includes(arbRouteType.toLowerCase())) {
        return false;
      }
      if (!arbSearch.trim()) return true;
      const q = arbSearch.toLowerCase();
      return (
        opp.country.toLowerCase().includes(q) ||
        opp.buyer_name.toLowerCase().includes(q) ||
        opp.seller_name.toLowerCase().includes(q) ||
        (opp.buyer_company && opp.buyer_company.toLowerCase().includes(q)) ||
        (opp.seller_company && opp.seller_company.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      if (arbSort === 'spread_desc') {
        return b.spread - a.spread;
      } else if (arbSort === 'margin_desc') {
        return b.marginPercent - a.marginPercent;
      } else if (arbSort === 'country_asc') {
        return a.country.localeCompare(b.country);
      }
      return 0;
    });

    return list;
  }, [opportunities, arbSearch, arbRouteType, arbProfitableOnly, arbSort]);

  const totalArbPages = Math.max(1, Math.ceil(filteredOpportunities.length / ARB_PAGE_SIZE));
  const paginatedOpportunities = useMemo(() => {
    const start = (arbPage - 1) * ARB_PAGE_SIZE;
    return filteredOpportunities.slice(start, start + ARB_PAGE_SIZE);
  }, [filteredOpportunities, arbPage]);

  const resetArbFilters = () => {
    setArbSearch('');
    setArbRouteType('all');
    setArbProfitableOnly(false);
    setArbSort('spread_desc');
    setArbPage(1);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [arbData, insData, routesData] = await Promise.allSettled([
        fetchArbitrage(),
        fetchInsightsData(),
        fetchRoutes(),
      ]);

      if (arbData.status === 'fulfilled' && Array.isArray(arbData.value)) {
        setOpportunities(arbData.value);
      } else {
        setOpportunities([]);
      }

      if (insData.status === 'fulfilled' && insData.value?.summary) {
        setSummary(insData.value.summary);
      } else if (routesData.status === 'fulfilled' && routesData.value.routes.length > 0) {
        const rList = routesData.value.routes;
        setSummary({
          totalRoutes: rList.length,
          totalCountries: new Set(rList.map((r) => r.country)).size,
          totalVendors: new Set(rList.map((r) => r.vendor_phone || r.vendor_name)).size,
          urgentNews: 0,
        });
      }
    } catch (err) {
      console.warn('Failed to load insights telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApplyOpportunity = (opp: ArbitrageOpportunity) => {
    setDestination(opp.country);
    setCurrentQuote(`$${opp.sell_rate.toFixed(4)}`);
    setTargetOffer(`$${(opp.sell_rate * 0.92).toFixed(4)}`);
    setVendorName(opp.seller_name);
    setVendorPhone(opp.seller_phone);
  };

  const handleGeneratePitch = async () => {
    setGenerating(true);
    try {
      const results = await requestAiTradePitch({
        destination,
        currentRate: currentQuote.replace('$', ''),
        targetRate: targetOffer.replace('$', ''),
        volume,
        vendorName,
        vendorPhone,
      });

      if (results && results.length > 0) {
        setPitches(results);
      } else {
        // Fallback default generated pitch
        setPitches([
          {
            title: 'Aggressive Counter-Offer',
            strategy: 'Volume lock with immediate test traffic knock',
            text: `Hi ${vendorName}, regarding your ${destination} route:\nWe have daily live retail traffic of ${volume} ready for immediate routing.\nOur target counter-rate is ${targetOffer} (FAS-free, clean CLI, ACD 4+ mins).\nCan commit to 7-day upfront billing or daily USDT. Let us know if you can match this profile today so we can start testing ports.`,
          },
        ]);
      }
    } catch {
      setPitches([
        {
          title: 'Direct WhatsApp Knock',
          strategy: 'Standard negotiation template',
          text: `Hi ${vendorName}, regarding your ${destination} route:\nLive retail traffic of ${volume} ready now at ${targetOffer} FAS-free. Please share test SIP details.`,
        },
      ]);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPitch = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  return (
    <div id="view-insights" className="space-y-6">
      {/* Top Header & Telemetry Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <span>Wholesale Telecom Market Intelligence & Arbitrage</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time spread detection, bilateral corridor matching, and AI negotiation pitches
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="btn btn-secondary btn-sm flex items-center gap-2 self-start sm:self-center shadow-xs"
          title="Refresh market signals"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Signals'}</span>
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-dark-700/80 bg-white/70 dark:bg-dark-900/40 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-medium">
            Total Routes
          </span>
          <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {summary.totalRoutes}
          </span>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-dark-700/80 bg-white/70 dark:bg-dark-900/40 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-medium">
            Unique Destinations
          </span>
          <span className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
            {summary.totalCountries}
          </span>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-dark-700/80 bg-white/70 dark:bg-dark-900/40 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-medium">
            Active Carriers
          </span>
          <span className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
            {summary.totalVendors}
          </span>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-dark-700/80 bg-white/70 dark:bg-dark-900/40 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-medium">
            Spread Signals
          </span>
          <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {opportunities.length} Active
          </span>
        </div>
      </div>

      {/* Arbitrage Matchmaker Card */}
      {showArbitrageSignals ? (
        <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-dark-700/80 bg-white/80 dark:bg-dark-900/40 space-y-4 shadow-sm dark:shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Arbitrage Opportunities (Buy vs. Sell Matches)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Matches buyers seeking routes (WTB) with vendors supplying capacity (WTS) for immediate spread
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 font-semibold self-start sm:self-auto">
            {filteredOpportunities.length} of {opportunities.length} Matched
          </span>
        </div>

        {/* Arbitrage Controls Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between pt-2 border-t border-slate-200/60 dark:border-dark-800/60 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={arbSearch}
              onChange={(e) => {
                setArbSearch(e.target.value);
                setArbPage(1);
              }}
              placeholder="Search country, buyer, or vendor..."
              className="w-full pl-8 pr-8 py-1.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {arbSearch && (
              <button
                type="button"
                onClick={() => {
                  setArbSearch('');
                  setArbPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs p-1 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Route Type */}
            <select
              value={arbRouteType}
              onChange={(e) => {
                setArbRouteType(e.target.value);
                setArbPage(1);
              }}
              className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer font-medium"
            >
              <option value="all">All Profiles</option>
              <option value="cli">CLI Only</option>
              <option value="cc">CC Only</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={arbSort}
              onChange={(e) => setArbSort(e.target.value as any)}
              className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer font-medium"
            >
              <option value="spread_desc">Highest Spread ($)</option>
              <option value="margin_desc">Highest Margin (%)</option>
              <option value="country_asc">Country (A-Z)</option>
            </select>

            {/* Profitable Only Toggle */}
            <button
              type="button"
              onClick={() => {
                setArbProfitableOnly(!arbProfitableOnly);
                setArbPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                arbProfitableOnly
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-dark-900 border-slate-200 dark:border-dark-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-800'
              }`}
              title="Show only positive spread arbitrage"
            >
              + Spread Only
            </button>

            {/* Reset Filters */}
            {(arbSearch || arbRouteType !== 'all' || arbProfitableOnly || arbSort !== 'spread_desc') && (
              <button
                type="button"
                onClick={resetArbFilters}
                className="text-xs text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset filters"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {paginatedOpportunities.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-50/50 dark:bg-dark-950/40 border border-dashed border-slate-300 dark:border-dark-800 text-slate-400 text-xs">
              {opportunities.length === 0 ? (
                'No arbitrage opportunities detected yet. Live buy/sell spreads will appear here as wholesale routes are ingested.'
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    No arbitrage opportunities match your active search and filter criteria.
                  </p>
                  <button
                    type="button"
                    onClick={resetArbFilters}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            paginatedOpportunities.map((opp, idx) => {
            const spreadPositive = opp.spread > 0;
            const waPhone = opp.seller_phone ? opp.seller_phone.replace(/\D/g, '') : '';
            return (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50/90 dark:bg-dark-950/80 border border-slate-200 dark:border-dark-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:border-slate-300 dark:hover:border-dark-700"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-slate-200 text-xs">
                      {opp.country}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        spreadPositive
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {spreadPositive ? `+$${opp.spread.toFixed(4)}` : `$${opp.spread.toFixed(4)}`} / min Spread ({opp.marginPercent}%)
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      [{opp.route_type || 'CLI'}]
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>
                      Buyer: <strong className="font-semibold text-slate-800 dark:text-slate-200">${opp.buy_rate.toFixed(4)}</strong> ({opp.buyer_name})
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>
                      Vendor: <strong className="font-semibold text-emerald-600 dark:text-emerald-400">${opp.sell_rate.toFixed(4)}</strong> ({opp.seller_name})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  {showPitchGenerator && (
                    <button
                      onClick={() => handleApplyOpportunity(opp)}
                      title="Load into AI Pitch Generator"
                      className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                      <span>Use In Pitch</span>
                    </button>
                  )}

                  {waPhone && enableWhatsAppKnock ? (
                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Execute</span>
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        </div>

        {/* Pagination Bar */}
        {totalArbPages > 1 && (
          <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-500 select-none">
            <span>
              Showing page <strong className="text-slate-900 dark:text-white font-mono">{arbPage}</strong> of <strong className="text-slate-900 dark:text-white font-mono">{totalArbPages}</strong> ({filteredOpportunities.length} opportunities)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setArbPage((p) => Math.max(1, p - 1))}
                disabled={arbPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4 pointer-events-none" />
              </button>
              <span className="px-2 font-mono font-semibold text-slate-700 dark:text-slate-300">
                {arbPage} / {totalArbPages}
              </span>
              <button
                type="button"
                onClick={() => setArbPage((p) => Math.min(totalArbPages, p + 1))}
                disabled={arbPage >= totalArbPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4 pointer-events-none" />
              </button>
            </div>
          </div>
        )}
      </div>
      ) : (
        <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-dark-700 bg-slate-50/50 dark:bg-dark-950/40 flex items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <Scale className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Market Spreads & Arbitrage Signals are toggled <strong>OFF</strong> in Settings.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowArbitrageSignals(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-dark-800 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Enable Arbitrage
          </button>
        </div>
      )}

      {/* 1-Click AI Trade Negotiation Pitch Generator */}
      {showPitchGenerator && (
        <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-dark-700/80 bg-white/80 dark:bg-dark-900/40 space-y-5 shadow-sm dark:shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-dark-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>1-Click AI Trade Negotiation Pitch Generator</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generates high-converting counter-offers, volume commitments, and FAS-free SLA knocks using DeepSeek Telecom Intelligence
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold self-start sm:self-auto">
              <Zap className="w-3 h-3 fill-current" />
              <span>Trader Native</span>
            </span>
          </div>

          {/* Deal Parameters Input Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-400 font-medium mb-1">
                Destination Country
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Bangladesh Mobile (88017)"
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-400 font-medium mb-1">
                Current Carrier Quote
              </label>
              <input
                type="text"
                value={currentQuote}
                onChange={(e) => setCurrentQuote(e.target.value)}
                placeholder="e.g. $0.0215"
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-400 font-medium mb-1">
                Target Counter Offer
              </label>
              <input
                type="text"
                value={targetOffer}
                onChange={(e) => setTargetOffer(e.target.value)}
                placeholder="e.g. $0.0195"
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-400 font-medium mb-1">
                Daily Volume Ready
              </label>
              <input
                type="text"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="e.g. 50k mins/day"
                className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-mono transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleGeneratePitch}
            disabled={generating}
            className="btn btn-primary btn-sm flex items-center gap-2 shadow-md"
          >
            {generating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{generating ? 'Synthesizing Trade Pitches...' : 'Generate Trader Pitch (DeepSeek Engine)'}</span>
          </button>

          {pitches.length > 0 && (
            <div className="space-y-3 pt-2">
              {pitches.map((p, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-dark-950 border border-emerald-500/30 space-y-2.5 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {p.title}
                      </span>
                      {p.strategy && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          • {p.strategy}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopyPitch(p.text, idx)}
                      className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs"
                    >
                      {copiedIndex === idx ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedIndex === idx ? 'Copied' : 'Copy Pitch'}</span>
                    </button>
                  </div>
                  <pre className="text-xs text-slate-800 dark:text-slate-200 font-sans whitespace-pre-wrap leading-relaxed select-text">
                    {p.text}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
