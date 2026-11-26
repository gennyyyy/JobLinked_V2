-- ADR-058: one displayed-name change per rolling 30 days, every role. Additive
-- and idempotent — NULL means the account never changed its name, so the first
-- change is free for every existing account (no backfill). The guard lives in
-- the server UPDATE's WHERE clause (server/src/nameChange.js).
alter table public.job_seekers  add column if not exists name_changed_at timestamptz;
alter table public.employers    add column if not exists name_changed_at timestamptz;
alter table public.super_admins add column if not exists name_changed_at timestamptz;
