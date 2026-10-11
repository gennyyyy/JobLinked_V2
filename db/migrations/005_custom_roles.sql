-- =============================================================================
-- 005_custom_roles.sql — super-admin custom roles (catalog + user tagging)
-- Apply: psql -d joblinked -f db/migrations/005_custom_roles.sql
-- (db/schema.sql is updated to match; this file upgrades existing DBs.)
--
-- What it adds:
--   1. reference_data.details jsonb — permission-bundle payload for
--      category = 'custom_role' rows ({ description, permissions[], base_role }).
--      The 3 system roles remain fixed in the user_role enum + role tables.
--   2. job_seekers/employers/super_admins.custom_role_id — nullable tag on the
--      user's existing row; assignment is edited from the Users page only.
--      No enum change, no new login identity: auth keeps resolving role from
--      the account table (custom_role_id is a display/permission tag).
-- =============================================================================

alter table public.reference_data
  add column if not exists details jsonb;

alter table public.job_seekers
  add column if not exists custom_role_id bigint
    references public.reference_data(id) on delete set null;

alter table public.employers
  add column if not exists custom_role_id bigint
    references public.reference_data(id) on delete set null;

alter table public.super_admins
  add column if not exists custom_role_id bigint
    references public.reference_data(id) on delete set null;
