# WappAutomata Frontend Polish & E2E Parity TODO

Tracking implementation tasks for frontend visual fidelity, modularity, and feature parity with the legacy terminal.

---

## Task List

- [x] **Task 1: Modal Geometry & Responsive Width Standard**
  - [x] Update `frontend/src/components/modals/RouteDetailModal.tsx` to use disciplined compact geometry (`max-w-lg w-full`), eliminating horizontal expansion.
  - [x] Refactor `RouteDetailModal` internals into an ergonomic 2-column key-value layout with clear hierarchy and centered actions.
  - [x] Verify `frontend/src/components/modals/MessageDetailModal.tsx` container width (`max-w-xl w-full`).
  - [x] Update `frontend/src/css/components/modals.css` to prevent unrestrained full-screen stretching on wide desktop monitors.

- [x] **Task 2: Top 3 Route Pricing Tier Ranking (Gold, Silver, Bronze)**
  - [x] In `frontend/src/components/views/RoutesView.tsx`, implement dynamic lowest 3 price ranking engine across active filtered routes.
  - [x] Add Rank 1 Gold highlight: `text-amber-500 dark:text-amber-400 font-extrabold`, `bg-amber-500/15 border-amber-500/40`, and `🥇 #1 Floor` badge.
  - [x] Add Rank 2 Silver highlight: `text-slate-600 dark:text-slate-200 font-bold`, `bg-slate-500/10 border-slate-400/30`, and `🥈 #2 Rate` badge.
  - [x] Add Rank 3 Bronze highlight: `text-orange-600 dark:text-orange-400 font-bold`, `bg-orange-500/10 border-orange-500/30`, and `🥉 #3 Rate` badge.
  - [x] Keep standard routes in clean `text-emerald-600 dark:text-emerald-400` font-mono.

- [x] **Task 3: Flashing Beacon & Pulsating Radar Incident Alerts**
  - [x] In `frontend/src/components/views/NewsView.tsx`, add dual-ring radar ping (`animate-ping` + `animate-pulse`) for High-Impact incident cards.
  - [x] Add pulsating alert badge (`bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse`) to critical outages and fiber cuts.
  - [x] Add pulsating incident warning pills on affected route destinations in `frontend/src/components/views/RoutesView.tsx`.

- [x] **Task 4: Typography & Dual-Mode Contrast Engine Polish**
  - [x] In `frontend/src/css/typography.css`, remove blanket `!important` text color overrides that wash out deliberate dark elements in light mode.
  - [x] Ensure full WCAG AAA legibility for all badges, buttons, and headers across both light and dark themes.

- [x] **Task 5: Table Scroll Isolation & Pinned Viewport Headers**
  - [x] Ensure table headers and search/filter toolbars remain sticky/pinned (`sticky top-0 z-10`).
  - [x] Ensure only the table body rows scroll smoothly (`overflow-y-auto`).
  - [x] Verify 10, 25, 50 pagination displays fit comfortably within standard viewport heights.

- [x] **Task 6: Production Build, Graph Map & Decision Log Verification**
  - [x] Execute `npm run build` in `frontend/` to compile clean production assets to `frontend/dist/`.
  - [x] Update `frontend/GRAPH_MAP.md` and `brain/10_decisions/decision-log.md`.
  - [x] Verify functionality and visual appearance on both `http://localhost:5173/` and `http://localhost:4000/`.

- [x] **Task 7: Universal Hand Cursor (`cursor: pointer`) on Hover for Clickable Elements**
  - [x] Added global CSS reset enforcing `cursor: pointer !important;` for all `button`, `[role="button"]`, `select`, `summary`, `a[href]`, and `.cursor-pointer` elements across `index.css`, `base.css`, and `buttons.css`.
  - [x] Added `cursor: not-allowed !important;` for disabled buttons and inputs.
  - [x] Explicitly attached `cursor-pointer` to page size selector pills (10, 25, 50, 100, All) and pagination Prev/Next controls in `StreamPaginationBar.tsx`.

- [x] **Task 8: High-Scale Scrollable Telecom News Feed with Priority & Recency Engine (`#/news`)**
  - [x] Expanded `BENCHMARK_NEWS` in `scripts/benchmark-data.js` to 18 authentic global carrier advisories (subsea fiber cuts, BTRC verifications, FCC STIR/SHAKEN, FAS warnings, etc.) with realistic time offsets.
  - [x] Updated `scripts/server/market-api.js` (`GET /api/news`) with configurable limit parameter (up to 500) and seeded SQLite `market_news` table.
  - [x] Added `BackendNewsItem` interface and `fetchNews()` method to `frontend/src/api/client.ts`.
  - [x] Re-architected `frontend/src/components/views/NewsView.tsx`:
    - [x] Dedicated internal scroll container (`max-h-[640px] overflow-y-auto pr-1`) isolating feed scrolling from page header and layout.
    - [x] Priority & Recency sorting algorithm: `HIGH` urgency alerts always lead at the top, ordered strictly by newest timestamps within each urgency group.
    - [x] Interactive sort options: Priority & Recency (Default), Newest First (Chronological), High Priority Only, Oldest First.
    - [x] Instant full-text search across headlines, affected countries, raw advisories, and categories.
    - [x] Category filter pills with live item count counters (`ALL`, `OUTAGE`, `MAINTENANCE`, `REGULATION`, `FRAUD`, `INFRASTRUCTURE`).
    - [x] Pulsating radar beacon pings (`animate-ping` + `animate-pulse`) and glowing borders for `HIGH` urgency incidents.
    - [x] Collapsible AI Executive Risk Briefing card with dynamic threat scoring.
    - [x] Pinned pagination bar with per-page selectors (6, 12, 24, All), page navigation, and universal hand cursor.
    - [x] One-click "Copy Alert" action with clipboard feedback and expandable dispatch text.


