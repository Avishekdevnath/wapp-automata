import { getDb } from '../storage/db.js';

function detectCountry(phone = '') {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('1')) return 'USA / Canada 🇺🇸🇨🇦';
  if (clean.startsWith('44')) return 'United Kingdom 🇬🇧';
  if (clean.startsWith('880')) return 'Bangladesh 🇧🇩';
  if (clean.startsWith('91')) return 'India 🇮🇳';
  if (clean.startsWith('971')) return 'UAE 🇦🇪';
  if (clean.startsWith('65')) return 'Singapore 🇸🇬';
  if (clean.startsWith('852')) return 'Hong Kong 🇭🇰';
  if (clean.startsWith('61')) return 'Australia 🇦🇺';
  if (clean.startsWith('263')) return 'Zimbabwe 🇿🇼';
  if (clean.startsWith('20')) return 'Egypt 🇪🇬';
  if (clean.startsWith('49')) return 'Germany 🇩🇪';
  if (clean.startsWith('33')) return 'France 🇫🇷';
  if (clean.startsWith('86')) return 'China 🇨🇳';
  if (clean.startsWith('966')) return 'Saudi Arabia 🇸🇦';
  if (clean.startsWith('234')) return 'Nigeria 🇳🇬';
  if (clean.startsWith('27')) return 'South Africa 🇿🇦';
  return 'International 🌐';
}

export function getVendors() {
  const db = getDb();
  const vendorsMap = new Map();

  // 1. Read existing registered vendors
  const dbVendors = db.prepare('SELECT phone, name, company, total_offers, last_seen_at FROM vendors').all();
  for (const v of dbVendors) {
    if (!v.phone) continue;
    const cleanPhone = v.phone.trim();
    vendorsMap.set(cleanPhone, {
      id: 'v_' + cleanPhone.replace(/\D/g, ''),
      name: v.name && !v.name.startsWith('LID:') && !v.name.startsWith('+') ? v.name : cleanPhone,
      company: v.company || '',
      phone: cleanPhone,
      country: detectCountry(cleanPhone),
      offersCount: v.total_offers || 0,
      lastSeen: new Date(v.last_seen_at || Date.now()).toISOString(),
      verified: Boolean(v.company && v.company.length > 2) || (v.total_offers || 0) >= 2,
      routes: []
    });
  }

  // 2. Query routes to calculate real active offers
  const routeRows = db.prepare(`
    SELECT vendor_phone, vendor_name, company_name, country, route_type, billing_pulse, rate_per_min, intent, created_at
    FROM route_ticks
    WHERE vendor_phone IS NOT NULL AND vendor_phone != '' AND vendor_phone != 'unknown'
    ORDER BY created_at DESC
  `).all();

  for (const r of routeRows) {
    const p = r.vendor_phone.trim();
    let v = vendorsMap.get(p);
    if (!v) {
      v = {
        id: 'v_' + p.replace(/\D/g, ''),
        name: r.vendor_name || p,
        company: r.company_name || '',
        phone: p,
        country: detectCountry(p),
        offersCount: 0,
        lastSeen: new Date(r.created_at || Date.now()).toISOString(),
        verified: Boolean(r.company_name),
        routes: []
      };
      vendorsMap.set(p, v);
    }

    v.offersCount = (v.offersCount || 0) + 1;
    if (v.routes.length < 5) {
      v.routes.push({
        country: r.country,
        route_type: r.route_type,
        billing_pulse: r.billing_pulse || '1/1',
        rate_per_min: r.rate_per_min,
        intent: r.intent || 'WTS'
      });
    }
  }

  const result = Array.from(vendorsMap.values());
  result.sort((a, b) => (b.offersCount || 0) - (a.offersCount || 0));

  return {
    count: result.length,
    vendors: result
  };
}

export function createVendor(data) {
  const db = getDb();
  if (!data.phone || !data.name) {
    throw new Error('Phone and name are required');
  }

  const cleanPhone = data.phone.trim();
  const now = Date.now();

  db.prepare(`
    INSERT INTO vendors (phone, name, company, total_offers, last_seen_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(phone) DO UPDATE SET
      name = excluded.name,
      company = COALESCE(excluded.company, vendors.company),
      last_seen_at = excluded.last_seen_at
  `).run(cleanPhone, data.name, data.company || null, now);

  return {
    id: 'v_' + cleanPhone.replace(/\D/g, ''),
    phone: cleanPhone,
    name: data.name,
    company: data.company || '',
    country: detectCountry(cleanPhone),
    offersCount: 1,
    lastSeen: new Date(now).toISOString(),
    verified: true,
    routes: []
  };
}

export function deleteVendor(phone) {
  const db = getDb();
  if (!phone) {
    const info = db.prepare('DELETE FROM vendors').run();
    return info.changes > 0;
  }
  const cleanPhone = phone.trim();
  const info = db.prepare('DELETE FROM vendors WHERE phone = ?').run(cleanPhone);
  return info.changes > 0;
}
