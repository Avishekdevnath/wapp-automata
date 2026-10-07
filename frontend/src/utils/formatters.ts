import type { WhatsAppMessage } from '../types/message';

export function parseDate(val?: string | number | null): Date | null {
  if (!val) return null;
  if (typeof val === 'number') {
    const ms = val > 1e11 ? val : val * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const clean = val.trim();
    if (!clean) return null;
    // Epoch in digits
    if (/^\d+$/.test(clean)) {
      const num = Number(clean);
      const ms = num > 1e11 ? num : num * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatTime(timestamp?: string | number | null): string {
  if (!timestamp) return '--:--';
  const d = parseDate(timestamp);
  if (d) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  return typeof timestamp === 'string' ? timestamp : '--:--';
}

export function formatDate(timestamp?: string | number | null): string {
  if (!timestamp) return '';
  const d = parseDate(timestamp);
  if (d) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return '';
}

export function getMessageTimestamp(m: WhatsAppMessage): number {
  const d = parseDate(
    m.occurred_at ||
    (m.raw_envelope as any)?.occurred_at ||
    (m.raw_envelope as any)?.received_at ||
    (m.raw_envelope?.message?.raw_payload as any)?.messageTimestamp ||
    (m as any).headers?.['x-collector-timestamp'] ||
    m.timestamp
  );
  return d ? d.getTime() : 0;
}

export function cleanPhone(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

export function getInitials(nameOrPhone?: string | null): string {
  if (!nameOrPhone) return 'WA';
  const clean = nameOrPhone.trim();
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

const GRADIENTS = [
  'from-emerald-600 to-teal-800',
  'from-sky-600 to-blue-800',
  'from-indigo-600 to-violet-800',
  'from-amber-600 to-orange-800',
  'from-rose-600 to-pink-800',
  'from-teal-600 to-cyan-800',
];

export function getAvatarGradient(idStr?: string | null): string {
  if (!idStr) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}
