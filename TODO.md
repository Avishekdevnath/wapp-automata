# WappAutomata Development Task Tracker (TODO)

Tracking implementation tasks for frontend visual fidelity, modularity, and telecom trading workflows.

---

## Active Sprint: Dedicated Carrier Dossier & Complete Offers Matrix (`/vendors/:slug`)

- [x] **Phase 1: Backend Data API for Carrier Dossier**
  - [x] 1.1 In `backend/src/telecom/vendors-service.js`, implement `getVendorDetail(identifier)` to query all routes without limits, calculate buy/sell metrics, and pull recent message broadcasts.
  - [x] 1.2 In `backend/src/server.js`, register `GET /api/vendors/:identifier` route.
  - [x] 1.3 Validate API response on server via curl testing both phone number and name slugs.

- [x] **Phase 2: Frontend API Client & Type Definitions**
  - [x] 2.1 In `frontend/src/types/vendor.ts` & `client.ts`, define `VendorDetailItem`, `VendorRouteOffer`, and `VendorBroadcastMessage` interfaces.
  - [x] 2.2 In `frontend/src/api/client.ts`, implement `fetchVendorDetail(identifier: string)`.

- [x] **Phase 3: Dedicated Carrier Dossier Component (`VendorDetailView.tsx`)**
  - [x] 3.1 Create `frontend/src/components/views/VendorDetailView.tsx` with header breadcrumb `← Back to Carriers Directory`.
  - [x] 3.2 Build Carrier Profile Hero card with avatar, contact name, company desk, country badge, direct WhatsApp Knock, and Copy Phone.
  - [x] 3.3 Build 4 KPI Summary Cards: Total Offers, 🟢 Sell / Available, 🔵 Buy / Need, and Active Destinations.
  - [x] 3.4 Build Dedicated Route Offers Table with Intent Tabs (`All`, `🟢 Sell / Available`, `🔵 Buy / Need`), search bar, dual Rate/Time columns (`$0.0120/min • ⏱️ 2m ago`), and 1-click "Knock Rate" WhatsApp action.
  - [x] 3.5 Build Collapsible Recent Raw Broadcasts feed showing original WhatsApp message pitches for this carrier.
  - [x] 3.6 Implement loading pulse skeletons and graceful 404 / empty states.

- [x] **Phase 4: Directory Cross-Linking & Router Integration**
  - [x] 4.1 In `frontend/src/components/views/ViewDispatcher.tsx`, lazy-load `VendorDetailView` and bind to `/vendors/:vendorSlug`.
  - [x] 4.2 In `frontend/src/components/views/VendorsView.tsx`, link Carrier Name, Avatar, and `Offers Volume` badge to navigate to `/vendors/:slug`.
  - [x] 4.3 In `frontend/src/components/views/VendorsView.tsx`, add `"View Carrier Dossier & Offers"` as the primary action in the table row Actions dropdown menu.

- [ ] **Phase 5: Verification, Quality Gate & Deployment**
  - [x] 5.1 Execute local build verification: `npm.cmd run build --prefix frontend`.
  - [ ] 5.2 Verify deep linking, search, intent filtering, knock action, and back navigation.
  - [ ] 5.3 Commit changes, push to `origin/main`, deploy to VPS (`201.18.215.195`), and verify live.

---

## Completed Tasks Archive

- [x] **Task 1: Modal Geometry & Responsive Width Standard**
  - [x] Update `RouteDetailModal.tsx` and `MessageDetailModal.tsx` geometry and key-value layouts.
- [x] **Task 2: Top 3 Route Pricing Tier Ranking (Gold, Silver, Bronze)**
  - [x] Dynamic lowest 3 price ranking engine across active filtered routes with 🥇 #1 Floor, 🥈 #2 Rate, 🥉 #3 Rate badges.
- [x] **Task 3: Flashing Beacon & Pulsating Radar Incident Alerts**
  - [x] Dual-ring radar ping alerts for High-Impact incident cards and routes.
- [x] **Task 4: Typography & Dual-Mode Contrast Engine Polish**
  - [x] Full WCAG AAA contrast across dark and light modes.
- [x] **Task 5: Table Scroll Isolation & Pinned Viewport Headers**
  - [x] Sticky table headers and isolated vertical scroll containers.
- [x] **Task 6: WhatsApp Profile Name Display Fix**
  - [x] Fixed `WhatsAppConnectionCard.tsx` to read `deviceStatus.pushName` instead of `deviceStatus.platform`, displaying `DNA` correctly.
- [x] **Task 7: Trade Intent (Buy/Sell) Matrix Filtering & Badges**
  - [x] Added `WTS` vs `WTB` intent badges, intent tab switching, and dual rate/time sorting in Route Matrix.
- [x] **Task 8: Hidable AI Trade Negotiation Pitch Generator**
  - [x] Added toggle switch in Settings to show/hide AI Pitch Generator based on trader preference.
