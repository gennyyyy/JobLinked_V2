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

1. [ ] ADR-037 written with the chosen host; note the single-instance invariants
       and what would break if B is ever picked.
2. [ ] `docs/ops/deploy-runbook.md`: env checklist (EXPLICIT `CORS_ORIGIN` prod
       list — it fail-closes to `localhost:5173` when unset; `TRUST_PROXY`
       value matched to the actual proxy count; `UPLOAD_DIR` absolute path with
       owner/permissions; secret sourcing), build + start + process manager,
       log capture (JSON lines, ~30 days), restart procedure.
3. [ ] Migration ledger: tiny `db/apply-migrations.sh` + `schema_migrations`
       ledger table (name unique). Script: verify connection → apply unapplied
       files 001→NNN in order → record → print state. Idempotency note: some
       migrations are NOT idempotent (004 enum remap is a one-shot) — the ledger
       is the idempotency mechanism, so apply order and record-keeping are strict.
       First run must reconcile reality: query `pg_indexes`/enum values for the
       007–009 effects and record which were already applied manually.
4. [ ] Backups: nightly cron — `pg_dump -Fc` + tar of `UPLOAD_DIR` (resumes are
       PII; backup files must land on the same storage as the DB dump? no — a
       second volume/host the same way the DB dump is kept), 30-day retention,
       checksum line, and a one-line reminder that both dumps are needed together.
5. [ ] Restore drill (executed once, result recorded here): restore the dump to a
       scratch database + untar uploads to a scratch dir, boot the API against
       them, and confirm a real resume downloads and `/api/health?deep=true`
       passes. A backup never restore-tested is not a backup.
6. [ ] Monitoring, minimal: one external ping on `/api/health?deep=true`
       (cron-curl + email, or a free uptime monitor — whichever stakeholders
       tolerate), plus the existing `requestLog` capture from Task 2. No metrics
       platform this round (YAGNI; health + logs cover the current scale).

## Failure modes to guard (Likeliest bite first)

1. **CORS_ORIGIN unset in prod** → API serves only localhost — deploy is "up" but
   every browser request 403s (same live failure already measured as F-1 in
   `plan/2026-11-04-full-system-test-fixes-plan.md`, in preview mode). Runbook
   makes it an explicit, checked line; that plan's boot-warning pairs with this.
2. **TRUST_PROXY value wrong** → spoofable client IP breaks limiter keying (F-01/
   F-02 decisions already addressed keying; the proxy count must still be right).
3. **Migrations double-applied** (ledger absent + 004 non-idempotent) → status
   enum corruption. Ledger is the fix; manual psql runs must be reconciled into it.
4. **DB restored, uploads not** → every resume view 404s after a failover. The
   drill covers both artifacts.
5. **Frontend env on Vercel** (`VITE_*` keys per root `.env.example`) missing a
   rebuild after change → stale bundle; runbook notes `VITE_*` are baked at build.
