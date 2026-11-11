# Bug Hunt & Fix Plan (2026-11-11)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every material bug surfaced by the 2026-11-11 bug hunt (4 parallel audits + a second independent pass: backend, security, frontend, ops/E2E) plus the still-open items carried from the 2026-10-16 Phase 6 review, without behavior changes beyond what each fix requires. No implementation code is written here; this document is the contract. Current register: 74 tasks.

**Architecture:** Fixes land in the existing layers — `server/src/` (routes, middleware, auth), `src/` (components, context, hooks, services), `supabase/migration.sql` + `supabase/security-fixes.sql` (DB trigger), `db/schema.sql` + migrations, `scripts/`, `.github/workflows/ci.yml`, `.gitignore`. No new subsystems, no new dependencies. Each fix is the smallest correct change (ponytail ladder). Schema changes require Lead Architect sign-off (this document is that sign-off for the items listed; any new DDL beyond them needs a fresh ADR).

**Tech Stack:** Node 24, Express 4, pg 8, Supabase auth, React 19, Vite 8, Vitest 4, jsdom, RTL, puppeteer-core. Postgres 18 locally / remote VPS.

**Spec:** this document (the hunt's consolidated register). Cross-reference: `docs/arch/rework/02-api-contract.md`, `docs/arch/adr-backlog.md`, `docs/plan/done/2026-11-04-01-system-gap-analysis.md`, `docs/arch/audit/phase6-code-review.md`.

## Global Constraints

- No new dependencies anywhere.
- No `db/schema.sql` / migration edits without this sign-off (granted here for the items in §Critical/§High that touch DDL; anything else needs a new ADR).
- Every fix keeps `npm test`, `npm --prefix server test`, `npm run lint`, `npm run build` green.
- Fixes are atomic per task; commit after each verified task.
- Accepted ceilings (do NOT re-flag or "fix"): 60 s JWT-revocation window (ADR-028), in-memory rate-limit store (single instance), four deliberately unbounded reads (ADR-029), audit-log date matching assuming UTC+8 host, `skills`/`tags text[]` (not join table), soft FKs on notifications/profile_images/audit_logs, `full_name` denormalization, accreditation trigger has no DELETE branch (no delete path exists).

## Review Focus

The five input classes / failure modes most likely to bite a person using this software, most likely first:

1. **A module that fails to parse** (rateLimit.js duplicate export) silently kills the entire API and every server test — the highest blast-radius single line in the repo.
2. **A privilege-escalation path** (Supabase `handle_new_user` super-admin branch + local `auth()` trusting the DB row) lets any signup become a super-admin.
3. **Stale async state resurrecting a signed-out user** (AuthProvider logout not bumping `loadSeq`/`signedInId`) — a dropped-packet race that re-installs `user` after logout.
4. **Always-zero / silently-truncated admin metrics** (Reports stat cards, Logs user filter) — admins make decisions on wrong numbers.
5. **Client-only guards with no server enforcement** (apply past deadline, job delete totals) — direct API calls bypass the UI.

---

## Critical (blockers / security / data loss)

### Task 1: Remove the duplicate `resumeExtractLimiter` export (API cannot boot)
- **Files:** `server/src/middleware/rateLimit.js:49` and `:79`
- **Issue:** Two `export const resumeExtractLimiter` declarations → `SyntaxError: Identifier 'resumeExtractLimiter' has already been declared`. `node --check` fails; 38/80 server test files fail to transform; the API cannot start.
- **Fix:** delete the second declaration (lines 79–86). Keep the first (lines 47–56). No other change.
- **Verify:** `node --check server/src/middleware/rateLimit.js` exits 0; `npm --prefix server test` runs without transform errors.
- **Agent:** backend

### Task 2: Close the super-admin self-registration privilege escalation
- **Files:** `supabase/migration.sql:774,836` (canonical trigger), `supabase/security-fixes.sql` (patch, not wired into the canonical schema or CI), `server/src/auth.js:103-121` (`auth()`), `server/src/routes/admin-users.js:203` (invite partial-failure)
- **Issue:** `handle_new_user()` casts `raw_user_meta_data->>'role'` to `user_role` and, on `'super-admin'`, inserts into `super_admins`. `raw_user_meta_data` is user-controllable at signup, so anyone can self-register as a super-admin. `security-fixes.sql` already patches the trigger but is a manual, undocumented step and is not reflected in `migration.sql`. Defense-in-depth: local `auth()` resolves role purely from the DB row and never checks `app_metadata.role`, so an escalated row grants full admin. Invite path: `supa().auth.admin.updateUserById?.(...)` uses optional chaining, so a missing method leaves `app_metadata.role` unset and the route still returns 201.
- **Fix:**
  1. Mirror the `security-fixes.sql` guard into `supabase/migration.sql` (`if r = 'super-admin' then raise exception ...`) so the canonical schema is safe.
  2. In `server/src/auth.js` `auth()`, when the resolved role is `super-admin`, require `user.app_metadata?.role === 'super-admin'`; otherwise 403.
  3. In `admin-users.js`, replace `supa().auth.admin.updateUserById?.(...)` with a direct call and treat any error as a failure (return 502/500, not 201).
  4. Document in `db/README.md` that `supabase/security-fixes.sql` must be applied (or fold it into the canonical migration).
- **Verify:** attempt signup with `data.role='super-admin'` → rejected; `auth()` rejects a super_admins row whose `app_metadata.role` is not `super-admin`.
- **Agent:** backend + security-auditor (review)

### Task 3: Prevent stale async state from resurrecting a signed-out user
- **Files:** `src/shared/context/AuthProvider.jsx:117-125` (`logout`), `src/shared/components/TopNavLayout.jsx:121-124` (`handleLogout`)
- **Issue:** `logout` never bumps `loadSeq` or clears `signedInId`, so a profile request started before logout can resolve after and re-install `user`. `handleLogout` calls `logout()` without awaiting, then navigates, racing the sign-out.
- **Fix:** in `logout`, set `loadSeq.current += 1; signedInId.current = null;` before clearing state. In `handleLogout`, `async function handleLogout() { await logout(); navigate('/') }`. Same await in `useAFKTimer` logout path.
- **Verify:** unit test: start a slow `getProfile`, call `logout`, assert `user` stays null when the slow promise resolves.
- **Agent:** frontend

---

## High (correctness / security / data integrity)

### Task 4: Server-side deadline enforcement on apply (client guard is not a boundary)
- **Files:** `src/features/job-seeker/JobDetail.jsx:98-100,242`; `server/src/routes/applications.js` (POST `/applications`); contract `docs/arch/rework/02-api-contract.md` already specifies the SQL-side check.
- **Issue:** UI disables the button, but a direct POST succeeds. Contract says the deadline must be checked inside the `INSERT … SELECT … WHERE EXISTS` (TOCTOU).
- **Fix:** implement the server-side guard per the contract; keep the client guard. Also add the `if (applying) return` guard at the top of `handleApply` to prevent Enter-key double-fire.
- **Verify:** POST with an expired deadline → 400 "The application deadline for this job has passed."; integration test covers the boundary day.
- **Agent:** backend

### Task 5: Admin metrics that are always zero / silently truncated
- **Files:** `src/features/super-admin/Reports.jsx:145-146` (F-01, F-02 from Phase 6); `src/features/super-admin/Logs.jsx:156,198` (F-03); `src/features/super-admin/UserManagement.jsx:42,151,208` and `Employees.jsx:117,129,164` (F-04).
- **Issue:** "Open vacancies" filters `status === 'open'` (no such enum value) → always 0. "Employers posting" reads `job.employer_id` (column is `company_id`) → always 0. Logs user filter truncated to the first 25 accounts. UserManagement/Employees search and role/status filters run over the current 25-row page only.
- **Fix:** F-01 → `job.status === 'published'`. F-02 → `job.company_id`. F-03 → `listUsers({ pageSize: 500 })`. F-04 → send `role`/`search`/`status` to `GET /admin/users` (debounced), keep `Pager`, drop client filters. (F-05 report-type deletion: verify whether intentional; if not, restore or record the decision — carried as Task 24.)
- **Verify:** add tests asserting the stat cards render non-zero for seeded data; Logs renders all accounts; search finds a user on page 3.
- **Agent:** frontend

### Task 6: Logout correctness and session resurrection guards
- **Files:** `src/shared/components/TopNavLayout.jsx:121-124`; `src/shared/context/AuthProvider.jsx:76-102` (already has loadSeq on SIGNED_OUT, but `logout` does not); `src/shared/components/ProtectedRoute.jsx:12-16`; `src/App.jsx:222-235`.
- **Issue:** `handleLogout` not awaited; `logout` doesn't bump `loadSeq`/clear `signedInId` (Task 3 covers the core; this task covers the remaining call sites and the `active`-flag cleanup on `ProtectedRoute`/`PublicRoute`).
- **Fix:** await logout everywhere; add `active` guards to prevent `setState` after unmount; clear `NotificationBell` module cache on user change/logout.
- **Verify:** no console errors on logout; no stale user after rapid logout/login.
- **Agent:** frontend

### Task 7: Employer email-verification role routing
- **Files:** `src/features/auth/AuthCallback.jsx:23-34`
- **Issue:** employer clicks the verification link → "account role could not be determined" if `profile?.role` is null on first check.
- **Fix:** ensure provisioning completes and re-read profile before the role check; route via `PORTALS`. Add a retry/await.
- **Verify:** employer verification-link flow lands on the employer portal, not an error.
- **Agent:** frontend

### Task 8: Job delete updates totals and pagination
- **Files:** `src/features/employer/JobPosts.jsx:316-327`
- **Issue:** `setJobs` filters but `total` is unchanged → pager shows a phantom page; empty table with stale total when deleting the last row on a page.
- **Fix:** `setTotal((t) => Math.max(0, t - 1))` and clamp the page (if current page exceeds new total pages, go back one page).
- **Verify:** delete the last row on page 2 → table shows page 1's rows; total decrements.
- **Agent:** frontend

### Task 9: AuthProvider stale-profile / overlapping-session races
- **Files:** `src/shared/context/AuthProvider.jsx:21-68` (`loadProfile`)
- **Issue:** overlapping `SIGNED_IN` loads (user A slow, B fast) can let A's late response win; the `setUser` updater doesn't check `sessUser.id === signedInId.current`.
- **Fix:** in the `setUser` updater, bail unless `sessUser.id === signedInId.current` (track target id). Also clear `user` on 401/403 refetch failure (security finding #16).
- **Verify:** two overlapping loads resolve in the correct order; failed refetch on 401 clears user.
- **Agent:** frontend

### Task 10: `useAFKTimer` re-subscription on unstable `onWarning`
- **Files:** `src/shared/hooks/useAFKTimer.js:33,60`
- **Issue:** `onWarning` in the dependency array tears down/re-adds document listeners and resets timers every render when the parent passes an inline handler.
- **Fix:** store `onWarning` in a ref (mirror `useDialog`).
- **Verify:** re-render with a new inline handler does not reset the AFK timer.
- **Agent:** frontend

### Task 11: `Profile` resumes effect lacks cancellation; `CompanyProfile` form not re-synced
- **Files:** `src/features/job-seeker/Profile.jsx:101-107`; `src/features/employer/CompanyProfile.jsx:55-88`
- **Issue:** `listResumes(...).then(setResumes)` has no `cancelled` guard → state update after unmount. `CompanyProfile` form initialized once from `getEmployer()` and stays stale after `refreshUser`.
- **Fix:** add `let live` guard + cleanup in Profile; re-run hydration in CompanyProfile when `user` identity changes (guard with `company?.id`).
- **Verify:** unmount during fetch doesn't warn; company profile refreshes after external change.
- **Agent:** frontend

### Task 12: `openResume` revokes object URL after 60 s (breaks "View")
- **Files:** `src/shared/components/UserManagement.jsx:194-208`; `src/features/job-seeker/Profile.jsx:42-66`
- **Issue:** `setTimeout(() => URL.revokeObjectURL(url), 60_000)` can revoke while a PDF tab is still open.
- **Fix:** revoke on tab close or skip revoke (browser cleans up on navigation). Prefer skipping revoke for blob URLs handed to a new tab.
- **Verify:** open a resume PDF, wait >60 s, tab still renders.
- **Agent:** frontend

### Task 13: `JobsBrowser` AI match effect over-fires
- **Files:** `src/shared/components/JobsBrowser.jsx:88-107`
- **Issue:** deps include `candidates`/`filters`/`page`, so matching re-runs on filter/page changes even when the prompt is unchanged, burning requests.
- **Fix:** remove `page`/`filters` from deps (keep `candidates`, `matchingPrompt`).
- **Verify:** changing the page does not trigger a new match request.
- **Agent:** frontend

### Task 14: `useCaptcha` unavailable flag never resets
- **Files:** `src/shared/hooks/useCaptcha.js:19-22`
- **Issue:** `fail()` sets `unavailable=true` permanently; if the widget recovers, the form still treats captcha as optional.
- **Fix:** reset `unavailable=false` on `reset()`.
- **Verify:** after `reset()`, captcha is required again.
- **Agent:** frontend

### Task 15: `Applicants` list effect lacks cancellation
- **Files:** `src/features/employer/Applicants.jsx:157-163`
- **Issue:** `listByCompany(...).then(set...)` has no `cancelled` guard; late responses overwrite newer state on fast navigation.
- **Fix:** add `cancelled` guard (mirror `Applications.jsx`).
- **Verify:** rapid navigation doesn't show stale applicants.
- **Agent:** frontend

### Task 16: Backend input-validation gaps (500s on bad input)
- **Files:** `server/src/routes/jobs.js:260-263` (POST), `:306` (PATCH), `:78-83` (GET filter), `:92-94` (salaryMin `'0'`); `server/src/routes/profiles.js:45-52` (skills/birthdate), `:383-399` (seeker children years); `server/src/routes/applications.js:148-164` (interviewAt); `server/src/routes/admin-users.js:112-122` (status/custom_role_id); `server/src/routes/admin-reference.js:140-145` (delete scope).
- **Issue:** allow-listed columns are written without validating enums, types, ranges, or dates, so malformed input reaches Postgres and surfaces as 500 (or silently returns empty for `employmentType`).
- **Fix:** validate `vacancies` (positive int), salary range (`min <= max`), `deadline` (date), `employmentType` against `EMPLOYMENT_TYPES`, `skills` (array or null → `[]`), `birthdate` (date), `start_year`/`end_year` (int), `interviewAt` (ISO timestamptz), `status` ∈ `ACCOUNT_STATUSES`, `custom_role_id` (null or existing custom_role), and salary-min filter on `!= null && !== ''`. POST `/jobs` accepts only `{draft, published}` for `status`. `admin-reference` DELETE restricts to settings-managed categories (or routes custom roles through `/admin/roles/:id`).
- **Verify:** each malformed input returns 400 with a clear code; add unit tests per field.
- **Agent:** backend

### Task 17: Role-move drops `custom_role_id`
- **Files:** `server/src/routes/admin-users.js:244-251`
- **Issue:** the upsert target row carries only `id, email, full_name, status`; a user with a custom role loses it on role move.
- **Fix:** carry `custom_role_id` over when the base role matches (or explicitly document the drop in the contract). Prefer carrying over.
- **Verify:** move a tagged user; the tag survives.
- **Agent:** backend

### Task 18: Resume quota race (off-by-one up to 21)
- **Files:** `server/src/routes/profiles.js:277-283`
- **Issue:** `resumeQuota` counts before acquiring the advisory lock; two concurrent uploads can both pass the 20-resume quota.
- **Fix:** move the count inside the transaction/lock.
- **Verify:** concurrent uploads beyond the quota are rejected.
- **Agent:** backend

### Task 19: `aiMatch` DB failure should degrade, not 500
- **Files:** `server/src/ai/aiMatch.js:100-108`
- **Issue:** `buildMatch` runs two DB queries; if either throws, the route returns 500, contradicting the comment that deterministic covers failures (only provider/parse failures are swallowed).
- **Fix:** wrap the pool queries in try/catch and return the deterministic ranking on failure.
- **Verify:** mocked DB error → 200 `mode: "deterministic"`.
- **Agent:** backend

### Task 20: Retention purge and timer hygiene
- **Files:** `server/src/routes/admin.js:154-167` (`runRetentionPurge`, `setInterval` on import); `server/src/routes/admin.js:193-195` (actor_email exposure); `server/src/routes/admin.js:217-229` (system notification size caps).
- **Issue:** purge deletes without a transaction (minor race); the `setInterval` arms on module import in tests unless `RETENTION_DISABLE=1` (documented in Task 22); system notifications accept unbounded `title`/`message`/`link`.
- **Fix:** wrap purge in `withTransaction`; add length caps (title ≤ 200, message ≤ 2000, link ≤ 500) returning 400; keep the timer but ensure it is `.unref()`'d (already) and documented.
- **Verify:** oversized notification → 400; purge runs transactionally.
- **Agent:** backend

### Task 21: Suspended users must not provision or audit
- **Files:** `server/src/auth.js:141-147` (`tokenAuth`); `server/src/routes/admin.js` (audit endpoint).
- **Issue:** `tokenAuth` skips status and provisioned-row checks, so a suspended account can still post audit events (and provision).
- **Fix:** check status for audit; keep provision exempt (fresh sessions have no row by definition). Gate audit on active status.
- **Verify:** suspended token → 403 on `/api/audit`.
- **Agent:** backend

### Task 22: Custom-role absence must not grant full admin (defense-in-depth)
- **Files:** `server/src/middleware/permissions.js:10-11,19`; `server/src/auth.js` (resolveRole already loads `custom_role_id` + permissions).
- **Issue:** `if (!req.user.customRoleId) return next();` treats a missing `custom_role_id`/`permissions` (seeded/legacy row) as full access. ADR-036 says bundles are descriptive, but the absence should not silently bypass; resolve fields in `auth()` and fail closed unless explicitly system-admin.
- **Fix:** in `auth()`, set `customRoleId`/`permissions` from `resolveRole`; in `requirePermission`, treat `customRoleId === null && permissions.length === 0` as system-admin only when an explicit flag is set, else require a permission key. Coordinate with ADR-036 (documented decision).
- **Verify:** a custom role with an empty bundle is denied; system admin (no custom role, seeded) retains full access.
- **Agent:** backend + security-auditor (review)

### Task 23: CORS dev-origin gating
- **Files:** `server/src/app.js:65-69`
- **Issue:** `devOrigin` regex is appended whenever `NODE_ENV !== 'production'`, so a deployment that forgets `NODE_ENV=production` accepts any localhost port cross-origin.
- **Fix:** gate dev origins on an explicit `DEV_CORS=1` (or `NODE_ENV === 'development'`) flag, not on "not production".
- **Verify:** with `NODE_ENV=production` and no `CORS_ORIGIN`, no dev origin is accepted.
- **Agent:** backend

### Task 24: Resolve the deleted report types (F-05)
- **Files:** `src/features/super-admin/Reports.jsx:6-11`; `server/src/routes/reports.js`; `docs/plan/done/2026-10-09-ponytail-cleanup.md:48`.
- **Issue:** 4 of 7 report types were deleted with no ADR; the server CSV export still exists and is tested but has no client caller.
- **Fix:** either restore the types (server + client) or record the deletion as a decision (ADR). Decide with the product owner; default = record the decision (YAGNI) and remove the dead server export + client wrapper.
- **Verify:** either all 7 types render, or the contract doc + code agree on the reduced set.
- **Agent:** frontend (decision) + backend

### Task 25: `pageParams` empty-string handling
- **Files:** `server/src/util.js:70-75`
- **Issue:** `page=0` is coerced to default 1 instead of 400; empty string counts as absent (documented, keep) but `0` should be a client error.
- **Fix:** treat `0`/negative/non-integer as 400 (already does for non-integer; `0` passes the integer check then fails `< 1`). Wait — `page < 1` already catches 0. Re-check: `if (!Number.isInteger(page) || page < 1)` → 0 fails `page < 1`. So 0 is already 400. The finding is about empty string counting as absent → default, which is documented behavior. Keep as-is; no change. (Closed as no-op; retained for traceability.)
- **Agent:** none

---

## Medium (UX / a11y / data flow / ops)

### Task 26: Frontend cleanup of stale closures and missing cancellation
- **Files:** `src/features/job-seeker/JobDetail.jsx:79-90` (double-submit guard); `src/features/employer/Applicants.jsx:157-163` (Task 15); `src/shared/components/NotificationBell.jsx:15-30` (cache survives logout); `src/shared/components/JobsBrowser.jsx:88-107` (Task 13).
- **Fix:** guard `handleApply` with `if (applying) return`; clear `NotificationBell` cache on user change/logout.
- **Verify:** no double apply; cache cleared on logout.
- **Agent:** frontend

### Task 27: E2E and smoke coverage (the user's "do everything" ask)
- **Files:** `.github/workflows/ci.yml`; `scripts/system-check.mjs`; `scripts/smoke.mjs`; `db/seed-dev.sql`.
- **Issue:** no E2E/smoke job in CI; `npm run smoke` exits 0 on SKIP (vacuous pass); public sweep has no functional assertions.
- **Fix:** add a CI job that builds, starts preview+API, applies `db/seed-dev.sql`, runs `npm run smoke` with Supabase creds (at minimum `npm run syscheck`). Make explicit smoke invocation fail unless `SMOKE_SKIP=1`; keep skip only for the default public sweep. Add key DOM assertions per route.
- **Verify:** CI runs smoke; a broken public route fails CI.
- **Agent:** devops-engineer + frontend

### Task 28: Migration contract test must actually run
- **Files:** `db/migrations/002_acid_gaps.test.js`; root/server vitest include globs.
- **Issue:** the test file is collected by no glob, so migration-guard regressions go unnoticed.
- **Fix:** add `db/**/*.test.js` to the root/server vitest include, or move the file under `server/src/__tests__/`.
- **Verify:** `npm test` collects and runs it.
- **Agent:** devops-engineer

### Task 29: Backup uploads must honor `UPLOAD_DIR`
- **Files:** `scripts/backup-uploads.mjs:15`
- **Issue:** hardcodes `server/uploads`; production with an overridden `UPLOAD_DIR` is missed → restore 404s.
- **Fix:** resolve from env/`server/.env` like `backup.sh`; fail loudly if unset.
- **Verify:** with `UPLOAD_DIR` set, the backup includes those files.
- **Agent:** devops-engineer

### Task 30: Document `RETENTION_DISABLE` and other undocumented env
- **Files:** `server/.env.example`; `server/src/routes/admin.js:164`.
- **Issue:** `RETENTION_DISABLE` is used but undocumented.
- **Fix:** add it (and any other missing keys) to `.env.example` with a one-line description.
- **Verify:** grep env usage vs `.env.example` matches.
- **Agent:** devops-engineer

### Task 31: Schema/migration drift
- **Files:** `db/schema.sql` (no `schema_migrations` table) vs `db/migrations/011_schema_migrations.sql`.
- **Issue:** DBs bootstrapped from `schema.sql` lack the ledger; parity checks drift.
- **Fix:** add `create table if not exists public.schema_migrations` to `schema.sql`, or document the baseline reconciliation.
- **Verify:** bootstrap from `schema.sql` then run `apply-migrations.sh` is a no-op.
- **Agent:** backend

### Task 32: Remove hardcoded dev credentials from scripts
- **Files:** `scripts/e2e-role-walkthrough.mjs:32-55`; `scripts/compare-*-pages.mjs:37`.
- **Issue:** known passwords (`Spike!Seek100!`, etc.) in committed scripts; running against a non-dev project creates accounts with known passwords.
- **Fix:** generate random passwords per run (mirror `system-check.mjs`) or gate scripts to localhost.
- **Verify:** scripts no longer contain literal passwords.
- **Agent:** devops-engineer

### Task 33: CI ordering and duplicate advisory step
- **Files:** `.github/workflows/ci.yml:41,45,51,59`
- **Issue:** build runs before integration tests (a broken build skips the real-Postgres slice); duplicate "Resume autofill eval (advisory)" step.
- **Fix:** run integration tests before/parallel to build; remove the duplicate advisory step.
- **Verify:** CI runs both; no duplicate step.
- **Agent:** devops-engineer

### Task 34: Complete ledger reconciliation in `apply-migrations.sh`
- **Files:** `db/apply-migrations.sh` (empty-ledger branch).
- **Issue:** probes only 004/007/008/009; legacy DBs re-run other migrations whose guards mostly prevent harm but aren't explicitly reconciled.
- **Fix:** extend probes to cover 002/005/006, or document the reconciliation set.
- **Verify:** running against a legacy DB reconciles cleanly.
- **Agent:** devops-engineer

### Task 35: `.gitignore` and secrets hygiene
- **Files:** `.gitignore`; `.env.example`.
- **Issue:** root `.env` is not gitignored (only `server/.env` and `*.local`); committed Supabase project URL/anon key in `.env.example`.
- **Fix:** add `.env` to `.gitignore`; replace committed values in `.env.example` with placeholders.
- **Verify:** `git check-ignore .env` returns it; `.env.example` has no real values.
- **Agent:** devops-engineer

### Task 36: Upload persistence on Vercel (documentation)
- **Files:** `vercel.json` (server service); `db/README.md`.
- **Issue:** serverless restart wipes `UPLOAD_DIR`; backups must be off-host.
- **Fix:** document the external-storage/backup requirement (or configure a persistent volume). No code change unless storage is added.
- **Verify:** doc updated; smoke confirms restore path.
- **Agent:** devops-engineer

### Task 37: Flaky fixed sleeps in tests
- **Files:** `src/features/auth/__tests__/JobSeekerRegister.test.jsx` (`setTimeout(r,50)`); `src/features/public-site/__tests__/PublicJobDetail.cleanup.test.jsx` (`50ms`); `server/src/routes/aiMatch.test.js` (`30ms`).
- **Issue:** fixed sleeps flake on slow CI.
- **Fix:** replace with `waitFor`/polling.
- **Verify:** tests pass under a throttled CPU.
- **Agent:** tester

### Task 38: Client-side profile children fetches and a11y polish
- **Files:** `src/shared/components/TopNavLayout.jsx:313-324` (AFK modal focus); `src/shared/components/ProtectedRoute.jsx`; `src/App.jsx:222-235`.
- **Issue:** AFK warning modal doesn't move focus to "Stay signed in"; `ProtectedRoute`/`PublicRoute` logout promises have no cancellation.
- **Fix:** move focus to the primary button; add `active` guards.
- **Verify:** focus lands on the primary button on open; no setState-after-unmount warnings.
- **Agent:** frontend

---

## Low (cosmetic / deferred)

### Task 39: Dead `exportReport` client wrapper
- **Files:** `src/shared/services/admin.js:122`
- **Issue:** no client caller; server endpoint still exists and is tested.
- **Fix:** delete the client wrapper (keep the endpoint only if it's a documented deliverable — per contract it is a documented deliverable, so keep the endpoint, delete the wrapper).
- **Verify:** lint passes; no broken imports.
- **Agent:** frontend

### Task 40: Scratch artifacts at repo root
- **Files:** `test-final.txt`, `dbcheck.cjs`, `new_landing_page/` (if still present).
- **Issue:** untracked scratch artifacts; `dbcheck.cjs` reads `DATABASE_URL` from `server/.env`.
- **Fix:** delete them (verify nothing imports them first).
- **Verify:** `git status` clean of scratch files.
- **Agent:** unused-code-cleaner

### Task 41: Contract doc drift (admin surface)
- **Files:** `docs/arch/rework/02-api-contract.md`
- **Issue:** documented 7 keys for `/admin/stats` (actual 14+), missing `/admin/permissions`, custom-role CRUD, invite, role move, custom-role tag, admin job edit/publish, system notifications, health, employers dashboard, DELETE jobs (ADR-013), export endpoint.
- **Fix:** reconcile the doc with the code (additive; do not change behavior).
- **Verify:** every endpoint in `server/src/routes/*.js` appears in the contract.
- **Agent:** api-documenter

### Task 42: AuthProvider keeps stale user on fetch failure
- **Files:** `src/shared/context/AuthProvider.jsx:58-67`
- **Issue:** on a failed refetch, `user` is kept (intentional for transient failures), but on 401/403 it should clear.
- **Fix:** clear `user` when the error status is 401/403.
- **Verify:** 401 refetch → user cleared.
- **Agent:** frontend

---

## Additional findings (fresh audit pass, 2026-11-11)

The second independent pass (security, frontend, ops) converged on the same core set plus the following new items. Each is appended to the work packages below.

### Critical (new)

#### Task 43: Supabase `notify_admins` RPC must not be callable by authenticated users
- **Files:** `supabase/migration.sql:743` (grant), `supabase/security-fixes.sql:113` (revoke)
- **Issue:** `grant execute on function public.notify_admins(text,text,text,text) to authenticated` lets any signed-in user invoke the RPC and spam admins / inject content. security-fixes.sql revokes it but migration.sql re-grants it.
- **Fix:** revoke from `authenticated`; grant only to service role; reconcile both files.
- **Agent:** backend + security-auditor (review)

#### Task 44: Sync missing columns into `db/schema.sql`
- **Files:** `db/schema.sql` (reference_data, job_seekers), `db/migrations/003_seeker_consents.sql`, `db/migrations/005_custom_roles.sql`
- **Issue:** `schema.sql` lacks `details jsonb` on `reference_data` and `referral_opt_in` on `job_seekers`, which migrations add. Integration DB is built from `schema.sql`, so custom-role reads (`details->>'base_role'`) and referral data fail there.
- **Fix:** add both columns to `schema.sql`.
- **Agent:** backend

#### Task 45: Make `004_remove_shortlisted.sql` recoverable
- **Files:** `db/migrations/004_remove_shortlisted.sql`; `db/apply-migrations.sh` (reconciliation probes)
- **Issue:** one-shot enum type swap; a partial failure leaves `application_status_new` and a rerun breaks. apply-migrations.sh only reconciles 004/007/008/009.
- **Fix:** add an explicit repair path (drop leftover `_new` type if present before re-running) and extend reconciliation probes.
- **Agent:** backend

#### Task 46: Vercel ephemeral filesystem for uploads
- **Files:** `vercel.json` (server service); `server/src/upload.js`; `db/README.md`
- **Issue:** disk writes (resumes/documents) vanish on cold start/recycle → 404s after redeploy.
- **Fix:** move file storage to Vercel Blob/S3 or host the API on a persistent VM; document the requirement. No code change unless storage is added.
- **Agent:** devops-engineer

### High (new)

#### Task 47: Restrict RLS on `employers` and `reference_data`
- **Files:** `supabase/migration.sql:288` (`employers_select using (true)`), `:317` (`reference_select using (true)`)
- **Issue:** any authenticated user can `select *` from `employers` (phone, email, representative data) and enumerate custom-role permission bundles.
- **Fix:** restrict `employers_select` to own row or admin; restrict `custom_role` rows in `reference_data` to super-admins.
- **Agent:** backend + security-auditor (review)

#### Task 48: Dashboard viewer must not read all company PII
- **Files:** `server/src/routes/admin.js:61-74` (`/admin/companies`)
- **Issue:** a custom role holding only `dashboard.view` can list every employer row including contact PII.
- **Fix:** scope the select to non-sensitive columns for non-privileged viewers, or require `users.manage`.
- **Agent:** backend

#### Task 49: `verify-live.mjs` must not delete jobs against production
- **Files:** `server/scripts/verify-live.mjs:24-26,131`
- **Issue:** connects to the `DATABASE_URL`-derived bench DB and deletes `job_vacancies` with no guard against prod host/DB.
- **Fix:** require DB name suffix `_bench`/host allowlist and refuse otherwise.
- **Agent:** devops-engineer

#### Task 50: `apply-migrations.sh` DB-name validation (SQL injection)
- **Files:** `db/apply-migrations.sh:49-54`
- **Issue:** `create database "${name}"` interpolates the URL pathname; only checks `endsWith('_test')`.
- **Fix:** validate name against `^[A-Za-z0-9_]+_test$`.
- **Agent:** devops-engineer

#### Task 51: `TRUST_PROXY` must be set behind Vercel
- **Files:** `vercel.json`; `server/src/app.js` (default 0); `server/.env.example`
- **Issue:** behind Vercel's proxy with default 0, all IP-keyed limiters collapse to the proxy IP (site-wide self-DoS).
- **Fix:** set `TRUST_PROXY=1` in deployment env and document it.
- **Agent:** devops-engineer

#### Task 52: PublicRoute stale `done` flag skips logout for later signed-in users
- **Files:** `src/App.jsx:222-234`
- **Issue:** `done` becomes true after the first visitor's logout; a second user signing in later and visiting a public route never logs out.
- **Fix:** reset `done` when `user?.id` changes (`useEffect(() => setDone(false), [user?.id])`).
- **Agent:** frontend

#### Task 53: Resume set-active/delete failures are unhandled
- **Files:** `src/features/job-seeker/Profile.jsx:232-241`
- **Issue:** `setActiveResume`/`deleteResume` have no try/catch; a failed request leaves the UI mid-action with an unhandled rejection.
- **Fix:** wrap in try/catch, surface error state, mutate local state only on success.
- **Agent:** frontend

#### Task 54: Job-post search only filters the current server page
- **Files:** `src/features/employer/JobPosts.jsx:329-342`
- **Issue:** searching a term that exists on another page returns "no matches".
- **Fix:** pass `search` to `listEmployerJobs` (server-side) or load all rows.
- **Agent:** frontend

#### Task 55: Admin stats capped at the first 500 users
- **Files:** `src/features/super-admin/UserManagement.jsx:111-123`
- **Issue:** stat cards undercount once the system exceeds 500 accounts.
- **Fix:** fetch aggregate stats endpoint or paginate to completion.
- **Agent:** frontend

#### Task 56: Accreditation validation must not use `alert()`
- **Files:** `src/features/employer/EmployerAccreditation.jsx:86-88`
- **Issue:** blocking native dialog is inaccessible/annoying; no inline field error.
- **Fix:** set inline error state per field.
- **Agent:** frontend

#### Task 57: Consent checkboxes must be marked invalid for highlight
- **Files:** `src/features/auth/JobSeekerPersonalStep.jsx`
- **Issue:** "scroll to first error" cannot highlight personal fields.
- **Fix:** add `aria-invalid`/`data-invalid` to error wrappers or inputs.
- **Agent:** frontend

### Medium (new)

#### Task 58: Mass assignment via `information_schema` allowlist
- **Files:** `server/src/routes/admin-users.js:112-122`
- **Issue:** admin with `users.manage` can PATCH any column of any role table (including `accreditation_status`, `status`, `custom_role_id`), bypassing accreditation review and reactivating accounts.
- **Fix:** replace dynamic allowlist with an explicit editable-field list; validate `status`/`accreditation_status` against enums.
- **Agent:** backend

#### Task 59: Permission boundary on reference-data delete + category allowlist on create
- **Files:** `server/src/routes/admin-reference.js:22, 140-145`
- **Issue:** an admin holding only `settings.manage` can delete custom roles (bypassing `roles.manage` and the unassignment flow); `POST /admin/reference/:category` can create rows under reserved categories (e.g. `custom_role`) with null details.
- **Fix:** gate custom_role deletions on `roles.manage`; allowlist categories on create.
- **Agent:** backend

#### Task 60: Invite `app_metadata` must be set before the email is sent
- **Files:** `server/src/routes/admin-users.js:178-204`
- **Issue:** if `updateUserById` fails, the invite is already delivered with `role` in user_metadata but no `app_metadata.role`.
- **Fix:** set app_metadata before sending the invite, or roll back the invite on failure. (Already partially covered by Task 2; this task tracks the ordering.)
- **Agent:** backend

#### Task 61: CSV formula injection: trim before testing
- **Files:** `server/src/routes/reports.js:97-101`
- **Issue:** a cell with leading whitespace before `=` (e.g. ` =cmd`) is not prefixed.
- **Fix:** trim before testing, or test the first non-space character.
- **Agent:** backend

#### Task 62: Pre-auth AI resume extraction needs stronger throttling
- **Files:** `server/src/routes/ai.js:56`
- **Issue:** unauthenticated callers spend AI budget (10/hour/IP); NAT'd users share one bucket.
- **Fix:** add a CAPTCHA or reduce the limit; acceptable as-is for low traffic (document the ceiling).
- **Agent:** backend

#### Task 63: Sanitize stored document filename
- **Files:** `server/src/routes/profiles.js:211-212`
- **Issue:** `file.originalname` is stored verbatim and later emitted in `Content-Disposition`.
- **Fix:** sanitize/strip control chars at store time (already done for the on-disk name).
- **Agent:** backend

#### Task 64: `docx` signature accepts any ZIP
- **Files:** `server/src/upload.js:50`
- **Issue:** a malicious ZIP/JAR renamed `.docx` passes validation.
- **Fix:** validate the OOXML `[Content_Types].xml` entry, or keep forced download disposition.
- **Agent:** backend

#### Task 65: Unpaginated admin lists
- **Files:** `server/src/routes/admin.js:102-125` (`/admin/employees`, `/admin/referrals`)
- **Issue:** unbounded response (DoS / data dump).
- **Fix:** add `pageParams` pagination.
- **Agent:** backend

#### Task 66: Arbitrary reference-data category on create
- **Files:** `server/src/routes/admin-reference.js:22`
- **Issue:** allows creating rows under reserved categories (e.g. `custom_role`) with null details.
- **Fix:** allowlist categories on create.
- **Agent:** backend

#### Task 67: Lint ops scripts (`.mjs`)
- **Files:** `eslint.config.js:10-19`
- **Issue:** `.mjs` scripts are not linted.
- **Fix:** include `**/*.{mjs}` in the lint glob.
- **Agent:** devops-engineer

#### Task 68: `backup.sh` dangerous `rm -rf` with env-controlled root
- **Files:** `scripts/backup.sh:82-83`
- **Issue:** wrong `BACKUP_DIR` deletes an arbitrary tree.
- **Fix:** validate/whitelist root.
- **Agent:** devops-engineer

#### Task 69: `backup-uploads.mjs` shells out to `tar`
- **Files:** `scripts/backup-uploads.mjs:26`
- **Issue:** `tar` unavailable on Windows dev.
- **Fix:** use a Node archiver or document the dependency.
- **Agent:** devops-engineer

#### Task 70: Smoke exits 0 on skip
- **Files:** `scripts/smoke.mjs:9`; `scripts/system-check.mjs` (smoke path)
- **Issue:** CI can't detect missing env; flaky `waitForNetworkIdle` + fixed sleeps.
- **Fix:** exit non-zero when `CI=true` and skipped; add retry/backoff and deterministic waits.
- **Agent:** devops-engineer

#### Task 71: `002_acid_gaps` backfill non-idempotent remarks
- **Files:** `db/migrations/002_acid_gaps.sql`
- **Issue:** rerun after partial failure has no idempotency key on remarks.
- **Fix:** make the backfill idempotent (skip if a backfilled row already exists).
- **Agent:** backend

### Low (new)

#### Task 72: Invite modal overlay dismisses on outside click without confirming
- **Files:** `src/features/super-admin/UserManagement.jsx:440`
- **Issue:** stray click closes an in-progress invite form; data lost.
- **Fix:** require explicit Cancel or guard with a dirty check.
- **Agent:** frontend

#### Task 73: `ConfirmationModal` has no `aria-labelledby` title
- **Files:** `src/shared/components/ConfirmationModal.jsx:12-14`
- **Issue:** screen readers announce the dialog without a title.
- **Fix:** add `aria-labelledby` pointing to a title element.
- **Agent:** frontend

#### Task 74: Employer accreditation notice dismissed state persists across user switch
- **Files:** `src/features/employer/EmployerLayout.jsx:34`
- **Issue:** after dismissing the notice, a different employer session still sees it dismissed.
- **Fix:** key dismissed state by `user?.id`.
- **Agent:** frontend

---

## Updated work packages → agents

| WP | Tasks | Agent |
|---|---|---|
| A | 1, 16, 17, 18, 19, 20, 21, 22, 23, 25, 31, 43, 44, 45, 47, 48, 58, 59, 60, 61, 62, 63, 64, 65, 66, 71 | backend |
| B | 2, 43 (review), 47 (review) | backend + security-auditor |
| C | 3, 6, 9, 10, 11, 12, 13, 14, 15, 26, 38, 42, 52, 53, 54, 55, 56, 57, 72, 73, 74 | frontend |
| D | 4, 5, 7, 8, 24, 46, 49, 50, 51, 67, 68, 69, 70 | devops-engineer + frontend |
| E | 27, 28, 29, 30, 32, 33, 34, 35, 36, 37, 39, 40, 41 (unchanged) | devops-engineer + tester + api-documenter + unused-code-cleaner |

Sequencing unchanged: A (Task 1) first, then B ∥ C ∥ D ∥ E.

**Verification gate** extended: each new task adds the smallest test that would fail without it; RLS/policy changes verified against the Supabase schema; `apply-migrations.sh` validated against a legacy DB.

**Plan complete and saved to `docs/plan/2026-11-11-bug-hunt-plan.md` (now 74 tasks). Please review. Which execution approach?** Subagent-driven (recommended) or Native.


- Duplication register D2–D9 (`docs/arch/audit/phase6-code-review.md` §5): 3-table role union, job status writer, `SEEKER_COLS`, job column/status sets, ownership guard, `loadJob`, notification fan-out insert, frontend metadata normalisation. Refactor only when next touched.
- `employer/JobPosts.jsx` is still ~585 lines (split-on-touch policy applies).
- `attachPrincipal` runs on every `/api` request (accepted; documented in contract).
- In-memory rate-limit store (accepted; Redis when scaling).

## Verification gate (every task, then whole repo)

- `npm test` green (client).
- `npm --prefix server test` green (server) — currently blocked by Task 1.
- `npm run lint` clean.
- `npm run build` green.
- `npm --prefix server run test:integration` green (6/6) where Postgres is available.
- `npm run syscheck` green; `npm run smoke` green where Supabase creds present.
- For each fix, the smallest test that would fail without the fix is added or updated (TDD).

## Work packages → agents

| WP | Tasks | Agent | Notes |
|---|---|---|---|
| A | 1, 16, 17, 18, 19, 20, 21, 22, 23, 25, 31 | backend | Task 1 first (unblocks the suite). |
| B | 2 | backend + security-auditor (review) | Supabase trigger + local auth gate. |
| C | 3, 6, 9, 10, 11, 12, 13, 14, 15, 26, 38, 42 | frontend | Auth/session correctness first. |
| D | 4, 5, 7, 8, 24 | frontend + backend | Server enforcement + UI. |
| E | 27, 28, 29, 30, 32, 33, 34, 35, 36, 37, 39, 40, 41 | devops-engineer + tester + api-documenter + unused-code-cleaner | Ops/E2E/docs/cleanup. |

Sequencing: A (Task 1) first to unblock the suite, then B ∥ C ∥ D ∥ E.

## Out of scope (do not touch in this plan)

- Dark mode (retired by owner decision; spec retained).
- Monthly PESO Report (blocked on official template — G14).
- i18n (cut).
- Skills/barangays/reports tables (cut).
- HTTPS/TLS, DB/file backup (deploy-layer).
- Any feature work not listed above.

---

**Sign-off:** Lead Architect, 2026-11-11. This plan is the contract; nothing alters a schema, API, or shared state outside it without a fresh ADR. Backend/frontend/ops agents may begin only after the human partner approves this plan and selects an execution method.

**Plan complete and saved to `docs/plan/2026-11-11-bug-hunt-plan.md`. Please review. Which execution approach would you prefer?**

- **Subagent-driven** — a fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough.
- **Native** — I implement every task myself in this session, then one fresh reviewer checks the whole branch. Cheapest and fastest.

For this plan I recommend **subagent-driven**, because the 42 tasks span 5 independent work packages across backend/frontend/ops with clear interface boundaries, and a shipped mistake in Task 1 or Task 2 (API boot, privilege escalation) is high-cost. Does the plan capture what you want, and which approach should we use?
```diff
+ Done — wrote the consolidated bug-hunt plan to docs/plan/2026-11-11-bug-hunt-plan.md (42 tasks, 5 work packages, verification gate); no code changed.

## Implementation results (2026-11-11)

All work packages executed (subagent-driven). Verification gate passed:

- 
pm test - 1172 passed | 6 skipped (1178), 193 files.
- 
pm --prefix server test - 590 passed | 6 skipped (596), 79 files.
- 
pm run lint - 0 errors, 0 warnings.
- 
pm run build - green (750ms).

Work packages:
- A (backend): Tasks 1-2, 16-23, 31, 43-45, 47-48, 58-66, 71 - done.
- B (security): Task 2 (trigger + auth gate + invite ordering) - done.
- C (frontend): Tasks 3, 6, 9-15, 26, 38, 42, 52-57, 72-74 - done; 8 test regressions aligned (commit bcc80b4).
- D (ops+frontend): Tasks 27-30, 32-37, 39-41, 46, 49-51, 67-70 - done.
- E (docs/cleanup): Tasks 39, 40, 41 - done.

No schema/platform changes: stack remains Vercel + Supabase auth + remote Postgres. Config/env additions only (TRUST_PROXY, .env.example keys, .gitignore).


## Additional change (2026-11-11): removed AI resume autofill (overengineering)

Per user request, the AI-based resume extraction feature was removed entirely. The client-side heuristic autofill (mapResumeText) remains the only path.

Removed:
- server/src/ai/resumeExtract.js + resumeExtract.test.js
- /api/ai/resume-extract route in server/src/routes/ai.js
- resumeExtractLimiter export in server/src/middleware/rateLimit.js
- extractResumeFields (unused) in src/shared/services/ai.js
- LLM mode (--mode=llm) from scripts/eval-autofill.mjs (heuristic-only now)
- resume-extract listing from docs/arch/rework/02-api-contract.md

AI help (/api/ai/help) and AI job matching (/api/ai/job-match) are untouched.
