# Phase 6 — correctness & quality review (working tree vs HEAD)

Scope: 93 modified + ~110 untracked files. Full stack green: `npx vitest run` → **121 files / 767 tests passed**; `npx vitest run --root server` → **46 / 360**.

Verdicts: **server backend — approve with fixes** · **frontend — needs-fix** · **tests — needs-fix** · **docs/contract — needs-fix** · **migrations/schema — approve** · **artifacts — needs-fix**

---

## 1. Findings

| ID | Sev | Location | Issue | Fix |
|---|---|---|---|---|
| F-01 | HIGH | `src/features/super-admin/Reports.jsx:145` | "Open vacancies" counts `status?.toLowerCase() === 'open'`. `job_status` has no `open` value (draft/pending/approved/rejected/published/closed/archived). **Metric is hardwired to 0.** | `job.status === 'published'` |
| F-02 | HIGH | `src/features/super-admin/Reports.jsx:146` | "Employers posting" reads `job.employer_id`. `job_vacancies` column is `company_id`; `GET /admin/jobs` returns `j.*` + `employers` embed, never `employer_id`. **Metric is hardwired to 0.** | `job.company_id` |
| F-03 | HIGH | `src/features/super-admin/Logs.jsx:156,198` | `listUsers()` defaults to `pageSize: 25`; the audit-log "Filter by user" `<select>` is built from that page. The user filter is silently truncated to the first 25 accounts (was: all users). | Pass `{ pageSize: 500 }` (server max) or key the dropdown off `listUsers({ search })`. |
| F-04 | HIGH | `UserManagement.jsx:42,151,208`; `Employees.jsx:117,129,164` | Both client-side searches and the role/status filters now run over the **current 25-row server page** only. A user on page 3 is unfindable by name; `{filtered.length} records` under-reports. The API already accepts `role`, `search`, `status` — they are simply not wired. | Send `role`/`search`/`status` to `GET /admin/users` (debounced), keep `Pager`; drop the client filters. |
| F-05 | MED | `Reports.jsx:6-11` (whole page) | 4 of the previous 7 report types deleted (applicants, seekers, employers, barangay, monthly) and "Referral" reduced to em-dash StatCards + a "not available yet" stub. `docs/superpowers/plans/2026-10-09-ponytail-cleanup.md:48` had explicitly kept the server CSV export contract. No ADR/plan cites this removal. | Either restore the types server-side or record the deletion as a decision. |
| F-06 | MED | `src/shared/services/auth.js:36-58` | On PATCH failure `updateProfile` re-reads and compares; `Object.entries(patch).every(...)` on an **empty** patch is vacuously `true`, so any failure (400 "Nothing to update", 403, 409) is reported to the caller as success. Also converts a genuine 409 into success whenever the current row already matches. | `if (!Object.keys(patch).length) throw error;` before the confirm. |
| F-07 | MED | `server/src/routes/admin.js:593`; `server/src/routes/jobs.js:251` | `'' → null` for every patched column, but `vacancies int not null` and `work_arrangement text not null check(...)` cannot be null → admin/employer PATCH with an emptied field 500s instead of 400ing. | Treat `''` as "reject with 400" for NOT NULL / CHECK columns (or keep the previous value). |
| F-08 | MED | `db/schema.sql:475-488` (+ `008_constraint_gaps.sql:73-84`) | The `super_admins_email_uidx` / `employer_accreditations_one_pending_uidx` / date-range CHECKs are created **only if the current data happens to be clean**. On a DB with duplicates the guard raises a NOTICE and silently skips, and every later re-run is a no-op — the invariant the app relies on (role-move 409) is never enforced. | Add a follow-up migration/ticket that dedupes and re-applies; surface a startup warning. |
| F-09 | LOW | `server/src/routes/jobs.js:37` (+ 7 more), `server/src/__tests__/auth.provision.test.js:28`, `server/src/__tests__/notifications.routes.test.js:76,84` | Double-encoded UTF-8 mojibake: bytes `C3 A2 E2 82 AC E2 80 9D` where an em dash belongs, and `0x93`/`0x94` stray control bytes in comments and `it(...)` titles. Toolchain encoding bug, not hand-typed. | Re-save those three files as UTF-8; check the writer's encoding setting. |
| F-10 | LOW | repo root | `test-final.txt` (captured vitest output, 3.5 KB) and `dbcheck.cjs` (a scratch script that reads `DATABASE_URL` out of `server/.env` and prints DB version + column list) are untracked scratch artifacts sitting at the project root. | Delete both. |
| F-11 | LOW | `new_landing_page/` | 1.5 MB static mockup + 5 PNGs, **zero references** anywhere in the app or git history. | Move out of the repo or delete. |
| F-12 | LOW | `src/shared/services/admin.js:122` | `exportReport` is dead: the server endpoint still exists and is tested, but no client calls it after the Reports rewrite. | Delete the client wrapper (keep the endpoint only if it's a documented deliverable). |
| F-13 | LOW | `src/features/auth/EmployerRegister.jsx:78` | `companyPhone: normalizePhone(...)` is still built into the `extra` payload but `signUp` no longer sends `company_phone` (no such column). Dead field. | Remove the line. |
| F-14 | LOW | `server/src/app.js:59` | `attachPrincipal` runs a Supabase `getUser` + a `resolveRole` DB round trip on **every** `/api/*` request that carries an Authorization header — including requests that will 404 and public reads that don't need auth. Correctness-wise fine (per-request caches mean no duplicate work), but it adds two network hops to paths that previously had none. | Mount only where the response actually needs the principal, or accept with a comment. |
| F-15 | LOW | `server/src/routes/admin.js:94-95` vs `docs/arch/rework/02-api-contract.md:37` | `/admin/stats` returns 14 keys; the contract documents 7. Additive, but the doc is now wrong. | Update the doc line. |

---

## 2. Verified-correct (no action)

- **Middleware order (`server/src/app.js:36-64`)** — helmet → compression → CORS (fail-closed default origin) → requestId → requestLog → json parser → `/api/auth` authLimiter + POST `/api/documents` & `/api/files/*` uploadLimiter → `GET /api/health` (terminal, so LB probes escape every limiter) → `attachPrincipal` → `apiLimiter` → routers → 404 → error handler. `stricterLimiterPaths` mirrors `apiLimiter`'s `skip` exactly, so the stricter buckets are never double-counted and `attachPrincipal` never runs where the limiter doesn't count. Proven live by `api-rate-limit.test.js` (429 after 300; 101st `/api/auth/me` → 429) and `f01-f02-rate-limit-keying.test.js` (per-user buckets, `trust proxy` env-driven).
- **`userFromToken` concurrency cache** (`auth.js:35-42`) — memoizes the *promise*, so two concurrent awaiters share one `getUser`; a rejection stays cached, which is the right semantics for the 401 mapping. `roleFrom` caches the same way and every call site passes `user.id`, so there is no stale-id hazard.
- **`resolveRole` / `findUserTable` / `/admin/users` ordering** — `status` is `account_status not null default 'active'` in all three role tables (`db/schema.sql:50,89,104`), so `profile->>'status' = 'active'` is never NULL and Postgres's DESC default `NULLS FIRST` cannot invert the active-first rule. `distinct on (id) … order by id, (status='active') desc, ord` is syntactically valid (DISTINCT ON requires the ORDER BY to lead with the same expressions), filters apply to the deduped row, and the outer `order by created_at desc, id desc` gives a stable page boundary.
- **`withTransaction`** (`util.js:24-37`) — rollback failure cannot mask the original error, `release()` in `finally`, `throw e` re-raises. All 8 old inline copies are gone (grep confirms zero `pool.connect()` outside `util.js`).
- **Role move** (`admin.js:672-695`) — deactivate + upsert in one transaction, `on conflict (id) do update` reactivates the stale row (no PK 500), 23505 → 409, 403 on self-move. The `b2-role-move.test.js` harness models the FK cascades and asserts no `delete from` is ever emitted.
- **Error middleware** — redacts to a key whitelist, never logs `e.query`/`e.parameters`, never logs the body-parser message (V8 quotes the offending snippet). Asserted structurally in `index.test.js`.
- **Migrations 007/008/009** — coherent, idempotent, documented rollback. The `employment_history.application_id` CASCADE→SET NULL change (`008:23-44`) is the correct companion to the retention purge; `POST /accreditations`' `on conflict (company_id) where status='pending'` now has a matching partial unique index (`schema.sql:408`).

---

## 3. Tests that no longer prove anything

Highest-value output of this review. The backend suite is genuinely behavioural in ~33 of 46 files (mocked `pool` + supertest against the real routers) — those are good. The problem is the **13 files that assert source text**, and the 3 below that were rewritten into that shape.

| File | Why it proves nothing |
|---|---|
| `server/src/auth.resolveRole.test.js:50-57, 111-118` | Mocks `pool.query` to `{ rows: [] }`, then asserts the SQL *string* matches `/order by \(profile->>'status' = 'active'\) desc, ord/`. The precedence is never executed. Would still pass if Postgres sorted NULLS-first on a null status, or if `ord` were reversed. |
| `server/src/__tests__/b2-role-move.test.js:188-208` | The `distinct on (id)` dedupe test hand-feeds the winner row and then asserts the SQL contains `distinct on (id)`. Cannot detect a broken dedupe. The other 8 tests in that file *are* real. |
| `server/src/routes/admin.users.patch.test.js:1-36` | Entirely `expect(adminSrc).toContain('delete body.id;')` etc. Would pass with the whole route unreachable, or with `information_schema.columns` queried against the wrong schema. (`admin.security.test.js` covers the same route behaviourally — this file is redundant on top of it.) |

Same class, lower risk (no security invariant at stake): `admin.permissions.test.js`, `applications.dashboard.test.js`, `jobs.create.test.js`, `jobs.delete.test.js`, `notifications.delete.test.js`, `profiles.accreditation-ownership.test.js`, `profiles.patch.test.js`, `b4-resume-upload.test.js`, `s3-s6-s7-error-handling.test.js`.

Weakened to accommodate a change: `jobs.duplicate.test.js` — the old rollback assertion on the route was replaced by `expect(utilSrc).toContain("client.query('rollback')")`. The new one no longer proves the *job-duplicate* path rolls back, only that the helper's source contains the word.

Not weakened (legit updates): `documents.test.js` (PDF 2 MB cap, added both boundary cases), `resumeAutofill.test.js` (phone now `+63…` per `normalizePhone`), `JobSeekerRegister.test.jsx` (education now travels in `signUp.extra`), `NotificationBell.test.jsx` (new event listener), `UserManagement.invite.test.jsx` / `ReportsCsv.test.jsx` (envelope shape — correct, since the server really changed).

**No test covers F-01, F-02, F-03 or F-04.** No test asserts the Reports stat cards, and `Logs.test.jsx` mocks `listUsers` with a full envelope so the 25-row truncation is invisible.

---

## 4. Contract drift (`docs/arch/rework/02-api-contract.md`)

| Endpoint | Doc says | Code does |
|---|---|---|
| `GET /admin/stats` | 7 keys | 14 keys (F-15) |
| `GET /admin/reports/:type/export` | absent | exists, tested, **no client caller** (F-12) |
| `GET /applications/employers/me/dashboard` | absent | new, 3 queries |
| `GET /admin/permissions` | absent | added this pass |
| `POST /admin/users/invite`, `/users/:id/role`, `/users/:id/custom-role` | absent | exist (documented in `plans/`+`specs/` instead) |
| `GET/POST/PATCH/DELETE /admin/roles…` | absent | exist |
| `POST /admin/system-notifications` | absent | exists |
| `PATCH /admin/jobs/:id`, `POST /admin/jobs/:id/{publish,unpublish}` | absent | exist |
| `GET /api/health` | absent | exists |
| `POST /api/files/documents` | listed without constraints | now **400 + unlinks the orphan** when `doc_type` is missing (F-04 fix) |
| Report type set | `plans/2026-10-09-ponytail-cleanup.md:48` keeps the server CSV export | client-side-only rewrite (F-05) |

The pagination updates to `/admin/users`, `/admin/companies`, `/admin/jobs`, `/admin/applications`, `/admin/accreditations`, `/employers/:id/jobs`, `/jobs`, `/audit` and the new Addenda C/D are all correctly documented. The drift is concentrated in the admin feature surface that grew outside this pass.

---

## 5. D1–D9 duplication register status

| # | Pattern | Status |
|---|---|---|
| D1 | transaction boilerplate | **done** — `withTransaction`, zero copies left |
| D2 | 3-table role union | **not done** — two copies: `auth.js:17` and `admin.js:111-118`; a third shape in `/admin/users` (`admin.js:94`) |
| D3 | job status writer | **not done** — `jobs.js:184` vs `admin.js:577` still byte-identical |
| D4 | `SEEKER_COLS` + `json_build_object` | **not done** — 3 copies (`applications.js:7`, `admin.js:10`, `reports.js:10`) |
| D5 | job column/status/arrangement sets | **not done** — `JOB_COLS`/`ADMIN_JOB_COLS`, `JOB_STATUSES`/`ADMIN_JOB_STATUSES`, `JOB_ARRANGEMENTS`/`ADMIN_JOB_ARRANGEMENTS` |
| D6 | ownership guard | **not done** — `ownOrAdmin` × 2, `credByLink`, `seekerChildRead`, inline `role !== 'super-admin' && id !== req.user.id` × 6 |
| D7 | `loadJob` | **not done** — `jobs.js:20` and `applications.js:28` |
| D8 | notification fan-out insert | **partially** — `notifyAdmins` unified, but 3 remaining `insert … select … union all` shapes (`util.js:90`, `admin.js:653`, `jobs.js:176`) |
| D9 | frontend metadata normalisation | **not done** — `services/auth.js` still rebuilds the lowercase/trim map the server re-normalises |

P2 (`admin.js` is 697 lines) and P3 (`/notifications/*` still live in the admin router) also carried forward.

---

## 6. Could not verify

- **Live Postgres behaviour** of `resolveRole`, `findUserTable` and the `/admin/users` `distinct on` ordering. No database is reachable from this environment; both unit tests mock the pool (see §3). The NULL-status hole in `order by … desc` is closed only by reading `db/schema.sql` (`not null default 'active'`), not by execution.
- **Whether migrations 007–009 were applied** to any environment. Without that, existing DBs still have the `employment_history` CASCADE FK and no trigram/pending-unique indexes, so the retention purge would still erase placement history.
- **Whether the `db/schema.sql` edit has the architect approval AGENTS.md requires** ("Do not modify `db/schema.sql` without architect approval"). No approval note is in the diff.
- **Load and performance claims** in `docs/arch/audit/phase4-loadtest.md` — the harness is present and zero-dependency, but no results were reproduced here.
- **Visual / accessibility outcome** of the ~40 JSX rewrites (titleCase, `X` icons, `InlineError`, `Pager`, `useDialog` in 7 consumers). Evidence is test-level only; `Jobs.a11y.test.jsx`, `dialogA11y.test.jsx` and `PortalLayout.test.jsx` exist and pass, but I did not run a screen reader or axe.
- **Intent of `new_landing_page/`.**

---

## 7. Worth a look (below confidence threshold — not findings)

- `App.jsx` — `<Route path="*">` sends unknown paths to `/`, so a bad deep link into a portal silently lands on the public landing page rather than a 404.
- `admin.js:344` — `setInterval(...).unref?.()`: every test file that imports the real `admin.js` without setting `RETENTION_DISABLE=1` (`admin.pagination`, `api-rate-limit`, `f01-f02`, `middleware-hardening`) arms the live timer. Harmless today (`unref` + 24 h window) but it means a long-lived test process can fire a real `delete`.
- `admin.js:221` — `supa().auth.admin.updateUserById?.(data.user.id, …)` optional-calls the *method* but not `data.user`; a success response without `data.user` throws a TypeError that surfaces as a 500 after the invite email has already gone out.
- `admin.js:206` — invite metadata carries `full_name` built from untrimmed body parts (`buildFullName` trims, so this is only cosmetic) while `first_name`/`last_name` are pushed raw into Supabase `user_metadata`.
- `ai.js:57` — `model: process.env.OPENROUTER_MODEL` is omitted from the JSON body when unset, so a misconfigured deployment gets a 400 from the provider surfaced as a generic `502 UPSTREAM_ERROR`.
- `server/vitest.config.js:12` — `process.chdir()` at config load; the root `vite.config.js` now also globs `server/**`, so the server suite runs a second time under jsdom. It passes (767/767), but that's two runners over the same files.
- `withQuery` (`api.js:21`) drops empty-string values, so `listUsers({ search: '' })` correctly omits them — but it also means a caller can never explicitly *clear* a server-side filter by sending `''`.

---

## 8. Merge recommendation

**APPROVE WITH SUGGESTIONS** for the server backend, migrations and the test suite — the correctness work (transactions, ordering, pagination guards, error redaction, middleware order) is real and verified.

**BLOCK** on F-01, F-02, F-03, F-04: four always-zero or silently-truncated UI data paths on the super-admin pages, all introduced in this same pass, none covered by a test. They are one-line fixes each.
