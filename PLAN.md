# Architecture & Implementation Plan: Dedicated Carrier Dossier Page (`/vendors/:slug`)

**Document Version:** 1.0.0  
**Status:** Ready for Review  
**Target URL:** `/vendors/:vendorSlug`  
**Architecture Pattern:** React Router View + Express REST API + Local SQLite

---

## 1. System Architecture & Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CARRIERS DIRECTORY (/vendors)                   │
│                                                                        │
│ [Row / Name / Avatar] ───► Click ──┐                                   │
│ [25 Offers Badge]     ───► Click ──┼──► Navigate: /vendors/:slug       │
│ [Actions Menu Dropdown] ─► Click ──┘                                   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   DEDICATED CARRIER DOSSIER PAGE                       │
│                        (/vendors/:vendorSlug)                          │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Header & Navigation:                                                │
│    • [← Back to Carriers Directory]                                    │
│    • Breadcrumb: Carriers > Echolink Tel Ltd                           │
│                                                                        │
│ 2. Carrier Profile Hero:                                               │
│    • Name + Company Desk + Origin Country + Verification Badge         │
│    • Quick Actions: [Knock WhatsApp] [Copy Phone] [Edit Carrier]       │
│                                                                        │
│ 3. KPI Metric Cards (4 tiles):                                         │
│    • Total Offers (25) | 🟢 Sell (20) | 🔵 Buy (5) | Active Regions   │
│                                                                        │
│ 4. Dedicated Offers Matrix Table:                                      │
│    • Intent Tabs: [All Offers] [🟢 Sell/Avail] [🔵 Buy/Need]          │
│    • Instant Search Filter (Destination, Quality, Pulse)               │
│    • Sorting: Rate ($/min) & Recency (Timestamp)                       │
│    • Row Action: 1-Click "Knock Rate" with pre-filled WhatsApp pitch   │
│                                                                        │
│ 5. Raw WhatsApp Broadcast Logs (Collapsible Feed):                     │
│    • Last 10 raw messages captured from this vendor                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Architecture Changes

### 2.1 Service Layer: `backend/src/telecom/vendors-service.js`
Create function `getVendorDetail(identifier)`:
1. Normalize identifier (strip non-digits for phone matching or sanitize slug for company/name matching).
2. Query `vendors` table for existing profile record (`phone`, `name`, `company`, `last_seen_at`).
3. Query `route_ticks` for all offers where `vendor_phone = ?` or `vendor_name = ?` ordered by `created_at DESC` (no artificial 5-route limit).
4. Query `messages` table for the last 10 messages received where `sender_jid` matches this vendor's phone or LID.
5. Compute live metrics:
   - `totalOffers`: total routes count.
   - `sellOffers`: routes where `intent = 'WTS'`.
   - `buyOffers`: routes where `intent = 'WTB'`.
   - `uniqueDestinations`: count of distinct countries.
   - `lastSeen`: latest timestamp across messages or route ticks.

### 2.2 Route Layer: `backend/src/server.js`
Add endpoint:
```http
GET /api/vendors/:identifier
```
- Returns `{ success: true, vendor: VendorDetailObject }`
- Returns HTTP 404 `{ success: false, error: 'Carrier not found' }` if identifier has no records in database.

---

## 3. Frontend Architecture Changes

### 3.1 Type Definitions: `frontend/src/types/vendor.ts`
Define complete vendor detail interface:
```typescript
export interface VendorRouteItem {
  id: string | number;
  country: string;
  route_type: string;
  billing_pulse: string;
  rate_per_min: number | null;
  currency?: string;
  intent: 'WTS' | 'WTB';
  created_at: number;
  raw_text?: string;
}

export interface VendorBroadcastMessage {
  id: string;
  message_text: string;
  timestamp: number;
  chat_name?: string;
}

export interface VendorDetail {
  id: string;
  name: string;
  company: string;
  phone: string;
  country: string;
  verified: boolean;
  lastSeen: string;
  totalOffers: number;
  sellOffers: number;
  buyOffers: number;
  destinationsCount: number;
  routes: VendorRouteItem[];
  recentMessages: VendorBroadcastMessage[];
}
```

### 3.2 API Client: `frontend/src/api/client.ts`
Implement `fetchVendorDetail(identifier: string): Promise<VendorDetail | null>`:
- Calls `GET /api/vendors/${identifier}`.
- Handles error boundaries and network retries gracefully.

### 3.3 New Dedicated View Component: `frontend/src/components/views/VendorDetailView.tsx`
Create a high-performance view with:
- **`useParams<{ vendorSlug: string }>()`**: extracts the carrier slug or phone from the URL.
- **Loading & Skeleton State**: clean pulse skeleton while fetching carrier details.
- **NotFound State**: informative empty card with button to return to Carriers Directory.
- **Filter & Search State**:
  - `activeIntent`: `'ALL' | 'WTS' | 'WTB'`
  - `searchTerm`: string (real-time filtering on destination and quality)
  - `sortBy`: `'rate_asc' | 'rate_desc' | 'date_desc' | 'country_asc'`
- **Pre-filled Knock Generator**:
  - Clicking "Knock Rate" opens WhatsApp:
    `https://wa.me/{phone}?text={encodedGreeting}`
    e.g.: *"Hi {name}, I saw your offer for {country} {quality} at ${rate}/min ({pulse}). Is this still active and can you share test IPs?"*

### 3.4 Directory Cross-Linking: `frontend/src/components/views/VendorsView.tsx`
- Wrap Carrier Name and Avatar in clickable container navigating to `/vendors/${getVendorSlug(vendor)}`.
- Wrap `Offers Volume` badge in clickable pill with hover highlight.
- In the **Actions** dropdown menu, add **"View Carrier Dossier & Offers"** at the top with a dedicated user icon.

### 3.5 Routing Dispatcher: `frontend/src/components/views/ViewDispatcher.tsx`
- Lazy-load `VendorDetailView` using `React.lazy`.
- Direct route `/vendors/:vendorSlug` to render `VendorDetailView`.
- Keep route `/vendors` rendering the main directory `VendorsView`.

---

## 4. Edge Cases & Resilience Strategy

1. **Carrier has No Company Name**:
   - System falls back gracefully to formatted phone number (e.g. `+880 1840-881187`) as slug and display title.
2. **Special Characters in Slug**:
   - Slug resolution uses sanitized slug matching (lowercased alphanumeric with dashes), or falls back to direct phone number matching.
3. **Vendor has 0 Active Routes**:
   - Renders a clean "No active route offers recorded yet" state with option to knock on WhatsApp or post a new route.
4. **Offline / Network Interruption**:
   - Displays retry button without crashing the application shell.

---

## 5. Verification & Testing Protocol

1. **Local Build Check**:
   - Run `npm run build --prefix frontend` to guarantee strict TypeScript compliance and zero lint errors.
2. **E2E Feature Validation**:
   - Navigate to `/vendors`.
   - Click `25 Offers` on `266855428161540 / Echolink Tel Ltd`.
   - Verify URL changes to `/vendors/echolink-tel-ltd` (or phone slug).
   - Verify all 25 offers render with rates, recorded timestamps, and intent badges.
   - Test intent filter tabs (`All`, `🟢 Sell`, `🔵 Buy`).
   - Test in-table search (type "Colombia").
   - Click `← Back to Carriers Directory` and ensure previous directory state is preserved.
3. **VPS Deployment**:
   - Commit and push to `origin/main`.
   - Deploy to VPS (`201.18.215.195`), build frontend, and verify live.
