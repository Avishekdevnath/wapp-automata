/**
 * URL Slugging & Bidirectional Deep-Link Resolution Utilities
 * Telecom & Market Entities (Routes, Carriers, News Advisories, Messages)
 */

/**
 * Transforms an arbitrary string into a clean, URL-safe slug.
 * Example: "Red Sea Subsea Cable Cut (SMW4/AAE-1)" -> "red-sea-subsea-cable-cut-smw4-aae-1"
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '') // Strip diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove invalid chars
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphen
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
}

/**
 * Computes a human-readable slug for a wholesale route corridor.
 * Example: "colombia-ivr-mateo-ortiz"
 */
export function getRouteSlug(route: {
  id: string;
  destination?: string;
  type?: string;
  vendor?: string;
}): string {
  const parts = [
    route.destination || '',
    route.type || '',
    route.vendor || ''
  ].filter(Boolean);
  const base = slugify(parts.join(' '));
  return base || route.id;
}

/**
 * Matches an incoming URL slug against a Route record.
 * Supports exact ID match, direct slug match, or partial prefix match.
 */
export function matchesRouteSlug(
  route: { id: string; destination?: string; type?: string; vendor?: string },
  slug: string
): boolean {
  if (!slug) return false;
  const target = slug.toLowerCase().trim();
  if (route.id.toLowerCase() === target) return true;
  const computed = getRouteSlug(route);
  if (computed === target) return true;
  // Also match on destination slug directly (e.g. /routes/bangladesh-mobile)
  if (route.destination && slugify(route.destination) === target) return true;
  return false;
}

/**
 * Computes a human-readable slug for a Carrier / Account Manager.
 * Example: "apex-telecom-global" or fallback to raw phone "447700900142"
 */
export function getVendorSlug(vendor: {
  id: string;
  company?: string;
  name?: string;
  phone: string;
}): string {
  if (vendor.company && vendor.company !== 'Direct Conversation' && vendor.company !== 'Carrier Interconnect Desk') {
    const slug = slugify(vendor.company);
    if (slug) return slug;
  }
  if (vendor.name && !vendor.name.startsWith('+') && !vendor.name.startsWith('LID:')) {
    const slug = slugify(vendor.name);
    if (slug) return slug;
  }
  // Phone digits fallback
  return vendor.phone.replace(/\D/g, '') || vendor.id;
}

/**
 * Matches an incoming URL slug against a Carrier record.
 */
export function matchesVendorSlug(
  vendor: { id: string; company?: string; name?: string; phone: string },
  slug: string
): boolean {
  if (!slug) return false;
  const target = slug.toLowerCase().trim();
  if (vendor.id.toLowerCase() === target) return true;
  const rawPhone = vendor.phone.replace(/\D/g, '');
  if (rawPhone && (target === rawPhone || target === `+${rawPhone}`)) return true;
  if (getVendorSlug(vendor) === target) return true;
  if (vendor.company && slugify(vendor.company) === target) return true;
  if (vendor.name && slugify(vendor.name) === target) return true;
  return false;
}

/**
 * Computes a human-readable slug for a Telecom Incident bulletin.
 * Example: "red-sea-subsea-cable-cut"
 */
export function getNewsSlug(news: { id: string; headline: string }): string {
  const base = slugify(news.headline);
  if (base) {
    // Keep to max 60 chars for concise URLs
    return base.slice(0, 60).replace(/-+$/, '');
  }
  return news.id;
}

/**
 * Matches an incoming URL slug against a News Advisory record.
 */
export function matchesNewsSlug(
  news: { id: string; headline: string },
  slug: string
): boolean {
  if (!slug) return false;
  const target = slug.toLowerCase().trim();
  if (news.id.toLowerCase() === target) return true;
  const computed = getNewsSlug(news);
  if (computed === target) return true;
  if (slugify(news.headline).startsWith(target) || target.startsWith(computed)) return true;
  return false;
}
