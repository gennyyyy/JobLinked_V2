# Frontend Performance & Loading-State Plan

**Goal:** Make the app feel instant on every navigation: no layout-breaking full-page spinner, visible skeleton placeholders that match the content they replace, and measurable bundle/runtime improvements.

**Scope:** Vite + React frontend at the repo root. No backend, database, or route changes. No visual redesign — skeletons reuse the existing `Skeleton` primitive and the current card/table/panel layout.

**Baseline (measured 2026-11-04, `npm run build`):**

| Chunk | Raw | Gzip |
|---|---|---|
| `lib` (vendor) | 308.12 kB | 95.11 kB |
| `index` (app shell) | 240.62 kB | 74.26 kB |
| `supabase` | 214.33 kB | 55.09 kB |
| `EmploymentCharts` (recharts) | 423.51 kB | 119.41 kB |
| `pdf` (pdfjs, lazy) | 430.88 kB | 129.37 kB |
| `TopNavLayout` (portal shell) | 90.84 kB | 31.48 kB |
| route chunks | 8–31 kB each | 3–9 kB each |

Other facts:
- Route-level `React.lazy` is already in place in `src/App.jsx`.
- `Skeleton` primitive exists at `src/components/ui/skeleton.jsx` and is unused.
- 25+ data pages return a full-page `LoadingScreen` spinner while fetching.
- `BrowseJobs` shows a spinner box instead of job-card skeletons.
- `TopNavLayout` re-fetches notifications (and admin stats) on every `pathname` change.
- No image uses `loading="lazy"` / `decoding="async"`.
- Recharts loads immediately on the admin dashboard/reports routes.

---

## Phase 0 — Instrument before changing

- Add `web-vitals` (small, standard) and report LCP/INP/CLS to `console.info` in dev and a `data-*` hook for future analytics. Keep it dev-only to avoid a production cost.
- Add `rollup-plugin-visualizer` as a dev-only script `npm run analyze` (opens `dist/stats.html`). Do not add it to the normal build.
- Record Lighthouse (mobile + desktop) for `/`, `/jobs`, `/login`, `/super-admin`, `/employer`, `/job-seeker` after a real login.

**Acceptance:** a baseline table of LCP/CLS/INP + the two largest chunks, committed to this file.

---

## Phase 1 — Shared skeleton system (the main ask)

### 1.1 New file: `src/shared/components/Skeletons.jsx`

One small module, no abstraction layers. Variants:

| Export | Shape it stands in for | Used by |
|---|---|---|
| `JobCardSkeleton` | one job card (logo circle, title line, meta line, salary line, tag pills) | `BrowseJobs`, public jobs, job-seeker jobs |
| `JobListSkeleton` | 3–5 `JobCardSkeleton` rows | same |
| `StatCardSkeleton` | one `StatCards` tile (label line + big value line) | dashboards, reports |
| `PanelSkeleton` | `Panel` header + 3–4 text lines | dashboards, settings, notifications |
| `TableSkeleton` | header row + 5 body rows | employer/admin tables |
| `PageSkeleton` | page heading (eyebrow/title/description) + stat row + panel | route-level data pages |

Implementation rules:
- Use the existing `Skeleton` primitive (`animate-pulse`) — no new animation dependency.
- Every skeleton root gets `aria-busy="true"` and an `sr-only` `role="status"` label (e.g. “Loading jobs…”).
- Respect `prefers-reduced-motion`: wrap the pulse in `motion-safe:animate-pulse` (or add a media query in `index.css` that disables the animation).
- Do **not** use `min-h-screen`; skeletons occupy the same box as the final content so the page never jumps (CLS).

### 1.2 Replace full-page spinners on data pages

Keep `LoadingScreen` only for:
- `App.jsx` `Suspense` fallback (route chunk load)
- `ProtectedRoute` auth boot
- `AuthProvider` initial session resolution

Replace `if (loading) return <LoadingScreen />` with the matching skeleton **inside the page layout**:

| Page | Skeleton |
|---|---|
| `BrowseJobs` (public + job-seeker) | `JobListSkeleton` |
| `PublicJobDetail` | `PageSkeleton` (header + two-column detail) |
| job-seeker Dashboard | `PageSkeleton` + `StatCardSkeleton` + `PanelSkeleton` |
| job-seeker Applications / Employment / Profile / JobDetail | `PageSkeleton` / `PanelSkeleton` |
| employer Dashboard | `StatCardSkeleton` + `PanelSkeleton` |
| employer JobPosts / Applicants / Employees / CompanyProfile / Accreditation | `TableSkeleton` or `PanelSkeleton` |
| super-admin Dashboard / Reports | `StatCardSkeleton` + `PanelSkeleton` |
| super-admin Users / Accreditation / JobPosts / Logs / Roles / Applications / Employment | `TableSkeleton` |
| `NotificationsPage` | `PanelSkeleton` rows |
| `Settings` (reference values) | inline `PanelSkeleton`, not `LoadingScreen` |
| `Broadcast` (list) | inline `PanelSkeleton` |

### 1.3 Job-card loading animation (explicit request)

In `BrowseJobs.jsx`, replace the spinner block with:
- `aria-busy="true"` region
- `JobListSkeleton` showing 4 cards
- a short “Loading jobs…” `sr-only` status

The skeleton card must mirror the real card’s geometry (`surface p-5`, logo 44px, two title lines, meta row, salary line, optional tag pills) so the list does not shift when data arrives.

**Acceptance:**
- No data page renders `min-h-screen` LoadingScreen after its route chunk has loaded.
- `Jobs.loading.test.jsx` updated to assert skeleton cards + `aria-busy` (not the spinner text).
- New `Skeletons.test.jsx` renders every variant and checks `aria-busy`/status labels.

---

## Phase 2 — Stop redundant data fetching

### 2.1 Portal shell

`TopNavLayout` currently runs `listNotifications` and `getStats` on every `pathname` change. Change to:
- Fetch once per signed-in user (`[user?.id, isAdmin]`).
- Refresh on the existing `NOTIFICATIONS_CHANGED` window event (already dispatched by `markRead`/`markAllRead`/`deleteNotification`) and on `visibilitychange` when the tab returns.
- Abort in-flight requests with `AbortController` on unmount.

**Acceptance:** navigating between portal pages triggers **zero** notification/stats requests; marking a notification read updates the sidebar badge without a full refetch.

### 2.2 In-flight GET dedupe (small, local)

In `src/shared/lib/api.js`, add a per-path in-flight promise map for `GET` only:
- Concurrent identical GETs share one request.
- Clear the entry when it settles.
- Do **not** cache results by default (avoid stale data); this only removes duplicate concurrent calls (e.g. `auth/me` from the provider and a page).
- Keep it opt-out for endpoints that must always be fresh.

**Acceptance:** on a cold portal load, `/api/auth/me` is called once, not twice; existing API tests still pass.

---

## Phase 3 — Bundle and code-splitting

### 3.1 Lazy-load charts

`EmploymentCharts` (recharts, 423 kB raw) is imported eagerly by the admin dashboard and reports. Change to `React.lazy` + `Suspense` with a `PanelSkeleton`:
- Stat cards and headings render first.
- The chart loads below the fold.
- Same for `BarangayVacancyChart` / `EmploymentTypeChart`.

**Acceptance:** `/super-admin` first interactive render no longer downloads the 423 kB chart chunk; the chunk loads only when the chart panel is about to render.

### 3.2 Prefetch route chunks on intent

Add a small helper:
- `prefetchRoute(importFn)` — call the lazy import once, memoized.
- Attach `onMouseEnter` / `onFocus` to public job links (`JobCard`, `PublicJobDetail` links) and primary portal nav items.

**Acceptance:** hovering “Browse jobs” / a job card starts the route chunk download; clicking renders without the `Suspense` fallback on a warm cache.

### 3.3 Manual vendor chunk sanity

- Confirm `lib` (308 kB) is mostly `@base-ui/react` + shared UI. If a single page-only primitive (e.g. `chart`/`dialog` stack) is in `lib`, move it into the route chunk by importing it only where used (the primitives already live under `src/components/ui`; check that `TopNavLayout` doesn’t drag chart/dialog code into every portal).
- Do not split vendor chunks by hand unless the visualizer shows a real win. Route-level splitting is already effective.

---

## Phase 4 — Images and fonts

- Hero/team images above the fold: add `fetchPriority="high"` + explicit `width`/`height` (already present on the Hero img) and preload the hero background in `index.html`.
- Below-the-fold images (company logos, placeholders): add `loading="lazy"` and `decoding="async"`.
- Keep the local Geist font + `display=swap`; add `preconnect` (already present).
- Replace remote Vercel blob logo URLs in `design.jsx` with local `src/assets` files if the remote host is ever unavailable (it currently resolves, but local removes a network dependency and 2 requests on every page).

**Acceptance:** Lighthouse “Serve images in modern formats” / “Properly size images” are clean or documented; no layout shift from images.

---

## Phase 5 — Render and interaction

- `TopNavLayout`: memoize the nav array and the sidebar render function; avoid recreating `results` on every keystroke unless the dialog is open.
- `BrowseJobs`: `useMemo` the filtered list and the derived job-card props; the page already paginates (10/page), so no virtualization.
- `Applications` / `Reports` (admin): `useMemo` the filtered arrays and per-report stats (the Reports page already computes on render; memoize the filtered/derived sets).
- Respect `prefers-reduced-motion` for `hero-enter`, `hero-float`, `animate-pulse`, and any new skeleton animation.
- Add `content-visibility: auto` only if a long non-paginated list appears; not needed for the current paginated tables.

---

## Phase 6 — Verification

1. `npm run lint` — 0 problems.
2. `npm test` — all existing tests + new skeleton/dedupe tests.
3. `npm run build` — chunk table compared to the Phase 0 baseline (no shared chunk regression > 10%; chart chunk no longer on the admin first load).
4. Lighthouse (mobile) on `/`, `/jobs`, `/login`, one portal:
   - LCP ≤ 2.5 s (lab, local API)
   - CLS ≤ 0.1
   - No “Avoid large layout shifts” / “Uses an excessive DOM size” regressions
5. Manual browser pass (headless Chrome is available):
   - `/jobs` shows skeleton cards, then cards, with no spinner and no layout jump.
   - Each portal page shows its layout skeleton instead of a full-page spinner.
   - Network tab: one `/auth/me`, one notifications fetch per session, no refetch on nav.
6. Compare before/after bundle and Lighthouse numbers in the final report.

---

## Task order (small batches, each independently verifiable)

1. `Skeletons.jsx` + `Skeletons.test.jsx`.
2. `BrowseJobs` job-card skeleton + update `Jobs.loading.test.jsx`.
3. Replace `LoadingScreen` returns on dashboards and detail pages.
4. Replace `LoadingScreen` returns on employer/admin tables and notifications/settings.
5. `TopNavLayout` fetch-once + `NOTIFICATIONS_CHANGED` listener.
6. `api.js` in-flight GET dedupe + test.
7. Lazy charts on admin dashboard/reports.
8. Route prefetch helper + job/nav hover.
9. Image lazy-loading + local logo assets.
10. `useMemo` pass on BrowseJobs/Applications/Reports.
11. Reduced-motion CSS pass.
12. Final verification loop + report.

## Risks / decisions

- **Skeleton fidelity:** a skeleton that doesn’t match the final card causes CLS. Each skeleton must use the same outer dimensions/padding as its real component.
- **Lazy charts:** wrapping a chart in `Suspense` must not push the layout; reserve the chart height (`h-[260px]`) in the fallback.
- **GET dedupe:** only concurrent requests, no TTL cache. If pages need stale-while-revalidate later, introduce a real data library rather than growing a custom cache.
- **Remote logo assets:** switching to local assets is a behavior-preserving change but touches every page via `Logo`; confirm the local files are the intended brand marks.
- **No new dependencies** except `web-vitals` (Phase 0) and `rollup-plugin-visualizer` (dev-only). Skeletons use the existing primitive.

---

## Results (implemented 2026-11-04)

### Images — the biggest win, and it was not in the original plan

The landing page shipped a **21.7 MB / 11811×5906 PNG** as its hero background. Resized and re-encoded with the OS image codec (no new dependency) and moved to `public/` so `index.html` can preload it:

| Asset | Before | After |
|---|---|---|
| hero background | 21,699 KB PNG (11811×5906) | 115 KB JPEG (1920×960, `public/hero-bg.jpg`) |
| `team.png` | 1,726 KB (1536×1024) | 98 KB JPEG (1200×800) |
| `Logo.png` | 995 KB (1254×1254) | 59 KB PNG (256×256) |
| `TextBased Logo.png` | 478 KB (2172×724) | 29 KB PNG (400×133) |

`design.jsx` `Logo` now points at those local marks instead of the Vercel blob URLs, so no page depends on that host.

### Chunks (`npm run build`)

| Chunk | Before | After |
|---|---|---|
| `index` (app shell) | 240.62 kB / 74.24 kB gz | 233.54 kB / 71.89 kB gz |
| `lib` (vendor) | 308.12 kB / 95.11 kB gz | unchanged |
| `EmploymentCharts` (recharts) | 423.51 kB, loaded with the admin dashboard | 423.56 kB, now behind `lazyCharts` — only the lazy chunk references it |
| `TopNavLayout` | 90.84 kB | 91.13 kB |
| `pdf` (already lazy) | 430.88 kB | unchanged |

### Measured in headless Chrome (mobile viewport 390×844, `vite preview`)

| Route | LCP | CLS | DOM ready |
|---|---|---|---|
| `/` | 776 ms | 0.054 | 246 ms |
| `/jobs` | 464 ms | 0 | 46 ms |

`/jobs` mid-flight: 4 skeleton cards in one `aria-busy` region, status `Loading jobs…`, no spinner, filters still mounted.

### Deviations from the plan

- **No `web-vitals` / `rollup-plugin-visualizer`.** The build output already prints the chunk table, and a `console.info` reporter has no consumer. The byte numbers above are the measurement.
- **No `AbortController` on unmount.** It conflicts with the Phase 2.2 in-flight dedupe: aborting one caller would cancel the shared request for every other caller. The existing `alive` guard still prevents state updates after unmount.
- **No opt-out flag on the GET dedupe.** Nothing needed one (YAGNI).
- **No `useMemo` pass** on BrowseJobs / Applications / Reports. BrowseJobs filters server-side, and the report scans are capped at 500 rows; no measurement showed a win.
- **No reduced-motion work.** `index.css:770` already disables every animation and transition under `prefers-reduced-motion`.
- **`public/images/*.png` are unused** (three 3.3 MB files, ~11 MB copied into every build). Flagged, not deleted — they are supplied assets.

### Not done

- Real Lighthouse run (no Lighthouse binary available; headless measurements only).
- A before/after LCP comparison on `/` — the "before" build now 404s its own hero image source.
