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
- [ ] Run `npx vitest run --coverage` once; paste the summary table + the 5
      lowest-coverage real files into a Results section here. No thresholds yet —
      thresholds get set only if the numbers show a real hole.

### Phase 1 — real-Postgres integration slice (small, high-value)
- [ ] Add `server/src/__tests__/integration/db.bootstrap.js`: applies
      `db/schema.sql` + `db/seed.sql` to a scratch database
      (`INTEGRATION_DATABASE_URL` or `postgres://…/joblinked_test`), run per suite.
- [ ] Gate pattern: `const d = it.skipIf(process.env.INTEGRATION_TEST !== '1')` —
      zero CI changes until a CI pg service is added later.
- [ ] Write ≤ 6 integration tests, one per risky SQL law:
      `resolveRole` precedence (005 draft in comments, status ordering), deadline
      INSERT rejection (post-deadline apply → 409/400), one-active-resume partial
      unique, pending-accreditation unique, retention purge leaves
      Accepted/Placed/Terminated rows, migration 002 unique-email conflict.
- [ ] Script: `npm run test:integration` (server package.json: vitest with env set).

### Phase 2 — missing server unit tests (mocked, cheap)
- [ ] `files route guard`: traversal attempts (`..`, absolute, encoded) → 400/404,
      never serve outside bucket-root (the guard at `profiles.js:298-301` gets
      direct coverage).
- [ ] `upload.js`: oversized file, wrong ext, PDF >2MB rule, orphan-file unlink on
      failed insert (temp dir per test).
- [ ] `notifyMatchingSeekers`: matching by skills/pref/barangay vs broadcast-on-publish.
- [ ] `runRetentionPurge`: inject dates so cutoff math is asserted without waiting.

### Phase 3 — browser smoke (puppeteer-core, already installed)
- [ ] `scripts/smoke.mjs`: boots `vite preview` + API + requires
      `INTEGRATION_TEST=1` stack; drives: seed login per role →
      (seeker) browse+jobs detail→apply → (employer) open Applicants→status change →
      (admin) approve accreditation→CSV download → public /jobs deep link.
      Extend the smoke script started by
      `plan/2026-11-04-full-system-test-fixes-plan.md` Task 5 — do not start a
      second harness script.
- [ ] Requires dev seed accounts: extend `db/seed.sql` or add `db/seed-dev.sql`
      with one test account per role + one company/job (schema-legal, psql-applied).
- [ ] Keep smoke FAILING loudly on: unexpected console errors, any 5xx, broken
      deep links (ties to Plan 02).

### Phase 4 — CI wiring (only after 1–3 are stable locally)
- [ ] Add a pg service container to ci.yml running Phase 1 tests
      (`INTEGRATION_TEST=1`); smoke stays a manual/local gate until core flows are
      stable — do not let a flaky browser suite veto merges.

## Failure modes to guard (Likeliest bite first)

1. Mocked-pool tests keep "proving" SQL that is wrong (the 2026-10 close-out
   already had exactly this: `resolveRole` null-sort verified "on paper only").
2. E2E auth depends on a real Supabase project — keep dev credentials in `.env`
   only; never in the repo; smoke must skip-not-fail when env is absent.
3. Integration tests must not run against the developer's dev DB (`joblinked`) —
   bootstrap asserts the database name ends with `_test`.
