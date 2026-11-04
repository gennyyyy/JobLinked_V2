-- =============================================================================
-- 010_profile_images.sql — avatar / company-logo bytes live in Postgres
-- Apply: psql -d joblinked -f db/migrations/010_profile_images.sql
-- (db/schema.sql is updated to match; this file upgrades existing DBs.)
--
-- Why a separate table: the role rows are loaded with `select *` / `to_jsonb`
-- in several paths. Putting bytea on job_seekers/employers would serialize
-- megabytes of image data into profile and admin-list responses. This table is
-- fetched only by the explicit image endpoints.
--
-- owner_id is the role-row id (the Supabase user id). No FK on purpose: a role
-- move keeps the same id, mirroring the notifications table convention.
-- =============================================================================
create table if not exists public.profile_images (
  owner_id   uuid        not null,
  kind       text        not null check (kind in ('seeker-avatar','employer-logo')),
  mime       text        not null check (mime in ('image/png','image/jpeg','image/webp')),
  bytes      bytea       not null check (octet_length(bytes) <= 2097152),
  updated_at timestamptz not null default now(),
  primary key (owner_id, kind)
);

comment on table public.profile_images is
  'Profile pictures and company logos. Small images only (<= 2 MB); resumes/documents stay on disk (ADR-040).';
