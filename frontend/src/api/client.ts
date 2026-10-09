import type { WhatsAppMessage } from '../types/message';
import type { DeviceStatus } from '../types/status';

const API_BASE = '/api';

export async function loginWithPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('wapp_token', data.token);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export interface OtpStatusResponse {
  connected: boolean;
  phone: string | null;
  cooldownSeconds: number;
  hasActiveCode: boolean;
}

export async function fetchOtpStatus(): Promise<OtpStatusResponse> {
  try {
    const res = await fetch(`${API_BASE}/auth/otp-status`);
    if (!res.ok) throw new Error('Failed to fetch OTP status');
    return await res.json();
  } catch {
    return { connected: false, phone: null, cooldownSeconds: 0, hasActiveCode: false };
  }
}

export async function requestPasswordResetOtp(): Promise<{ success: boolean; message?: string; error?: string; phone?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/request-otp`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Failed to send OTP' };
    return { success: true, message: data.message, phone: data.phone };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function verifyPasswordResetOtp(code: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string; token?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, newPassword })
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Verification failed' };
    if (data.token) {
      localStorage.setItem('wapp_token', data.token);
    }
    return { success: true, message: data.message, token: data.token };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export interface HelpArticleItem {
  id: string;
  category: string;
  categoryLabel: string;
  question: string;
  shortAnswer: string;
  detailedSteps: string[];
  waitTime?: string;
  tags: string[];
  actionLink?: {
    label: string;
    action: string;
  } | null;
  sortOrder?: number;
}

export async function fetchHelpArticles(category = 'all', query = ''): Promise<HelpArticleItem[]> {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (query && query.trim()) params.set('q', query.trim());

    const res = await authenticatedFetch(`${API_BASE}/help/articles?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load help articles');
    const data = await res.json();
    return data.articles || [];
  } catch (err) {
    console.error('Failed to fetch help articles:', err);
    return [];
  }
}

export async function askHelpConcierge(question: string): Promise<{
  mode: 'ai' | 'local';
  answer?: string;
  provider?: string;
  matchedArticleIds?: string[];
  fallbackReason?: string;
  message?: string;
}> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/help/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    return await res.json();
  } catch (err: any) {
    return { mode: 'local', fallbackReason: err?.message || 'Network error' };
  }
}

export async function fetchAiSettings(): Promise<{
  provider: string;
  deepseekKey: string;
  openaiKey: string;
  grokKey: string;
  hasConfiguredKey: boolean;
}> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/ai/settings`);
    if (!res.ok) throw new Error('Failed to fetch AI settings');
    return await res.json();
  } catch {
    return { provider: 'deepseek', deepseekKey: '', openaiKey: '', grokKey: '', hasConfiguredKey: false };
  }
}

async function authenticatedFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('wapp_token');
  const activeAccount = localStorage.getItem('wapp_active_account');
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('X-Account-ID') && activeAccount && activeAccount !== 'default') {
    headers.set('X-Account-ID', activeAccount);
  }
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    localStorage.removeItem('wapp_token');
    localStorage.removeItem('wapp_authenticated');
    sessionStorage.removeItem('wapp_authenticated');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wapp:unauthorized'));
    }
  }
  return res;
}

export function normalizeClientMessage(m: any): WhatsAppMessage {
  const text = m.text || m.message_text || '';
  const chatJid = m.chat_jid || m.remote_jid || '';
  const timestamp = m.timestamp;
  let occurredAt = m.occurred_at;
  if (!occurredAt && timestamp) {
    occurredAt = typeof timestamp === 'number' ? new Date(timestamp).toISOString() : String(timestamp);
  }
  return {
    ...m,
    id: String(m.id || ''),
    text,
    message_text: text,
    chat_jid: chatJid,
    remote_jid: chatJid,
    occurred_at: occurredAt,
    is_from_me: Boolean(m.is_from_me),
    has_media: Boolean(m.has_media),
    chat_name: m.chat_name || (chatJid.includes('@g.us') ? 'Group' : chatJid.split('@')[0]),
    chat_type: m.chat_type || (chatJid.includes('@g.us') ? 'group' : 'direct'),
  };
}

export interface FetchMessagesOptions {
  limit?: string | number;
  days?: string | number;
  before?: number | null;
  search?: string;
  filter?: string;
}

export async function fetchMessages(options: FetchMessagesOptions = {}): Promise<WhatsAppMessage[]> {
  try {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.days !== undefined) params.set('days', String(options.days));
    if (options.before !== undefined && options.before !== null) params.set('before', String(options.before));
    if (options.search) params.set('search', options.search);
    if (options.filter && options.filter !== 'all') params.set('filter', options.filter);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await authenticatedFetch(`${API_BASE}/messages${queryStr}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch messages`);
    const data = await res.json();
    const rawList = Array.isArray(data) ? data : (data.messages || []);
    const list = rawList.map(normalizeClientMessage);
    if (data.stats) {
      (list as any).serverStats = data.stats;
    }
    (list as any).hasMore = Boolean(data.hasMore);
    (list as any).totalInDb = data.totalInDb || (data.stats ? data.stats.total : list.length);
    (list as any).oldestTimestamp = data.oldestTimestamp || (rawList.length > 0 ? rawList[rawList.length - 1].timestamp : null);
    return list;
  } catch (err) {
    console.error('Failed to fetch messages:', err);
    return [];
  }
}

export async function fetchDeviceStatus(): Promise<DeviceStatus> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/session/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const isConn = Boolean(
      data.status === 'authenticated' ||
      data.status === 'connected' ||
      data.connected === true
    );
    const isAwaitingQr = Boolean(data.status === 'awaiting_qr' || data.status === 'qr_required');
    const isConnecting = Boolean(data.status === 'connecting');

    let mappedStatus: 'authenticated' | 'connecting' | 'qr_required' | 'disconnected' = 'disconnected';
    if (isConn) mappedStatus = 'authenticated';
    else if (isAwaitingQr) mappedStatus = 'qr_required';
    else if (isConnecting) mappedStatus = 'connecting';

    let rawPhone = data.phone || data.user?.phone || data.user?.id?.split('@')[0]?.split(':')[0] || data.accountJid?.split('@')[0]?.split(':')[0] || null;
    if (rawPhone && !rawPhone.startsWith('+')) rawPhone = `+${rawPhone}`;

    const pushName = data.pushName || data.name || data.user?.name || null;

    return {
      connected: isConn,
      status: mappedStatus,
      phone: isConn ? rawPhone : null,
      pushName: isConn ? pushName : null,
      platform: data.platform || null,
      qrCode: data.qrDataUrl || data.qr || null,
      uptime: data.connectedAt ? Math.floor((Date.now() - data.connectedAt) / 1000) : (data.updatedAt ? Math.floor((Date.now() - data.updatedAt) / 1000) : null),
    };
  } catch {
    return {
      connected: false,
      status: 'disconnected',
    };
  }
}

export async function deleteStreamMessages(): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/messages/delete`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function simulatePing(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface BackendNewsItem {
  id: string;
  message_id: string;
  category: string;
  headline: string;
  affected_countries: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  raw_text?: string;
  created_at: number;
}

export async function fetchNews(limit = 100): Promise<BackendNewsItem[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/news?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch news`);
    const data = await res.json();
    return Array.isArray(data.news) ? data.news : [];
  } catch (err) {
    console.error('Failed to fetch market news:', err);
    return [];
  }
}

export interface BackendVendorItem {
  id: string;
  name: string;
  company: string;
  phone: string;
  country: string;
  offersCount: number;
  lastSeen: string;
  verified: boolean;
  routes?: Array<{
    country: string;
    route_type: string;
    billing_pulse?: string;
    rate_per_min?: number;
    intent?: string;
  }>;
}

export async function triggerTelecomReparse(): Promise<{ status: string; parsedCount?: number }> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/telecom/reparse`, { method: 'POST' });
    if (!res.ok) throw new Error('Reparse failed');
    return await res.json();
  } catch {
    return { status: 'error' };
  }
}

export interface CreateVendorPayload {
  name: string;
  phone: string;
  company?: string;
  country?: string;
  destination?: string;
  route_type?: string;
  rate_per_min?: number;
  billing_pulse?: string;
  notes?: string;
}

export async function fetchVendors(): Promise<BackendVendorItem[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/vendors`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch vendors`);
    const data = await res.json();
    return Array.isArray(data.vendors) ? data.vendors : [];
  } catch (err) {
    console.error('Failed to fetch carriers and contacts:', err);
    return [];
  }
}

export async function deleteVendor(phone: string): Promise<boolean> {
  try {
    const encoded = encodeURIComponent(phone);
    const res = await authenticatedFetch(`${API_BASE}/vendors?phone=${encoded}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.error('Failed to delete vendor:', err);
    return false;
  }
}

export async function deleteAllVendors(): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/vendors`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.error('Failed to delete all vendors:', err);
    return false;
  }
}

export async function createVendor(payload: CreateVendorPayload): Promise<BackendVendorItem | null> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.vendor || null;
  } catch (err) {
    console.error('Failed to create carrier entity:', err);
    return null;
  }
}

export interface BackendRouteItem {
  id: string;
  vendor_name: string;
  vendor_phone: string;
  company_name?: string;
  country: string;
  route_type: string;
  billing_pulse?: string;
  rate_per_min: number;
  ani_pass?: string;
  quality_notes?: string;
  fas_free?: number | boolean;
  intent?: string;
  raw_text?: string;
  created_at?: number;
  fraud_risk_level?: string;
  fraud_badge?: string;
  is_best_trusted_price?: boolean;
  active_news?: {
    category: string;
    urgency: string;
    headline: string;
    raw_text?: string;
  } | null;
}

export async function fetchRoutes(): Promise<{ total: number; routes: BackendRouteItem[] }> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/routes?limit=200`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch routes`);
    const data = await res.json();
    return {
      total: data.total || (Array.isArray(data.routes) ? data.routes.length : 0),
      routes: Array.isArray(data.routes) ? data.routes : [],
    };
  } catch (err) {
    console.error('Failed to fetch routes:', err);
    return { total: 0, routes: [] };
  }
}

export interface SidebarCounts {
  routes: number;
  news: number;
  vendors: number;
}

export async function fetchSidebarCounts(): Promise<SidebarCounts> {
  try {
    const [newsRes, routesRes, vendorsRes] = await Promise.allSettled([
      authenticatedFetch(`${API_BASE}/news?limit=200`),
      authenticatedFetch(`${API_BASE}/routes?limit=1`),
      authenticatedFetch(`${API_BASE}/vendors`),
    ]);

    let news = 0;
    if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
      const data = await newsRes.value.json();
      news = Array.isArray(data.news) ? data.news.length : (data.total || 0);
    }

    let routes = 0;
    if (routesRes.status === 'fulfilled' && routesRes.value.ok) {
      const data = await routesRes.value.json();
      routes = data.total || (data.stats?.total) || (Array.isArray(data.routes) ? data.routes.length : 0);
    }

    let vendors = 0;
    if (vendorsRes.status === 'fulfilled' && vendorsRes.value.ok) {
      const data = await vendorsRes.value.json();
      vendors = Array.isArray(data.vendors) ? data.vendors.length : (data.count || 0);
    }

    return { routes, news, vendors };
  } catch (err) {
    console.error('Failed to fetch sidebar counts:', err);
    return { routes: 0, news: 0, vendors: 0 };
  }
}

export interface AccountItem {
  id: string;
  label: string;
  isDefault: boolean;
  phone?: string;
  status?: string;
}

export interface FleetAccountStatus {
  accountId: string;
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated';
  phone: string | null;
  name: string | null;
  platform: string | null;
  qr: string | null;
  sessionDir: string;
}

export async function fetchAccounts(): Promise<AccountItem[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/accounts`);
    if (!res.ok) return [{ id: 'default', label: 'Desk 1 (Primary)', isDefault: true }];
    const data = await res.json();
    return Array.isArray(data.accounts) ? data.accounts : [{ id: 'default', label: 'Desk 1 (Primary)', isDefault: true }];
  } catch {
    return [{ id: 'default', label: 'Desk 1 (Primary)', isDefault: true }];
  }
}

export async function fetchFleetStatus(): Promise<FleetAccountStatus[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/admin/fleet`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.fleet) ? data.fleet : [];
  } catch {
    return [];
  }
}

export async function provisionDesk(accountId: string): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/admin/desks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function restartDesk(accountId: string): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/admin/desks/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Settings, delete, and Diagnostics Client Methods
// ---------------------------------------------------------------------------

export interface SettingsStats {
  counts: {
    routes: number;
    aiTasks: number;
    news: number;
    vendors: number;
  };
  storage?: {
    disk?: {
      usedPercent: number;
      usedGb?: number;
      totalGb?: number;
    };
    media?: {
      totalFiles?: number;
      totalSizeMb: number;
    };
  };
}

export async function fetchSettingsStats(): Promise<SettingsStats | null> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/settings/stats`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchDmSettings(): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/settings/dms`);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.record_direct_messages);
  } catch {
    return false;
  }
}

export async function updateDmSettings(record_direct_messages: boolean): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/settings/dms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_direct_messages }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.record_direct_messages);
  } catch {
    return false;
  }
}

export async function updateTerminalPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/settings/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error || 'Password update failed' };
    }
    localStorage.setItem('wapp_token', newPassword);
    sessionStorage.setItem('wapp_token', newPassword);
    return { success: true, message: 'Terminal password updated successfully!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' };
  }
}

export async function unlinkWhatsAppSession(): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/session/reset`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function restartWhatsAppSession(): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/session/restart`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function wipeAccountAndAllData(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/account/wipe`, { method: 'POST' });
    const data = await res.json();
    return {
      success: res.ok && Boolean(data.success),
      message: data.message || 'WhatsApp account session and all data wiped successfully.',
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error while wiping account' };
  }
}

export async function clearData(
  target: 'routes' | 'analysis' | 'news' | 'all'
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/data/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error || 'Failed to clear data' };
    }
    return { success: true, message: data.message || 'Data cleared successfully' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' };
  }
}

export async function reseedRoutes(): Promise<{ success: boolean; seeded?: number; message?: string }> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/routes/seed`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error || 'Failed to reseed routes' };
    }
    return { success: true, seeded: data.seeded || 21 };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' };
  }
}

export async function deleteMediaFiles(
  percentage: 80 | 100
): Promise<{ success: boolean; deletedCount?: number; freedMb?: number; message?: string }> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/storage/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentage }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error || 'Failed to delete media' };
    }
    return { success: true, deletedCount: data.deletedCount, freedMb: data.freedMb };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' };
  }
}

export async function runStorageRetention(
  days = 30
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/storage/retention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error || 'Failed to run retention cleanup' };
    }
    return { success: true, message: data.message || 'Retention cleanup completed' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' };
  }
}

export interface RetentionSettings {
  retentionDays: number;
  totalMessages: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}

export async function fetchRetentionSettings(): Promise<RetentionSettings> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/settings/retention`);
    if (!res.ok) return { retentionDays: 180, totalMessages: 0, oldestTimestamp: null, newestTimestamp: null };
    return await res.json();
  } catch {
    return { retentionDays: 180, totalMessages: 0, oldestTimestamp: null, newestTimestamp: null };
  }
}

export async function updateRetentionSettings(retentionDays: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/settings/retention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays }),
    });
    const data = await res.json();
    return { success: res.ok, message: data.message || 'Retention policy updated successfully' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' };
  }
}

export async function pruneMessagesPercentage(
  percentage: number
): Promise<{ success: boolean; deletedCount?: number; remainingCount?: number; message?: string }> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/storage/prune-percentage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentage }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error || 'Failed to delete messages' };
    }
    return {
      success: true,
      deletedCount: data.deletedCount,
      remainingCount: data.remainingCount,
      message: data.message || 'Deletion complete',
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' };
  }
}

export interface ArbitrageOpportunity {
  country: string;
  route_type: string;
  sell_rate: number;
  seller_name: string;
  seller_phone: string;
  seller_company?: string;
  sell_pulse?: string;
  buy_rate: number;
  buyer_name: string;
  buyer_phone: string;
  buyer_company?: string;
  buy_pulse?: string;
  spread: number;
  marginPercent: number;
  isProfitable: boolean;
}

export async function fetchArbitrage(): Promise<ArbitrageOpportunity[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/arbitrage`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.opportunities) ? data.opportunities : [];
  } catch (err) {
    console.error('Failed to fetch arbitrage:', err);
    return [];
  }
}

export interface TradePitchItem {
  title: string;
  strategy: string;
  text: string;
}

export async function requestAiTradePitch(params: {
  destination: string;
  currentRate?: string;
  targetRate?: string;
  volume?: string;
  routeType?: string;
  vendorName?: string;
  vendorPhone?: string;
}): Promise<TradePitchItem[]> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/insights/pitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.pitches) ? data.pitches : [];
  } catch (err) {
    console.error('Failed to generate trade pitch:', err);
    return [];
  }
}

export interface InsightsSummary {
  totalRoutes: number;
  totalCountries: number;
  totalVendors: number;
  urgentNews: number;
}

export async function fetchInsightsData(): Promise<{
  summary: InsightsSummary;
  arbitrageOpportunities: any[];
} | null> {
  try {
    const res = await authenticatedFetch(`${API_BASE}/insights`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
