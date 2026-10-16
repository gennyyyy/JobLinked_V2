# Phase 1 — Architecture Pattern Review

**Scope:** `server/src/**` (Express API), `src/App.jsx`, `src/shared/**` (frontend shared layer).
**Method:** read all server route/middleware/auth/db/util files, frontend shared components, services, context, lib; traced query and error paths. No source code modified.
**Date:** 2026-10-15

---

## 1. Pattern Adherence Scorecard

| Layer | Score | Assessment |
|---|---|---|
| Backend layer separation | **2.5 / 5** | Routes are split by domain, but there are **no controller / service / repository layers**. Every handler inlines SQL, business logic, and HTTP concerns. Defensible under ADR-020 ("thin Express API"), but `admin.js` (604 lines, ~8 domains) and `jobs.js` (346 lines) are becoming god routers. |
| Frontend feature structure | **4 / 5** | `src/features/{auth,employer,job-seeker,public-site,super-admin}` + `src/shared/{components,services,hooks,context,lib}` is clean and consistently followed. Routes lazy-load per page (`App.jsx:10-49`). Minor: `shared/components/dashboard.jsx` is a generic name for layout blocks. |
| API design consistency | **4 / 5** | Uniform `{ error: { code, message } }` contract, RESTful resource paths, allowlisted query params, action verbs (`/duplicate`, `/publish`, `/activate`) used sensibly. One placement bug: user-scoped `/notifications/*` routes live in the admin router (`admin.js:443-467`). |
| Database access patterns | **4.5 / 5** | `pg.Pool` used correctly; **every** query is parameterized. Identifiers are constrained: `ORDER_COLS` allowlist (`jobs.js:9,50-51`), `JOB_COLS` allowlists, `information_schema` validation for admin user PATCH (`admin.js:94-98`), fixed `USER_TABLES` map. DATE parser guard is a nice touch (`db.js:5`). |
| Auth architecture | **4.5 / 5** | Supabase JWT validation, single-round-trip role union (`auth.js:9-19`), clean `auth` / `tokenAuth` / `optionalAuth` / `requireRole` middleware set, unforgeable `app_metadata` role signal for super-admin provisioning (`auth.js:28-30`, `admin.js:158-163`). |
| Error handling | **4 / 5** | `ah` wrapper + `err` contract + final middleware (`util.js:4-7`, `index.js:41-47`) are used uniformly — one exception: `upload.js:36-41` bypasses `err()` with raw `res.status(400).json`. |
| Frontend state management | **4.5 / 5** | `AuthProvider` is well-designed: identity-stable user object (no refetch storms, `AuthProvider.jsx:24-29`), session-driven loading, ADR-021 cross-portal session reset centralized in `PublicRoute`/`ProtectedRoute`. |
| DRY / duplication | **2.5 / 5** | See §4. Transaction boilerplate, role-union query, status writer, seeker JSON projection, and ownership guards are all duplicated. |

---

## 2. Anti-Patterns Found

### A. Structural

**AP-1 — God router: `server/src/routes/admin.js` (604 lines)**
One file owns: stats, users (list/patch/invite/role-move/custom-role), companies, jobs list + moderation (patch/publish/unpublish), applications, employees, referrals, accreditations, audit-logs, reference data, custom roles (CRUD), permissions catalog, notifications, system broadcast. Domains cross-cut each other (job moderation lives beside user management).

**AP-2 — SQL in handlers (no repository layer)**
Every route file inlines `pool.query(...)` (e.g. `jobs.js:14-18`, `admin.js:12-29`, `applications.js:23`). Combined with AP-1, business rules (accreditation gate `jobs.js:163-177`, publish flow `jobs.js:191-218`) are inseparable from HTTP handling. Acceptable at current size; the `meRoutes`/`seekerChild` factories (`profiles.js:26-52,245-279`) prove the extraction pattern works — it just hasn't been applied broadly.

**AP-3 — Cross-domain route placement**
`GET /notifications/mine`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `DELETE /notifications/:id` (`admin.js:443-467`) are **user-scoped** routes sitting in the admin-only router file. Similarly `GET /admin/reports/:type/export` sits in `reports.js` (consistent path, but the file only does exports).

**AP-4 — Client-side duplication of server normalization**
`services/auth.js:91-124` rebuilds the full lowercase/trim metadata map that the server re-normalizes anyway (`routes/auth.js:8-14,39-53`). Two sources of truth for the same field-normalization rules across the trust boundary (server is authoritative; client copy is dead weight).

### B. Consistency

**AP-5 — Error contract bypassed in `upload.js:36-41`**
Multer error paths hand-roll `res.status(400).json({ error: {...} })` instead of `err()` — same shape, two code paths to maintain.

**AP-6 — Generic file name**
`src/shared/components/dashboard.jsx` exports `PageHeader`, `StatCard`, `SectionCard` — portal layout blocks, not a dashboard. Misleads discoverability.

---

## 3. Violations (SOLID / pattern)

- **SRP** — `admin.js` violates single responsibility (AP-1). `jobs.js` handler at `jobs.js:179-218` does validation, dynamic SQL build, transaction, audit, and two notification fan-outs in one function.
- **DRY** — see §4 inventory; worst offenders are the transaction boilerplate (8 copies) and the seeker-JSON projection (5 copies across 3 files).
- **DIP** — handlers depend directly on `pool` (concrete). Not a violation per se for a thin API, but it's why AP-2 can't be tested or reused in isolation. Flag for the orchestrator's decision, not a mandate to fix.

No LSP, ISP, or circular-dependency violations found. Dependency direction is clean: `routes → auth/util/db → pg`, `features → shared/services → shared/lib → fetch/supabase`.

---

## 4. Code Duplication Inventory

| # | Pattern | Locations | Notes |
|---|---|---|---|
| D1 | `pool.connect()` + begin/commit/rollback/release boilerplate | `auth.js:72-133`; `jobs.js:195-209, 235-250, 274-291, 304-314`; `applications.js:134-149`; `profiles.js:175-190, 227-240`; `admin.js:500-524, 538-548, 586-599` | **8 copies**, ~60 lines total. Prime candidate for `withTransaction(fn)`. |
| D2 | 3-table role union query | `auth.js:9-19` (`resolveRole`) ≈ `admin.js:62-73` (`findUserTable`) | Same `super_admins → employers → job_seekers` union with `ord` precedence; only projection differs. |
| D3 | Job status writer (update + history insert) | `jobs.js:149-157` (`writeStatus`) ≈ `admin.js:477-485` (`adminWriteStatus`) | Byte-for-byte identical SQL. |
| D4 | `SEEKER_COLS` + `json_build_object` projection | `applications.js:7-20`; `admin.js:9` (used 3×: `:194, :205, :216`); `reports.js:10-15` | Same column list + same inline `json_build_object` construction in 5 places. |
| D5 | Job column/status/arrangement constant sets | `jobs.js:7-9, 120-121` vs `admin.js:472-475` | `JOB_COLS`/`ADMIN_JOB_COLS`, `JOB_ARRANGEMENTS`/`ADMIN_JOB_ARRANGEMENTS`, `JOB_STATUSES`/`ADMIN_JOB_STATUSES` — three parallel constant sets that must stay in sync. |
| D6 | Ownership guard ("not your job/company/application") | `jobs.js:35-42`; `applications.js:33-39, 75-84, 86-94, 177-187`; `profiles.js:68-74, 143-149, 206-215, 218-227, 282-312` | Same `req.user.role !== 'super-admin' && owner_id !== req.user.id` shape repeated ~10 times. |
| D7 | `loadJob(id)` helper | `jobs.js:13-18`; `applications.js:27-30` | Identical function in two route files. |
| D8 | Notification fan-out multi-row insert | `util.js:37-52` (`notifyAdmins`) ≈ `admin.js:563-575` (system broadcast) | Broadcast iterates 3 role tables (different enough), but the insert-select shape is the same. |
| D9 | Frontend metadata normalization | `services/auth.js:91-124` vs `routes/auth.js:39-53` | See AP-4. |

---

## 5. Structural Recommendations (Prioritized)

**P1 — Extract a `withTransaction(client => …)` helper** (kills D1, ~60 lines). Pure mechanical win; no behavior change. Put it in `server/src/util.js` next to `ah`/`err`.

**P1 — Consolidate D2 into one `resolveUser(id)`** in `auth.js` returning `{ role, table, profile }`. `findUserTable` becomes a thin wrapper (or a second consumer of the same union). Removes the risk of the two unions drifting in precedence order.

**P2 — Split `admin.js` by domain** into `routes/admin/` sub-routers: `users.js` (users, invite, role-move, custom-role), `moderation.js` (jobs patch/publish/unpublish, accreditations), `reference.js` (reference data, permissions, broadcast), `reports` already separate. Target: no route file > 300 lines.

**P2 — Move `/notifications/*` out of `admin.js`** into `routes/notifications.js` — they're user-scoped (any authenticated role), not admin-only.

**P3 — Extract shared SQL fragments** into `server/src/queries.js`: the `SEEKER_JSON` projection (D4), `loadJob` (D7), and the three constant sets (D5 — single source, aliased per consumer). Optional given ponytail mode, but D4/D5 actively cause sync bugs.

**P3 — Extract an ownership guard** `loadOwnedJob(req, res, id)` / `loadOwnedApplication(...)` that returns the row or sends 403/404 (kills D6). Same guard shape everywhere today.

**P3 — Use `err()` in `upload.js:36-41`** (AP-5) — one-line consistency fix.

**P4 — Rename `dashboard.jsx`** to `portalBlocks.jsx` (AP-6). Cosmetic.

**Decision required from orchestrator — layering strategy.** Two coherent options, pick one explicitly:
1. **Stay thin (ADR-020 status quo):** no controllers/services/repositories; enforce the P1/P3 helper extractions and a per-file size budget instead. Less machinery, matches current team velocity.
2. **Introduce a service layer:** `routes → services (business rules) → db (queries)`. Cleaner testing story, but adds 6+ files of indirection for a ~7-route API.

**Recommendation: option 1.** The codebase's own comments (e.g. `util.js:41-43`, `rateLimit.js:3`) show the team deliberately chose documented minimalism. Forcing a 4-layer architecture now would be speculative scaffolding; the duplication inventory above is the real debt, and it's fixable with helpers, not layers.

---

## 6. Long-Term Implications

- **What's working:** the auth middleware set, the error contract, the allowlisted-query discipline, and the frontend service/lib separation are all genuinely good — future change is cheap in those areas.
- **What hurts change:** `admin.js` is the single biggest drag on maintainability. Every new admin feature lands in one 600-line file with 13 parallel stat queries, three ownership domains, and two notification systems. Splitting it (P2) is the highest-leverage structural move available.
- **Scaling watch-items:** `notifyMatchingSeekers`/`notifyAdmins` fan-outs are synchronous inserts (fine at current volume; the code already documents the ceiling). `admin.js:12-29` stats fan-out runs 13 sequential-aware queries per dashboard load — acceptable today, move to a materialized view or cache if the dashboard gets hot.
- **Security posture:** no injection vectors found (parameterized everywhere, allowlisted identifiers); the accreditation gate (`jobs.js:163-177`) is correctly enforced at the trust boundary per ADR-022; path traversal guard on file download is correct (`profiles.js:286-289`).

---

## 7. Architecture Decision Suggestions for the Orchestrator

| # | Candidate ADR | Question |
|---|---|---|
| ADR-025 candidate | Backend shared helpers | Ratify `withTransaction`, `resolveUser`, and a `queries.js` fragment module as the sanctioned home for duplicated SQL/transaction shapes — **without** introducing a service layer. |
| ADR-026 candidate | Admin router decomposition | Ratify the `routes/admin/` split + notifications route move, with a 300-line-per-file budget. |
| — (no ADR) | Ponytail boundary | Record explicitly: no controller/service/repo layer, no new abstractions beyond the P1/P3 helpers. Keeps the door open but prevents well-meaning over-layering. |

---

*Review only — no source files modified.*
