# Full System Test — Findings & Fix Plan (2026-11-04)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the real issues a full-system pass found (CORS allowlist lock-out, unprovisioned-account dead end, no provisioned test fixture, repo hygiene), verified by the same gate that surfaced them.

**Architecture:** Four small, independent fixes. Frontend-only graceful fallback for unprovisioned accounts (API semantics stay strict); env-only CORS fix (code already supports comma lists); a `--ensure-provisioned` flag on the existing zero-dependency load harness; a git hygiene pass. No schema changes.

**Tech stack:** Vite/React 19 · Vitest · Express (server/) · zero new dependencies.

**Spec:** this file IS the spec — findings below were measured live on 2026-11-04 against the running system, not read from code.

## Global constraints

- JavaScript/JSX only (repo rule). No TypeScript.
- No DB schema changes; no new npm dependencies.
- API error semantics stay as they are (404/403 with JSON `error{code,message}` are correct); only the frontend learns to handle them.
- `CORS_ORIGIN` remains the single source of truth for allowed origins (code: `server/src/app.js:48` splits on comma).
- Every task ends with `npx eslint .`, `npx vitest run`, and (when server code changed) `npx vitest run --root server` green before its commit.

## Review Focus

1. **CORS partial-failure sting:** a wrong `CORS_ORIGIN` fails every app fetch **silently** — pages render chrome but all data is ERR_FAILED. Reasonable expectation: the server must warn at boot when the configured origin obviously doesn't include the request origin it is serving itself. Pinned in Task 1.
2. **Unprovisioned account:** a Supabase-authenticated user whose registration stalled catches a portal page that error-spams instead of saying "finish setting up." Reasonable expectation: one clear UI path to complete registration. Pinned in Task 2.
3. **Authed load data:** without a provisioned fixture, authed load numbers are meaningless (live run: 404:99 / 429:201, zero 200s). Reasonable expectation: the harness can self-provision once. Pinned in Task 3.
4. **Uncommitted work as data-loss:** 8 commits of the reference-redesign exist only on this disk. Pinned in Task 4.
5. **Preview-only CORS regression masked in dev:** dev (:5173) works, so this bug is invisible to daily dev work; the preview/predeploy pass must become routine so it stays caught. Pinned by Task 5 (optional smoke script).

## Findings (measured live 2026-11-04)

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| F-1 | **Medium** | `CORS_ORIGIN=http://localhost:5173` only. Vite preview on `:4173` (and any prod origin) gets preflight without ACAO → every `/api/*` fetch ERR_FAILED; `/jobs` page rendered zero cards | headless-Chrome smoke: preflight OPTIONS missing ACAO; `[reqfailed] …/api/jobs net::ERR_FAILED` |
| F-2 | **Medium** | Signed-in but not-provisioned Supabase account: `GET /api/notifications/mine` → **403 "Account not provisioned"**, `GET /api/auth/me` → **404 "Profile not found…"**; portal shell surfaces raw errors, no recovery path | direct probes with minted token after limiter restart |
| F-3 | Low | No provisioned fixture account exists → authed load slice degenerate (0 × 200) | `loadtest --label syscheck-auth` run |
| F-4 | Low | 8 unpushed commits (entire reference redesign); untracked scratch: `admin-page-diff.json`, `preview.html`, `scripts/compare-admin-pages.mjs`, `scripts/diff-admin-dashboard.mjs`; 4 unreferenced draft PNGs in `src/assets/` | `git status` |

**Verified healthy (no action):** lint clean · 871 frontend + 386 server tests · build 1.19s · jobs envelope `{jobs,total,page,pageSize}` matches contract · 401/403/404 auth semantics correct · loadtest 600 req @50: 789 req/s, p50 51ms, zero 5xx, correct 429 throttling · memory/event-loop stable · no component links to deleted `/portals` or portal-login routes (IA consolidation to `/login` is clean) · `docs/arch/rework/02-api-contract.md` accurate.

---

### Task 1: CORS allowlist covers preview + prod, and warns instead of failing silently

**Files:**
- Modify: `server/.env` (line 6), `server/.env.example`
- Modify: `server/src/app.js` (near the `corsOrigins` const, ~line 47–50)
- Test: `server/src/index.test.js` (extend the existing CORS describe, ~line 210)

**Interfaces:**
- Produces: `warnIfProdCorsMissing()` not required — keep it inline; the only contract is `corsOrigins` stays the array passed to `cors({ origin })`.

- [ ] **Step 1: Write the failing test** — in the existing CORS describe, add:

```js
it('honours every entry of the comma-separated CORS_ORIGIN list', async () => {
  // boot with CORS_ORIGIN = 'http://localhost:5173,http://localhost:4173'
  // preflight OPTIONS /api/health with Origin: http://localhost:4173
  expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4173');
});
```

- [ ] **Step 2: Run** `npx vitest run --root server -- src/index.test.js` → the comma-list test passes only if the current code already splits (verify; the **real** failing part is Step 3's guard).
- [ ] **Step 3: Add the boot warning in `app.js`**: after computing `corsOrigins`, if `process.env.NODE_ENV === 'production'` and `!corsOrigins` → `logger.warn` (existing zero-dep logger) `"CORS_ORIGIN unset in production — failing closed to localhost only"` once, not per request.
- [ ] **Step 4: Update env files**:
  - `server/.env` → `CORS_ORIGIN=http://localhost:5173,http://localhost:4173`
  - `server/.env.example` → document the comma list + "add your production origin here; unset in production = locked to localhost (warned at boot)"
- [ ] **Step 5: Run** full server suite + `npx vitest run --root server` → green; restart the dev API and re-run the headless smoke against `:4173` → `/jobs` now renders ≥1 job card and `[reqfailed]` list is empty.
- [ ] **Step 6: Commit** `fix: allow comma-separated CORS origins and warn when production is unconfigured`

### Task 2: Unprovisioned account gets a recovery path, not an error wall

**Files:**
- Modify: `src/shared/components/TopNavLayout.jsx` (the bootstrap fetch error path)
- Modify or create: `src/shared/lib/api.js` helper `isUnprovisioned(err)` — true when `err?.error?.code === 'FORBIDDEN' && /provisioned/i.test(err?.error?.message)`
- Test: `src/shared/components/__tests__/TopNavLayout.test.jsx` (or new `__tests__/TopNavLayout.unprovisioned.test.jsx`)

**Interfaces:**
- Consumes: backend contract — 403 `{error:{code:'FORBIDDEN',message:'Account not provisioned'}}` from `GET /api/notifications/mine`, 404 "Profile not found…" from `GET /api/auth/me` (unchanged).
- Produces: `isUnprovisioned(err)` used by any future caller; the recovery panel inside TopNavLayout.

- [ ] **Step 1: Failing test**: mock `listNotifications`/`getStats` to reject with the 403 payload above → render `<TopNavLayout>` → expect a "complete your registration" panel (visible heading) instead of the error toast, plus links "Job seeker registration" → `/register/job-seeker` and "Employer registration" → `/register/employer`. Run → FAIL.
- [ ] **Step 2: Implement**: in TopNavLayout's error state, branch on `isUnprovisioned(err)` to render the two-link panel (reuse the page's card styling and the register routes from `src/shared/constants.js` if the paths live there); other errors keep today's behavior.
- [ ] **Step 3: Run** `npx vitest run src/shared/components` → green; then full root suite.
- [ ] **Step 4: Commit** `feat(topnav): recover unprovisioned accounts with a finish-registration panel`

### Task 3: Provisioned test fixture so authed coverage is real

**Files:**
- Modify: `server/scripts/loadtest.mjs` (add `--ensure-provisioned`, next to `--mint-token`)
- Test: none beyond the harness's own smoke run (script change; verified by running it)

**Interfaces:**
- Produces: `node scripts/loadtest.mjs --mint-token --mint-email <email> --ensure-provisioned [--provision-role job-seeker|employer|super-admin]` — mints, checks `/api/auth/me` for 404 "Profile not found…", and (only then) calls `POST /api/auth/provision` with the registration payload for that role; writes nothing unless the account lacks a profile.

- [ ] **Step 1: Implement** the flag in `loadtest.mjs`: capture the profile-absent 404, then POST provision with the existing registration payload shape (firstName/lastName/email/role from constants) using the minted token; treat 409/"already provisioned" as success so re-runs are idempotent.
- [ ] **Step 2: Run** `node scripts/loadtest.mjs --mint-token --mint-email <fixture-email> --ensure-provisioned` → token mint + provision OK (one line in output).
- [ ] **Step 3: Re-run the authed slice** and record numbers here:

```
node scripts/loadtest.mjs --label syscheck-auth2 --requests 300 --concurrency 15 --xff \
  --route "auth:/api/auth/me" --route "auth:/api/notifications/mine"
```
Expected: 200s dominate; zero 404s; p95 < 500ms at this scale. (429s allowed only if a prior run's 15-min bucket is still hot — if so, restart the dev API first.)
- [ ] **Step 4: Commit** `feat(loadtest): ensure-provisioned fixture accounts for authed runs`

### Task 4: Git hygiene — protect the redesign work, retire dead scratch

**Files:** delete: `admin-page-diff.json`, `preview.html`; decide-and-delete-or-ignore: `scripts/compare-admin-pages.mjs`, `scripts/diff-admin-dashboard.mjs`; decide: 4 draft PNGs (`LOGO MEANING.png`, `Logo(1).png`, `logomobile.png`, `whitelogo(website).png`).

- [ ] **Step 1:** `git push origin main` (8 commits — the redesign suddenly becomes recoverable).
- [ ] **Step 2:** Delete the two pure artifacts (`admin-page-diff.json`, `preview.html`). Keep the two `scripts/*.mjs` reference-compare tools only if `plan/` or docs reference them; otherwise delete (they are one-off diff runs).
- [ ] **Step 3:** Ask the owner (user) per PNG: referenced nowhere in `src/` today (verified by grep) — delete or promote to use. Default: move to `.gitignore`d `assets_draft/`? No — simplest: delete if unreferenced; they are re-creatable from the design source.
- [ ] **Step 4:** Commit `chore: retire admin-page diff scratch and unused draft assets` (whatever survived), push.

### Task 5 (optional capstone): make the system smoke repeatable

**Files:**
- Create: `scripts/system-check.mjs` (headless-Chrome route smoke: boot `vite preview` check, hit the 11 public routes, assert header + non-blank body, collect console/page/requestfailed errors; reuse the browser-candidate paths from the smoke that ran this session)
- Modify: `package.json` — `"syscheck": "node scripts/system-check.mjs"`

- [ ] **Step 1:** Port the smoke script (temp-file version used for this test) into `scripts/`, add a `--base` flag, exit non-zero when `[reqfailed]`/`[pageerror]` lines appear.
- [ ] **Step 2:** Run `npm run syscheck` → all routes 200, zero failures.
- [ ] **Step 3:** Commit `feat(scripts): repeatable headless system smoke`.

## Execution order

Task 1 → Task 4 Step 1 (push immediately after the CORS fix is committed — protects the work) → Task 2 → Task 3 → Tasks 4 (rest) → Task 5. Tasks 1–3 are independent; only Task 3's load numbers depend on the API being freshly restarted.

## Out of scope (noted, not planned)

- Demo-data seeding (DB currently holds exactly 1 published job) — tell the team if showcase depth matters before the next demo.
- Browser-extension "font visibility level 2" and CORS console noise — client-side, not this repo.
- The dev API currently runs as a bare `node src/index.js` (PID will differ after Task 1's restart) — start it via `npm run dev:api` going forward so the `concurrently` dev setup stays canonical.
