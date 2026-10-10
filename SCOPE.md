# Feature Scope Specification: Dedicated Carrier Dossier Page (`/vendors/:slug`)

**Document Version:** 1.0.0  
**Status:** Proposed & Under Review  
**Target Feature:** Dedicated Wholesale Carrier Profile & Complete Offers Matrix  
**Module:** `frontend/src/components/views/VendorDetailView.tsx` & `backend/src/telecom/vendors-service.js`

---

## 1. Executive Summary & Objective

The objective of this feature is to provide wholesale telecom account managers and traders with a dedicated, deep-linkable **Carrier Dossier & Profile Page** (`/vendors/:slug`). 

Currently, the Carriers Directory (`/vendors`) lists carriers with aggregated summary pills (such as `25 Offers`), but traders cannot view, filter, or analyze the full portfolio of routes belonging to a single vendor on one dedicated screen. This feature introduces a comprehensive profile page where all BUY and SELL route offers from a chosen carrier are isolated, searchable, sortable, and actionable via direct WhatsApp contact.

---

## 2. IN SCOPE

### 2.1 Frontend Routing & Deep Linking
- **URL Schema**: Dedicated URL route `/vendors/:vendorSlug` (e.g. `/vendors/echolink-tel-ltd` or `/vendors/dna-8801874819713`).
- **Deep-linking & Bookmarkability**: Direct navigation via browser URL loads the carrier profile immediately.
- **Breadcrumb Navigation**: Header link `← Back to Carriers Directory` to return smoothly to `/vendors`.
- **Directory Cross-Links**:
  - Clicking on Carrier Name or Avatar in `/vendors` navigates to `/vendors/:slug`.
  - Clicking on the `Offers Volume` badge (e.g., `25 Offers`) navigates directly to `/vendors/:slug`.
  - Adding `"View Carrier Dossier & Offers"` as the primary option in the table row **Actions** dropdown.

### 2.2 Carrier Profile Header & Contact Channels
- **Carrier Identity**:
  - Profile Avatar with name initials / color coding.
  - Contact Name (`DNA` / `avishekdevnath`) & Company Desk (`Echolink Tel Ltd`).
  - Origin Country with flag badge (`Bangladesh 🇧🇩`).
  - Verified Carrier badge for confirmed wholesale partners.
  - Last activity timestamp (`⏱️ Active 2h ago` with hover tooltip for exact date/time).
- **Direct Action Buttons**:
  - **Knock (WhatsApp)**: 1-click `wa.me/+...` launcher opening chat with the carrier.
  - **Copy Phone Number**: Copy to clipboard with instant confirmation toast/badge.
  - **Edit Carrier**: Trigger existing Edit modal to update company name, notes, or tags.

### 2.3 Volume & Trading KPI Summary Cards
Four high-contrast overview cards at the top of the dossier:
1. **Total Offers Volume**: Total count of active routes posted by this carrier (e.g., `25 Routes`).
2. **🟢 Sell / Available (WTS)**: Total routes the carrier is offering for sale.
3. **🔵 Buy / Need (WTB)**: Total routes the carrier is seeking to purchase.
4. **Active Destinations**: Count of distinct countries/regions in the carrier's portfolio.

### 2.4 Dedicated Carrier Route Matrix
- **Intent Filter Tabs**:
  - `All Offers (N)`
  - `🟢 Sell / Available (N)`
  - `🔵 Buy / Need (N)`
- **In-Table Real-Time Search**:
  - Filter down the carrier's routes by destination country (e.g. "Colombia"), route type ("CLI"), or pulse ("1/1").
- **Columns**:
  - **Destination**: Country flag + Country name + Region.
  - **Route Quality**: CLI, CC CLI, Non-CLI, IVR, etc.
  - **Pulse**: 1/1, 60/60, etc.
  - **Rate / Min & Recency**: Dual-line rate layout (`$0.0120 / min` + `⏱️ Recorded 2m ago`).
  - **Intent**: `🟢 SELL / AVAILABLE` or `🔵 BUY / NEED`.
  - **Actions**: "Knock Rate" button with pre-filled WhatsApp message referencing the exact destination and rate.
- **Sorting**:
  - By Rate (lowest to highest / highest to lowest).
  - By Recorded Time (newest first / oldest first).
  - By Destination (A to Z).

### 2.5 Recent Raw Broadcast Context
- Collapsible section showing the latest raw WhatsApp messages captured from this carrier's phone number.
- Allows traders to inspect payment terms (e.g., *USDT 7/1*, *Wire 15/1*), traffic requirements (*minimum 50 ports*), or original notes without leaving the dossier.

### 2.6 Backend API Support
- Dedicated REST API: `GET /api/vendors/:identifier` returning:
  - Full vendor metadata.
  - Complete list of routes from `route_ticks` where `vendor_phone = ?` (without the current 5-route cap).
  - Recent raw messages from `messages` table for this vendor's phone number.

---

## 3. OUT OF SCOPE

The following items are explicitly **excluded** to maintain system focus and reliability:

| Category | Out of Scope Item | Reason |
|---|---|---|
| **Outbound WhatsApp Automation** | Automated bot replies or spam broadcast campaigns. | Increases WhatsApp account ban risk; all messaging remains trader-initiated via native `wa.me` links. |
| **Third-Party CRM Integrations** | Syncing carriers to Salesforce, HubSpot, or Zoho. | Native SQLite storage handles all trading requirements with zero cloud dependencies. |
| **Switch & Billing Integration** | Live SIP interconnect provisioning, switch softswitch routing, CDR rating. | The collector is a market intelligence and trade negotiation terminal, not a billing softswitch. |
| **Directory Breaking Changes** | Removing or breaking existing table/card views in `/vendors`. | Existing `/vendors` directory remains fully intact; this feature is an additive deep-dive view. |

---

## 4. Non-Functional Requirements & Constraints

1. **Performance**: Vendor detail page must render in under 100ms using local SQLite indexes.
2. **Bundle Optimization**: Code-split `VendorDetailView` with `React.lazy` to keep the main bundle size small.
3. **Dual-Mode Theme Contrast**: Full WCAG AAA contrast in both Dark and Light modes.
4. **Resilience**: Gracefully handle missing carriers, deleted vendors, or carriers with 0 active routes without application errors.
