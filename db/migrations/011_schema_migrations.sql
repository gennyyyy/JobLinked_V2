-- =============================================================================
-- 011_schema_migrations.sql — migration ledger (architect-approved: this table
-- ONLY; no other schema change).
--
-- Why: migrations 001–010 were applied by hand per environment and nothing
-- records which ran. 004 (the application_status enum swap) is a one-shot, so
-- "just re-run every file" can corrupt the enum when the real state is unknown.
-- From now on db/apply-migrations.sh records every applied file here; this
-- table is the idempotency mechanism, not the files themselves.
--
-- First run on an existing database: db/apply-migrations.sh creates this table,
-- probes the effects of 004/007/008/009, records the ones already present, and
-- then applies the remaining (idempotent) files. See
-- docs/ops/deploy-runbook.md#migration-ledger for the reconciliation queries.
-- =============================================================================

create table if not exists public.schema_migrations (
  name       text primary key,
  applied_at timestamptz default now()
);
