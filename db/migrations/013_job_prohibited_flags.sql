-- =============================================================================
-- 013_job_prohibited_flags.sql — fee-post review flags
-- Apply: psql -d joblinked -f db/migrations/013_job_prohibited_flags.sql
-- (db/schema.sql is updated to match.)
-- Safe to re-run: every statement is guarded; nothing here is destructive.
-- Rollback = drop table public.job_prohibited_flags;
-- =============================================================================
BEGIN;

create table if not exists public.job_prohibited_flags (
  id            uuid        primary key default gen_random_uuid(),
  job_id        uuid        not null references public.job_vacancies(id) on delete cascade,
  matched_terms text[]      not null,
  source_fields text[]      not null,
  severity      text        not null check (severity in ('blocked','held')),
  resolved      text        check (resolved in ('cleared','approved','rejected')),
  resolved_by   uuid,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists job_prohibited_flags_job_resolved_idx
  on public.job_prohibited_flags(job_id, resolved_at desc);

create unique index if not exists job_prohibited_flags_one_open_uidx
  on public.job_prohibited_flags(job_id) where resolved is null;

COMMIT;

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- drop table if exists public.job_prohibited_flags;