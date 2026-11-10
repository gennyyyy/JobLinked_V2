# Testing Plan — what exists, what's missing, what to add

**For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
(after Lead Architect sign-off). Run after Plan 03 deletions so new tests don't
target soon-dead code.

**Goal:** A layered, believable test strategy that covers what the current suite
provably does not: real database behavior, file/upload/retention paths, and
browser-level critical flows — using tools already in the repo.

## Current state (verified 2026-11-04)

- Stack: Vitest 4 (+ jsdom, RTL, user-event, axe-core), tests colocated;
  `src/test/api-helper.js` provides `mockApi()`; `server/src/__tests__/helpers/`
  provides a rule-based mocked pg pool + supabase mock; root vitest config runs
  both `src/**` and `server/**`; server config runs `server/src/**` node-env.
- Coverage today is genuinely broad: every service module, most pages
  (incl. 5 axe-driven a11y suites), server routes' happy + guard paths
  (auth/jobs/applications/profiles/admin/reports/notifications/limiter/middleware).
- CI (`.github/workflows/ci.yml`): `npm ci → lint → test → build`.

## Blind spots (why this plan exists)

1. **No real Postgres test runs anywhere** — the pool is always mocked. Things
   that can only be proven by real SQL: `resolveRole` union ordering, the
   deadline-enforced apply INSERT (TOCTOU law lives in the SQL itself),
   unique constraints (one active resume, pending-accreditation-per-company,
   unique(job_id,seeker_id)), retention-purge cascade behavior.
2. **No browser E2E for the money flows** (register→profile→apply→status→placed,
   accreditation round-trip) — puppeteer-core is already a devDep, no new tools.
3. **Untested server areas:** `GET /api/files/:bucket/*` path-traversal guard,
   `upload.js` (multer disk, ext/size filters, orphan-file compensation),
   `notifyMatchingSeekers` matching, `runRetentionPurge` scheduling.

## Task order

### Phase 0 — measure before adding
- [x] Run `npx vitest run --coverage` once; paste the summary table + the 5
      lowest-coverage real files into a Results section here. No thresholds yet —
      thresholds get set only if the numbers show a real hole.

### Phase 1 — real-Postgres integration slice (small, high-value)
- [x] Add `server/src/__tests__/integration/db.bootstrap.js`: applies
      `db/schema.sql` + `db/seed.sql` to a scratch database
      (`INTEGRATION_DATABASE_URL` or `postgres://…/joblinked_test`), run per suite.
- [x] Gate pattern: `const d = it.skipIf(process.env.INTEGRATION_TEST !== '1')` —
      zero CI changes until a CI pg service is added later.
- [x] Write ≤ 6 integration tests, one per risky SQL law:
      `resolveRole` precedence (005 draft in comments, status ordering), deadline
      INSERT rejection (post-deadline apply → 409/400), one-active-resume partial
      unique, pending-accreditation unique, retention purge leaves
      Accepted/Placed/Terminated rows, migration 002 unique-email conflict.
- [x] Script: `npm run test:integration` (server package.json: vitest with env set).

### Phase 2 — missing server unit tests (mocked, cheap)
- [x] `files route guard`: traversal attempts (`..`, absolute, encoded) → 400/404,
      never serve outside bucket-root (the guard at `profiles.js:298-301` gets
      direct coverage).
- [x] `upload.js`: oversized file, wrong ext, PDF >2MB rule, orphan-file unlink on
      failed insert (temp dir per test).
- [x] `notifyMatchingSeekers`: matching by skills/pref/barangay vs broadcast-on-publish.
- [x] `runRetentionPurge`: inject dates so cutoff math is asserted without waiting.

### Phase 3 — browser smoke (puppeteer-core, already installed)
- [x] `scripts/smoke.mjs`: boots `vite preview` + API + requires
      `INTEGRATION_TEST=1` stack; drives: seed login per role →
      (seeker) browse+jobs detail→apply → (employer) open Applicants→status change →
      (admin) approve accreditation→CSV download → public /jobs deep link.
      Extend the smoke script started by
      `docs/plan/done/2026-11-04-full-system-test-fixes-plan.md` Task 5 — do not start a
      second harness script.
- [x] Requires dev seed accounts: extend `db/seed.sql` or add `db/seed-dev.sql`
      with one test account per role + one company/job (schema-legal, psql-applied).
- [x] Keep smoke FAILING loudly on: unexpected console errors, any 5xx, broken
      deep links (ties to Plan 02).

### Phase 4 — CI wiring (only after 1–3 are stable locally)
- [x] Add a pg service container to ci.yml running Phase 1 tests
      (`INTEGRATION_TEST=1`); smoke stays a manual/local gate until core flows are
      stable — do not let a flaky browser suite veto merges.

## Failure modes to guard (Likeliest bite first)

1. Mocked-pool tests keep "proving" SQL that is wrong (the 2026-10 close-out
   already had exactly this: `resolveRole` null-sort verified "on paper only").
2. E2E auth depends on a real Supabase project — keep dev credentials in `.env`
   only; never in the repo; smoke must skip-not-fail when env is absent.
3. Integration tests must not run against the developer's dev DB (`joblinked`) —
   bootstrap asserts the database name ends with `_test`.

## Results

### Phase 0 — baseline coverage (2026-11-09, `npx vitest run --coverage`)

`Test Files 172 passed (172) · Tests 1050 passed (1050) · 56.31s` — the suite
was green at baseline; the gaps below are untested paths, not broken tests.

| Metric | % | Covered/Total |
| --- | --- | --- |
| Statements | 77.09 | 5301/6876 |
| Branches | 68.63 | 3939/5739 |
| Functions | 73.36 | 1416/1930 |
| Lines | 80.63 | 4585/5686 |

5 lowest-coverage real files (by % lines, keeping test-helper files out):

| File | % Stmts | % Lines | Read |
| --- | --- | --- | --- |
| `src/shared/services/ai.js` | 0 | 0 | never exercised |
| `src/components/ui/alert-dialog.jsx` | 7.69 | 7.69 | UI primitive, no direct render |
| `src/shared/lib/routeLoaders.js` | 18.84 | 16.92 | loaders bypassed by direct page renders |
| `server/src/routes/admin-reference.js` | 18.98 | 22.22 | route tests walk ~1/5 of it |
| `src/components/ui/dropdown-menu.jsx` | 25 | 25 | UI primitive, no direct render |

Next tier: `src/shared/services/images.js` 36.11% lines, `src/shared/dashboard.jsx`
35.29%, `src/components/ui/sheet.jsx` 36.36%. No thresholds set — per the plan
they only come if the numbers show a real hole.

### Phase 1 — real-Postgres integration slice

Files:
- `server/src/__tests__/integration/db.bootstrap.js` — normalises
  `INTEGRATION_DATABASE_URL` (default `postgres://postgres:postgres@localhost:5432/joblinked_test`),
  creates the scratch DB when absent, then `drop schema public cascade` + applies
  `db/schema.sql` + `db/seed.sql`, per suite. A target not ending `_test` throws
  (never touched); `INTEGRATION_TEST` unset or Postgres unreachable →
  `ready:false` and every case skips.
- `server/src/__tests__/integration/db.integration.test.js` — exactly 6 tests,
  one per risky SQL law: `resolveRole` precedence (stale/active/table order),
  deadline INSERT rejection (400 → extended deadline → 201 → duplicate 409),
  one-active-resume partial unique, one-pending-accreditation partial unique +
  status trigger, retention purge keeps Accepted/Placed/Terminated (+ recent
  row), unique-email conflict (job_seekers + employers indexes).
- `server/vitest.integration.config.js` + server script
  `test:integration` (`vitest run --config vitest.integration.config.js`;
  the config sets `INTEGRATION_TEST=1`, so no shell-specific env syntax).

Observed locally (Postgres 18 on :5432, `INTEGRATION_DATABASE_URL` pointed at
`joblinked_test`):
- `npm --prefix server run test:integration` → 6/6 passed (twice in a row —
  re-apply is idempotent);
- unreachable host → 6 skipped, exit 0 (clean skip, per plan);
- `…/joblinked` (non-`_test`) → suite fails loudly with "must be a *_test
  database", nothing touched;
- in `npm test` / `npm --prefix server test` the file is collected and skips
  (6 skipped, no CI change).

### Phase 2 — mocked server unit tests

New suites: `files.route-guard.test.js` (6), `upload.limits.test.js` (5),
`notify-matching.test.js` (5), `retention-purge.test.js` (3) — 19 tests.
- route guard: encoded `..%2F`, `%2e%2e`, backslash, absolute-looking, and
  unknown-bucket vectors; sanity-asserts the traversal target
  (`server/package.json`) exists so a 4xx really means the guard blocked.
- upload.js: wrong extension (no file written), >5 MB multer cap, PDF >2 MB
  unlink, orphan unlink on failed insert (500), happy path keeps the file;
  scratch `UPLOAD_DIR` per suite so `server/uploads/` is untouched.
- notifyMatchingSeekers: no-op without tags/location (not a broadcast),
  skills-only, preferred-location-only, OR + LIKE escaping, blank-tag filter.
- runRetentionPurge: Postgres-side cutoff (`make_interval(months => $1)`),
  params `[12]`, no baked JS date, retained-status exclusion, audit payload.

### Verification (2026-11-09)

- `npm --prefix server test` — 70 passed | 1 skipped; 522 passed | 6 skipped
- `npm test` — 176 passed | 1 skipped; 1069 passed | 6 skipped
- `npm run lint` — 0 errors, 0 warnings
- `npm --prefix server run test:integration` — 6 passed

### Unproven / deferred

- Retention cutoff: only two unambiguous sides are asserted (13 months purged,
  400 days / 1 month kept) — the exact boundary day is not tested.
- Deadline: seeded at `current_date - 1` / `current_date + 7`; the exact
  boundary day (`deadline == today`, allowed by `>= current_date`) has no
  dedicated case.
- Outside the 6 integration laws, everything is still mocked-SQL shape.
- Phase 3: the smoke requires `vite preview` + the API to be running (`--base` /
  `--api` preflight with the exact commands on failure) instead of spawning
  them itself — same pattern as `syscheck`; no second harness.
- Phase 4: the pg service container and the step order were validated by
  parsing ci.yml + running the same commands locally, not on a GitHub runner
  (no runner access from this machine). `postgres:18` tag untested here.
- `--coverage` writes `coverage/`; added to `.gitignore` + eslint
  `globalIgnores` since generated output was tripping lint and git status.

### Phase 3 — browser smoke (2026-11-10)

Files:
- `scripts/system-check.mjs` — the ONE harness, extended with a `--smoke` mode:
  public-route sweep unchanged (`npm run syscheck`), authed mode adds console
  error / page error / failed request / **any 5xx** capture, the role flows, and
  the deep link. Skips (exit 0) without `INTEGRATION_TEST=1` or without
  Supabase service credentials in `server/.env`; fails (exit 1) with the exact
  fix when the API/preview/seed are missing.
- `scripts/smoke.mjs` — 5-line entry (`process.argv.push('--smoke')` + import)
  so `npm run smoke` has the named file without duplicating the harness.
- `db/seed-dev.sql` — schema-legal, idempotent, psql-applied: seeker, employer
  (approved accreditation) with one published vacancy, admin, plus
  `smoke.pending@joblinked.test` (never logs in) whose pending accreditation is
  the admin flow's approval subject. Separate file on purpose: the Phase 1
  bootstrap keeps applying reference-only `db/seed.sql`.
- `package.json` — `"smoke": "node scripts/smoke.mjs"`.
- `db/README.md` — one line pointing at the dev seed.
- **Pre-existing bug the smoke surfaced and this pass fixed:** `GET
  /api/admin/accreditations` selected `e as employers`; pg returns a whole-row
  composite as raw record text, so every accreditation row rendered nameless
  (`company_name` undefined) and the smoke could not target the fixture row.
  Now `to_jsonb(e)` (the `resolveRole` pattern); `admin.pagination.test.js`
  regex updated to match. Mocked-SQL shape would never have caught this —
  exactly failure mode #1.

Auth design: passwords are generated per run (`crypto.randomUUID()`) and set on
fixed-UUID fixture users through the Supabase admin API (service role from
`server/.env`, never committed); the smoke also re-opens the pending
accreditation via `POST /api/accreditations` before each run, so approvals are
repeatable. The seeker apply is idempotent (re-runs assert the
"already applied" receipt).

### Phase 4 — CI wiring

`.github/workflows/ci.yml` (existing steps untouched; advisory audits still
last):
- `services.postgres` — `postgres:18`, `POSTGRES_DB=joblinked_test` (name ends
  `_test`, which the bootstrap enforces), `pg_isready` health check, port 5432.
- `npm --prefix server ci` added: the root vitest project collects `server/**`
  tests and the integration command runs from `server/`, so server deps must be
  installed; `cache-dependency-path` now covers both lockfiles.
- New step `Integration tests (real Postgres)`:
  `npm --prefix server run test:integration` with `INTEGRATION_TEST=1` +
  `INTEGRATION_DATABASE_URL` (the config also sets the flag itself).
- Smoke deliberately NOT in CI — manual/local gate, per the plan.

### Verification (2026-11-10)

- `npm test` — 176 passed | 1 skipped; 1069 passed | 6 skipped
- `npm --prefix server test` — 70 passed | 1 skipped; 522 passed | 6 skipped
- `npm run lint` — 0 errors, 0 warnings
- `npm run syscheck` — 11 public routes, 0 problems
- `npm run smoke` (no `INTEGRATION_TEST`) — SKIP, exit 0
- `INTEGRATION_TEST=1 npm run smoke` — full green, 0 problems (headless Chrome
  against a rebuilt `vite preview` :4173 + dev API :4000 + local Postgres 18 +
  the real Supabase project): seeker searched + applied (fresh-apply run and an
  "already applied" re-run), employer moved the applicant Applied → Under
  Review, admin approved the pending fixture and downloaded the 25-row report
  CSV, public `/jobs/:id` rendered the seeded vacancy. Re-applying
  `db/seed-dev.sql` twice changed nothing.
- `npm --prefix server run test:integration` (with `INTEGRATION_DATABASE_URL`
  at local `joblinked_test`) — 6/6 passed: the command CI will run.
- `ci.yml` parsed with PyYAML: service + step order as listed above.

Not verified here: the workflow on a real GitHub runner, and the
`postgres:18` image tag itself.
