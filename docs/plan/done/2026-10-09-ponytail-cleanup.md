# Ponytail Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the 7 highest-value / lowest-risk over-engineering cuts from the 2026-10-09 audit without behavior change.

**Architecture:** CSV-only exports (cut 2 heavy deps); deduplicate report SQL/CSV via existing helpers; collapse single-use wrappers in place; defer auth-shape and dialog rewrites as risk > saving.

**Tech Stack:** Express 4 + pg (no ORM), React 19 + Router v7, Tailwind v4, Vitest.

**Spec:** Ponytail audit 2026-10-09 (11 findings) + this doc. ADR-030 through ADR-033 below are normative.

## Global Constraints

- Plain JS only, no TypeScript.
- `npm run lint` must exit 0 before submit.
- API errors stay `{ error: { code, message } }`.
- Service-role key and DATABASE_URL never in client bundle.
- Nothing alters `db/schema.sql` without architect approval — this plan approves NO schema change.
- Ponytail full intensity: shortest diff wins, no new abstractions, no new deps.

## Review Focus

- CSV download still works when server export 404/400s (client fallback must remain).
- Auth session behavior unchanged (no logout/login regressions).
- AFK warning still fires at 4min, logout at 5min.
- Notification bell dropdown renders identical items.
- No import breakage from AuthContext merge (20+ useAuth consumers untouched).

---

## ADRs (normative)

### ADR-030: CSV-only report export
Drop `excel`/`pdf` branches from `GET /admin/reports/:type/export`. Keep `csv` branch + client `exportCSV` fallback. Remove `exceljs`, `pdfkit` from `server/package.json`. Rationale: frontend already ships working CSV builder; excel/pdf add 2 heavy deps for marginal value.

### ADR-031: Deduplicate, don't abstract
`reports.js` SELECTs (`SEEKER_COLS/seekerJson/APP_JOIN/APP_SELECT`) and `toCSV` duplicate `admin.js` + frontend `exportCSV`. Reuse by importing the existing query text from `admin.js` (or a 3-line local forward, whichever is fewer lines) and a single `toCSV(headers,rows)` + `downloadBlob(blob,name)` shared by `exportCSV`/`exportServer`. No new shared lib across tiers.

### ADR-032: Collapse single-use wrappers in place
Merge `AuthContext.js` into `useAuth.js` (context defined + exported from `useAuth.js`; consumers unchanged); inline `StatGrid` class; change `useAFKTimer(enabled)` to `useAFKTimer(enabled, onWarning)` dropping `onWarningRef/setWarningCallback`. No behavior change.

### ADR-033: Deferred (explicitly NOT approved)
`void userId/companyId` param mass-rename, `PublicRoute`/`ProtectedRoute` merge, `ConfirmationModal` portal→`<dialog>` rewrite are deferred: touch auth-critical paths, risk exceeds line savings. Revisit only with failing-session repro or measured need.

## JSON API Contract (only change)

- `GET /api/admin/reports/:type/export?format=csv` — 200 `text/csv` + `Content-Disposition: attachment; filename="<type>-report.csv"`. Unchanged.
- `?format=excel|pdf` — now `400 { error: { code: 'BAD_REQUEST', message: 'format must be csv' } }`. Previously 200 xlsx/pdf. Client `exportServer` must treat 400 as fallback to `exportCSV` (already does for 400/404).
- `:type` allowlist unchanged. Auth: `super-admin` only, 401 retry + bounce unchanged.
- All other endpoints: no change.

## Database Schema / Migration Plan

None. No table, column, index, or view change. No migration file. `db/schema.sql` and `supabase/migration.sql` untouched.

## State Management Strategy

No new store. Auth stays `AuthContext + useAuth` merged into one module (`src/shared/hooks/useAuth.js` owns context). AFK stays local hook with direct callback arg. Notifications stay local `useState` in bell/page.

## Directory Structure Blueprint

- DELETE `src/shared/context/AuthContext.js`. Define context in `src/shared/hooks/useAuth.js` and export it for `AuthProvider.jsx`. Update only 2 imports (`AuthProvider.jsx`, `useAuth.js`); 20+ `useAuth` consumers unchanged.
- No new files except this plan. All other fixes are in-place edits.

---

### Task 1: Backend — CSV-only export + stdlib path

**Files:**
- Modify: `server/src/routes/reports.js`
- Modify: `server/package.json`
- Modify: `server/src/upload.js`

**Interfaces:**
- Consumes: existing `loadReport(type)`, `admin.js` query text.
- Produces: `GET /admin/reports/:type/export?format=csv` → CSV only; `uploadDir` unchanged value.

- [ ] Step 1: Write failing test — request `?format=excel` expects 400 BAD_REQUEST, `?format=csv` expects CSV.
- [ ] Step 2: Run test to verify it fails.
- [ ] Step 3: Implement — delete ExcelJS/PDFKit imports + branches, tighten format check to csv-only, reuse admin query text, replace manual absolute-path check with `path.isAbsolute`.
- [ ] Step 4: Run test to verify it passes.
- [ ] Step 5: Run `npm run lint` in `server/` (if configured) + remove `exceljs`/`pdfkit` from deps, verify no other import references them.
- [ ] Step 6: Commit.

### Task 2: Frontend Reports — single CSV/download helper

**Files:**
- Modify: `src/features/super-admin/Reports.jsx`

**Interfaces:**
- Consumes: Task 1 contract (400 on excel/pdf → fallback).
- Produces: identical CSV bytes + filenames.

- [ ] Step 1: Write failing test — `toCSV` helper output equals current inline join for a fixture.
- [ ] Step 2: Run test to verify it fails.
- [ ] Step 3: Implement — extract existing inline `"${c}"` join into one local `toCSV`, extract blob-anchor dance into one local `downloadBlob`, use in both `exportCSV`/`exportServer`. No new file.
- [ ] Step 4: Run test to verify it passes.
- [ ] Step 5: Commit.

### Task 3: Shared UI — bell reuse + StatGrid inline

**Files:**
- Modify: `src/shared/components/NotificationBell.jsx`
- Modify: `src/shared/components/NotificationsPage.jsx` (only if needed to share `NotificationItem`)
- Modify: `src/shared/components/dashboard.jsx`

**Interfaces:**
- Consumes: `NotificationItem`, `SystemBadge` from `NotificationsPage.jsx`.
- Produces: visually identical bell dropdown + dashboards.

- [ ] Step 1: Write failing test — bell renders same title/message/date as page item for fixture.
- [ ] Step 2: Run test to verify it fails.
- [ ] Step 3: Implement — render `NotificationItem` inside bell dropdown instead of duplicated div; inline `StatGrid` grid class at its 2 call sites, delete `StatGrid` export.
- [ ] Step 4: Run test to verify it passes.
- [ ] Step 5: Commit.

### Task 4: Auth plumbing — merge context + direct AFK callback

**Files:**
- Modify: `src/shared/hooks/useAuth.js`
- Delete: `src/shared/context/AuthContext.js`
- Modify: `src/shared/context/AuthProvider.jsx`
- Modify: `src/shared/hooks/useAFKTimer.js`
- Modify: `src/shared/components/PortalLayout.jsx`

**Interfaces:**
- Consumes: `supabase.auth.onAuthStateChange`.
- Produces: `useAuth()` return `{ user, role, loading, logout, refreshUser }` unchanged; `useAFKTimer(enabled, onWarning)` signature.

- [ ] Step 1: Write failing test — existing `ProtectedRoute` + `Login` tests pass with merged module; AFK warning callback fires.
- [ ] Step 2: Run test to verify it fails (import error before merge).
- [ ] Step 3: Implement — move `createContext(null)` into `useAuth.js`, re-export for provider; replace `onWarningRef/setWarningCallback` with direct `onWarning` arg; update `PortalLayout` call site only.
- [ ] Step 4: Run `npm test` + `npm run lint` to verify it passes.
- [ ] Step 5: Commit.

## Self-Review

1. Spec coverage: all 7 approved cuts have owning tasks; 4 deferred cuts explicitly in ADR-033 with no task (correct).
2. Step scan: each step names one action + checkable result; no body transcribed.
3. Type consistency: `useAuth` return shape, `exportReport(type,format)` fallback, `toCSV(headers,rows)` names consistent across Tasks 1-2.
4. Review Focus: 5 failure modes listed above, each pinned to owning task's tests.
5. Proportion: plan shorter than code it changes (~40 lines vs ~140 removed); no bodies transcribed.
