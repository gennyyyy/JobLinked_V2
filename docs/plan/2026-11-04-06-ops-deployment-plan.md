# Ops & Deployment Plan — make production boring and recoverable

**For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
(after Lead Architect sign-off; ADR-037 requires explicit user approval first).

**Goal:** Decide where the API runs in production, write the deploy runbook the
repo is missing, apply migrations deterministically, automate backups, and prove
a restore actually works.

## Baseline (verified 2026-11-04)

- Frontend deploy exists via `vercel.json` (single SPA rewrite). Backend deploy
  path is **unwritten** anywhere in the repo.
- Server invariants that make this decision forced:
  - uploads persist to the API's local disk (`server/src/upload.js`, `UPLOAD_DIR`
    default `./uploads`, absolute-path enforced);
  - rate limiting is in-memory (`middleware/rateLimit.js` — single-instance
    caveat documented in-code);
  - the retention purge runs as an in-process `setInterval` daily job.
  → All three assume ONE persistent Node process. Serverless breaks them all.
- Postgres deploy recipe is the manual path in `db/README.md`
  (`pg_dump -Fc` / restore), no schedule, no drill on record.
- Migration state per environment is uncertain: the 2026-10-16 close-out warned
  migrations 007–009 "may not be applied" anywhere; there is no ledger, only
  file order.
- API envs: `server/.env.example` (DATABASE_URL, SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, PORT, UPLOAD_DIR, CORS_ORIGIN comma list,
  TRUST_PROXY documented fail-closed, OPENROUTER_* optional). CI exists
  (lint/test/build); no deploy job.

## Decision gate — ADR-037: production API host (user approval required)

- **A (recommended): one persistent Node process** (VPS / container on a cheap
  host) behind the existing Vercel static frontend. Zero code changes; all three
  invariants hold. Runbook documents pm2/systemd, logs, restart.
- **B: serverless API.** Requires rework: uploads → Supabase Storage (+ client +
  route + DB path migration), limiter → Postgres-backed store, retention purge →
  external scheduler. Only worth it if ops cost of a VPS is the problem — it is
  a rework, not a config flip.

## Task order

1. [x] ADR-037 written with the chosen host; note the single-instance invariants
       and what would break if B is ever picked.
2. [x] `docs/ops/deploy-runbook.md`: env checklist (EXPLICIT `CORS_ORIGIN` prod
       list — it fail-closes to `localhost:5173` when unset; `TRUST_PROXY`
       value matched to the actual proxy count; `UPLOAD_DIR` absolute path with
       owner/permissions; secret sourcing), build + start + process manager,
       log capture (JSON lines, ~30 days), restart procedure.
3. [x] Migration ledger: tiny `db/apply-migrations.sh` + `schema_migrations`
       ledger table (name unique). Script: verify connection → apply unapplied
       files 001→NNN in order → record → print state. Idempotency note: some
       migrations are NOT idempotent (004 enum remap is a one-shot) — the ledger
       is the idempotency mechanism, so apply order and record-keeping are strict.
       First run must reconcile reality: query `pg_indexes`/enum values for the
       007–009 effects and record which were already applied manually.
4. [x] Backups: nightly cron — `pg_dump -Fc` + tar of `UPLOAD_DIR` (resumes are
       PII; backup files must land on the same storage as the DB dump? no — a
       second volume/host the same way the DB dump is kept), 30-day retention,
       checksum line, and a one-line reminder that both dumps are needed together.
5. [x] Restore drill (executed once, result recorded here): restore the dump to a
       scratch database + untar uploads to a scratch dir, boot the API against
       them, and confirm a real resume downloads and `/api/health?deep=true`
       passes. A backup never restore-tested is not a backup.
6. [x] Monitoring, minimal: one external ping on `/api/health?deep=true`
       (cron-curl + email, or a free uptime monitor — whichever stakeholders
       tolerate), plus the existing `requestLog` capture from Task 2. No metrics
       platform this round (YAGNI; health + logs cover the current scale).

## Failure modes to guard (Likeliest bite first)

1. **CORS_ORIGIN unset in prod** → API serves only localhost — deploy is "up" but
   every browser request 403s (same live failure already measured as F-1 in
   `docs/plan/2026-11-04-full-system-test-fixes-plan.md`, in preview mode). Runbook
   makes it an explicit, checked line; that plan's boot-warning pairs with this.
2. **TRUST_PROXY value wrong** → spoofable client IP breaks limiter keying (F-01/
   F-02 decisions already addressed keying; the proxy count must still be right).
3. **Migrations double-applied** (ledger absent + 004 non-idempotent) → status
   enum corruption. Ledger is the fix; manual psql runs must be reconciled into it.
4. **DB restored, uploads not** → every resume view 404s after a failover. The
   drill covers both artifacts.
5. **Frontend env on Vercel** (`VITE_*` keys per root `.env.example`) missing a
   rebuild after change → stale bundle; runbook notes `VITE_*` are baked at build.

## Results — 2026-11-09 (all tasks complete; drill PASSED)

**Delivered**

- `docs/ops/deploy-runbook.md` (new): env checklist (`CORS_ORIGIN` prod list +
  fail-closed warning, `TRUST_PROXY` hop count, absolute `UPLOAD_DIR` +
  owner/permissions, secret sourcing incl. the libpq percent-encoding rule),
  systemd/pm2 process manager, JSON-log capture with ~30-day rotation,
  restart procedure, `VITE_*`-baked-at-build note, migration ledger, backups,
  monitoring, restore drill.
- `db/apply-migrations.sh` + `db/migrations/011_schema_migrations.sql`
  (ledger, the only schema object added), `scripts/backup.sh`.

**Verified (executed against the local PostgreSQL 18, not just syntax-checked)**

- `bash -n` clean on both scripts; backup ran for real → atomic directory with
  `db.dump` + `uploads.tgz` + `manifest.txt` + `SHA256SUMS` (independent
  `sha256sum -c` OK); retention probe removed a faked 40-day-old dir and kept
  fresh ones.
- `apply-migrations.sh` on the dev DB: first run reconciled 007/008/009 (effects
  already present) and detected 004 as genuinely unapplied; after the fixes
  below it applied everything → ledger 11/11 rows, `pending: none`; second run
  → `nothing to apply` (idempotency proof); `--status` prints state.
- 004's end state checked against `db/schema.sql`: enum without `Shortlisted`,
  both `status` columns typed `application_status`, default `'Applied'`,
  `record_accepted_employment` trigger recreated identically.
- 008's apply branch simulated on a scratch DB (cascade FK restored, ledger row
  deleted → script re-applied it): application FK became `ON DELETE SET NULL`,
  `seeker_id` cascade FK untouched.

**Fixes required to make the partial files work (verified before/after)**

1. `db/apply-migrations.sh` used `psql -c` with `:'name'` variables — psql only
   interpolates in script/stdin input, so every ledger insert/read errored.
   Now piped via stdin.
2. Same script: `psql | loop` on Windows emits CRLF into the recorded names
   (`007…sql\r`), so `is_applied` never matched and files re-applied. Output now
   passes through `tr -d '\r'` (no-op on Linux).
3. `004_remove_shortlisted.sql` could not run at all on a DB with the
   `record_accepted_employment` trigger (`AFTER … UPDATE OF status`) — Postgres
   refuses the column type swap. It now drops and recreates that trigger around
   the swap, identical to `db/schema.sql`.
4. `008_constraint_gaps.sql`'s guard matched **any** cascade FK on
   `employment_history` (could pick `seeker_id` → `job_seekers` and drop the
   wrong constraint); it now targets the `application_id` → `job_applications`
   FK via `confrelid`. Skipping immediately after a real apply is also verified.
5. `scripts/backup.sh` had a bash parse error — `API's` inside
   `${UPLOAD_DIR:?…}` quotes the parameter-expansion word. Apostrophe removed.

**Restore drill — PASSED (executed once, as required)**
Backup taken by `scripts/backup.sh` → scratch DB `joblinked_drill` restored
(`pg_restore` rc=0; 2 resumes rows, ledger 11 rows) → uploads untarred to a
scratch dir → API booted on :4100 against both (`UPLOAD_DIR` log confirmed the
scratch dir) → `/api/health?deep=true` returned `{"ok":true,"db":"ok","auth":"ok"}`
→ a real resume downloaded as its owner: `HTTP 200, 236 587 bytes, %PDF-`,
correct `Content-Disposition`. Scratch DB dropped, scratch API stopped.

**Could not be verified here (honest limits)**

- The production host itself: systemd unit, logrotate/journald caps, cron
  entries, and the uptime/cron probe are documented, not installed — no VPS
  exists yet. `?deep=true` monitoring is likewise specified but running nowhere.
- The 004/008 apply branches were exercised on this dev/scratch DB pair; a
  production DB with different legacy state would still need `--status` checked
  first.
- Windows-only artifacts of the tooling (`\r` handling) were fixed here and are
  harmless on Linux, but the scripts have not run on a Linux host.

**Left as-is on purpose:** `scripts/backup-uploads.mjs` + `npm run backup:uploads`
(the old manual uploads-only path referenced by `db/README.md`) — superseded by
`scripts/backup.sh` for production, still useful for ad-hoc dev backups. The
dev DB now carries `public.schema_migrations` (approved table + recorded rows);
no other schema changed.
