-- =============================================================================
-- 018_pending_signups.sql — self-signup profile held until email verification
-- Apply: psql -d joblinked -f db/migrations/018_pending_signups.sql
-- (db/schema.sql is updated to match.)
-- ADR-056 decision 8: Better Auth stores only name/email and returns no session
-- at sign-up while requireEmailVerification is on. The registration form's role
-- and profile live here, written pre-auth by POST /api/auth/pending-signup for
-- an existing UNVERIFIED auth."user" row, and claimed by provision in the same
-- transaction as the role-row insert. Idempotency is the ledger row, not this
-- SQL. Rollback: drop table public.pending_signups;
-- =============================================================================

create table if not exists public.pending_signups (
  user_id uuid primary key references auth."user"(id) on delete cascade,
  role text not null check (role in ('job-seeker','employer')),
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
