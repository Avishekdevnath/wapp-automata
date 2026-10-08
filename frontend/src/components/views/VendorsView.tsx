import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Users,
  Search,
  RefreshCw,
  MessageCircle,
  Copy,
  Check,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Table as TableIcon,
  LayoutGrid,
  Share2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { cleanPhone } from '../../utils/formatters';
import { ProfileAvatar } from '../common/ProfileAvatar';
import { fetchVendors, deleteVendor, deleteAllVendors, type BackendVendorItem } from '../../api/client';
import { matchesVendorSlug, getVendorSlug } from '../../utils/slug';
import { AddVendorModal } from '../modals/AddVendorModal';
import { DeleteVendorModal } from '../modals/DeleteVendorModal';

export const VendorsView: React.FC = () => {
  const [vendors, setVendors] = useState<BackendVendorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<BackendVendorItem | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  const confirmDeleteSingle = async (): Promise<boolean> => {
    if (!vendorToDelete) return false;
    const ok = await deleteVendor(vendorToDelete.phone);
    if (ok) {
      setVendors((prev) => prev.filter((v) => v.phone !== vendorToDelete.phone));
      return true;
    }
    return false;
  };

  const confirmDeleteAll = async (): Promise<boolean> => {
    const ok = await deleteAllVendors();
    if (ok) {
      setVendors([]);
      return true;
    }
    return false;
  };

  const { vendorSlug } = useParams<{ vendorSlug?: string }>();

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchVendors();
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load vendors:', err);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
    const handleAccountChange = () => {
      setVendors([]);
      loadVendors();
    };
    window.addEventListener('wapp:account-changed', handleAccountChange);
    return () => window.removeEventListener('wapp:account-changed', handleAccountChange);
  }, [loadVendors]);

  const filtered = useMemo(() => {
    if (!search.trim()) return vendors;
    const q = search.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.company.toLowerCase().includes(q) ||
        v.phone.includes(q) ||
        v.country.toLowerCase().includes(q)
    );
  }, [vendors, search]);

  // Deep-linking: auto-focus and scroll to vendor matching vendorSlug
  useEffect(() => {
    if (vendorSlug && vendors.length > 0) {
      const match = vendors.find((v) => matchesVendorSlug(v, vendorSlug));
      if (match) {
        if (pageSize !== -1) {
          const idx = filtered.findIndex((v) => v.id === match.id);
          if (idx !== -1) {
            const pageForIdx = Math.floor(idx / pageSize) + 1;
            setCurrentPage(pageForIdx);
          }
        }
        setTimeout(() => {
          const el =
            document.getElementById(`vendor-row-${match.id}`) ||
            document.getElementById(`vendor-card-${match.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      }
    }
  }, [vendorSlug, vendors, filtered, pageSize]);

  const [sortField, setSortField] = useState<'name' | 'company' | 'country' | 'volume' | 'activity'>('volume');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: 'name' | 'company' | 'country' | 'volume' | 'activity') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'volume' ? 'desc' : 'asc');
    }
  };

  const sortedVendors = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'company') {
        cmp = a.company.localeCompare(b.company);
      } else if (sortField === 'country') {
        cmp = a.country.localeCompare(b.country);
      } else if (sortField === 'volume') {
        cmp = a.offersCount - b.offersCount;
      } else if (sortField === 'activity') {
        cmp = (a.lastSeen || '').localeCompare(b.lastSeen || '');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortField, sortDirection]);

  // Pagination slicing
  const totalPages = pageSize === -1 ? 1 : Math.ceil(sortedVendors.length / pageSize);
  const paginatedVendors = useMemo(() => {
    if (pageSize === -1) return sortedVendors;
    const start = (currentPage - 1) * pageSize;
    return sortedVendors.slice(start, start + pageSize);
  }, [sortedVendors, currentPage, pageSize]);

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <div id="view-vendors" className="space-y-4">
      {/* Top Search & Filter Toolbar Card */}
      <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-dark-700/80 space-y-3 shadow-sm bg-white/80 dark:bg-dark-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Carriers & Account Managers Directory
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 font-mono">
                {filtered.length} Contacts
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Wholesale carrier desks, direct telecom account managers, and interconnect partners aggregated from active stream.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Mode Toggle: Table (Default) vs Cards */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-800">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-dark-800 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
                title="Switch to Table view"
              >
                <TableIcon className="w-3.5 h-3.5 pointer-events-none" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-dark-800 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
                title="Switch to Card Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5 pointer-events-none" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Add a verified carrier partner manually"
            >
              <Plus className="w-3.5 h-3.5 pointer-events-none" />
              <span>Add Carrier</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeleteAllOpen(true)}
              disabled={loading || vendors.length === 0}
              className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Delete all carriers and reset directory"
            >
              <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
              <span className="hidden sm:inline">Delete All</span>
            </button>

            <button
              onClick={loadVendors}
              disabled={loading}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh carriers list"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-purple-600 dark:text-purple-400 pointer-events-none ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search carrier name, contact, phone (+44...), country, or company..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs text-slate-500">
            <span className="text-[11px] font-medium hidden sm:inline">Show:</span>
            {[15, 25, 50, 100, -1].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                  pageSize === size
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-dark-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-800'
                }`}
              >
                {size === -1 ? 'All' : size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state indicator */}
      {loading && vendors.length === 0 && (
        <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          <span className="text-xs">Loading carriers and contact directory...</span>
        </div>
      )}

      {/* 1. TABLE FORMAT (Default) */}
      {viewMode === 'table' ? (
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-dark-700/80 shadow-md overflow-hidden bg-white/80 dark:bg-dark-950/40 transition-colors">
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-dark-900/95 backdrop-blur-md border-b border-slate-200 dark:border-dark-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none">
                <tr>
                  <th
                    onClick={() => toggleSort('name')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                    title="Sort by Carrier Name"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Carrier / Account Manager</span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('company')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                    title="Sort by Company"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Company / Wholesale Desk</span>
                      {sortField === 'company' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('country')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                    title="Sort by Country"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Country & Region</span>
                      {sortField === 'country' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 font-mono">WhatsApp Phone</th>
                  <th
                    onClick={() => toggleSort('volume')}
                    className="py-3 px-4 text-center font-mono cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                    title="Sort by Offers Volume"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Offers Volume</span>
                      {sortField === 'volume' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('activity')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors group"
                    title="Sort by Last Activity"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Last Activity</span>
                      {sortField === 'activity' ? (
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
                {paginatedVendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      No matching contacts or carriers found.
                    </td>
                  </tr>
                ) : (
                  paginatedVendors.map((vendor) => {
                    const rawP = cleanPhone(vendor.phone);
                    const knockUrl = rawP ? `https://wa.me/${rawP}` : null;
                    const isSlugMatch = Boolean(vendorSlug && matchesVendorSlug(vendor, vendorSlug));
                    return (
                      <tr
                        key={vendor.id}
                        id={`vendor-row-${vendor.id}`}
                        className={`hover:bg-slate-50 dark:hover:bg-dark-900/60 transition-colors ${
                          isSlugMatch ? 'bg-purple-500/10 dark:bg-purple-500/15 ring-1 ring-purple-500/40' : ''
                        }`}
                      >
                        {/* Carrier Name & Avatar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ProfileAvatar name={vendor.name} phone={vendor.phone} size="sm" />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                                <span>{vendor.name}</span>
                                {vendor.verified && (
                                  <span title="Verified Active Carrier">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 pointer-events-none" />
                                  </span>
                                )}
                              </div>
                              {vendor.routes && vendor.routes.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1 max-w-[260px]">
                                  {vendor.routes.slice(0, 2).map((r, i) => (
                                    <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-slate-600 dark:text-slate-400">
                                      {r.country} {r.route_type} {r.rate_per_min ? `$${r.rate_per_min}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Company / Desk */}
                        <td className="py-3 px-4">
                          <span className="text-slate-700 dark:text-slate-300 font-medium block truncate max-w-[200px]">
                            {vendor.company || '—'}
                          </span>
                        </td>

                        {/* Country */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-dark-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-800 text-[11px] font-medium whitespace-nowrap">
                            {vendor.country}
                          </span>
                        </td>

                        {/* Phone */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {vendor.phone}
                        </td>

                        {/* Offers Count */}
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 font-mono">
                            {vendor.offersCount} {vendor.offersCount === 1 ? 'Offer' : 'Offers'}
                          </span>
                        </td>

                        {/* Last Activity */}
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                          {vendor.lastSeen}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const url = `${window.location.origin}/vendors/${getVendorSlug(vendor)}`;
                                navigator.clipboard.writeText(url);
                                setCopiedId(`link_${vendor.id}`);
                                setTimeout(() => setCopiedId(null), 1500);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 text-[11px] font-medium flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                              title="Copy direct link to this carrier"
                            >
                              {copiedId === `link_${vendor.id}` ? (
                                <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400 pointer-events-none" />
                              ) : (
                                <Share2 className="w-3 h-3 pointer-events-none" />
                              )}
                              <span>{copiedId === `link_${vendor.id}` ? 'Copied' : 'Share'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyPhone(vendor.id, vendor.phone)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700 text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 text-[11px] font-medium flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                              title="Copy phone number to clipboard"
                            >
                              {copiedId === vendor.id ? (
                                <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400 pointer-events-none" />
                              ) : (
                                <Copy className="w-3 h-3 pointer-events-none" />
                              )}
                              <span>{copiedId === vendor.id ? 'Copied' : 'Copy'}</span>
                            </button>

                            {knockUrl && (
                              <a
                                href={knockUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                title={`Open direct WhatsApp chat with ${vendor.name}`}
                              >
                                <MessageCircle className="w-3 h-3 pointer-events-none" />
                                <span>WhatsApp</span>
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => setVendorToDelete(vendor)}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 dark:bg-dark-900 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-dark-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-[11px] font-medium flex items-center shadow-xs transition-colors cursor-pointer"
                              title={`Delete carrier ${vendor.name}`}
                            >
                              <Trash2 className="w-3 h-3 pointer-events-none" />
                            </button>
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
      ) : paginatedVendors.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs border border-slate-200 dark:border-dark-700/80">
          No matching contacts or carriers found.
        </div>
      ) : (
        /* 2. CARDS FORMAT */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedVendors.map((vendor) => {
            const rawP = cleanPhone(vendor.phone);
            const knockUrl = rawP ? `https://wa.me/${rawP}` : null;
            const isSlugMatch = Boolean(vendorSlug && matchesVendorSlug(vendor, vendorSlug));
            return (
              <div
                key={vendor.id}
                id={`vendor-card-${vendor.id}`}
                className={`glass-card rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-dark-700/80 bg-white/80 dark:bg-dark-950/40 space-y-3 hover:border-purple-500/40 transition-colors shadow-sm ${
                  isSlugMatch ? 'ring-2 ring-purple-500/60 shadow-lg' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-3 min-w-0">
                    <ProfileAvatar name={vendor.name} phone={vendor.phone} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{vendor.name}</h4>
                        {vendor.verified && (
                          <span title="Verified Active Carrier">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 pointer-events-none" />
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-400 block mt-0.5 truncate">{vendor.company || '—'}</span>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        {vendor.country}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 font-mono">
                      {vendor.offersCount} {vendor.offersCount === 1 ? 'Offer' : 'Offers'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVendorToDelete(vendor)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title={`Delete carrier ${vendor.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                    </button>
                  </div>
                </div>

                {vendor.routes && vendor.routes.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {vendor.routes.slice(0, 3).map((r, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-800 text-slate-700 dark:text-slate-300">
                        {r.country} {r.route_type} {r.rate_per_min ? `$${r.rate_per_min}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-dark-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-700 dark:text-slate-400 text-[11px] truncate max-w-[65%]">{vendor.phone}</span>
                  <span className="text-slate-500 text-[10px] shrink-0">Seen {vendor.lastSeen}</span>
                </div>

                {/* 1-Word Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/vendors/${getVendorSlug(vendor)}`;
                      navigator.clipboard.writeText(url);
                      setCopiedId(`link_${vendor.id}`);
                      setTimeout(() => setCopiedId(null), 1500);
                    }}
                    className="btn btn-secondary btn-sm h-9 px-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    title="Copy direct link to this carrier"
                  >
                    {copiedId === `link_${vendor.id}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 pointer-events-none" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5 pointer-events-none" />
                    )}
                    <span>{copiedId === `link_${vendor.id}` ? 'Copied' : 'Share'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyPhone(vendor.id, vendor.phone)}
                    className="btn btn-secondary btn-sm flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    title="Copy contact phone number"
                  >
                    {copiedId === vendor.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 pointer-events-none" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 pointer-events-none" />
                    )}
                    <span>{copiedId === vendor.id ? 'Copied' : 'Copy'}</span>
                  </button>

                  {knockUrl ? (
                    <a
                      href={knockUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      title={`Open WhatsApp chat with ${vendor.name}`}
                    >
                      <MessageCircle className="w-3.5 h-3.5 pointer-events-none" />
                      <span>WhatsApp</span>
                    </a>
                  ) : (
                    <button
                      disabled
                      className="btn btn-secondary btn-sm flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-semibold opacity-40 cursor-not-allowed whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5 pointer-events-none" />
                      <span>WhatsApp</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 px-1 select-none text-xs text-slate-500">
          <span>
            Showing page <strong className="text-slate-900 dark:text-white font-mono">{currentPage}</strong> of <strong className="text-slate-900 dark:text-white font-mono">{totalPages}</strong> ({filtered.length} total contacts)
          </span>
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
        </div>
      )}

      {/* Modals */}
      <AddVendorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={loadVendors}
      />

      <DeleteVendorModal
        isOpen={Boolean(vendorToDelete)}
        onClose={() => setVendorToDelete(null)}
        onConfirm={confirmDeleteSingle}
        vendor={vendorToDelete}
      />

      <DeleteVendorModal
        isOpen={isDeleteAllOpen}
        onClose={() => setIsDeleteAllOpen(false)}
        onConfirm={confirmDeleteAll}
        vendor={null}
      />
    </div>
  );
};
