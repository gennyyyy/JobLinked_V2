-- =============================================================================
-- 014_one_resume_per_seeker.sql — one resume per job-seeker account (ADR-049)
-- Apply: psql -d joblinked -f db/migrations/014_one_resume_per_seeker.sql
-- (db/schema.sql is updated to match.)
-- Collapse multi-resume accounts: keep newest uploaded (tie-break id desc),
-- repoint applications to it, delete the rest. Then enforce uniqueness.
-- Rollback = drop index resumes_one_per_seeker_uidx (and restore rows — manual).
-- =============================================================================
BEGIN;

-- 1. Repoint applications from non-keeper rows to the keeper (must precede
--    delete: resumes.id is referenced by job_applications.resume_id on delete set null).
with ranked as (
  select id, seeker_id,
         row_number() over (partition by seeker_id order by uploaded_at desc, id desc) as rn
  from public.resumes
),
keepers as (
  select seeker_id, id as keeper_id from ranked where rn = 1
)
update public.job_applications ja
   set resume_id = k.keeper_id
  from ranked r
  join keepers k on k.seeker_id = r.seeker_id
 where ja.resume_id = r.id
   and r.rn > 1;

-- 2. Delete non-keeper rows; emit their file_path for a follow-up unlink pass
--    (Postgres cannot unlink files). Best-effort cleanup; a missing file must
--    never fail the migration.
with ranked as (
  select id,
         row_number() over (partition by seeker_id order by uploaded_at desc, id desc) as rn
  from public.resumes
)
delete from public.resumes r
 using ranked rk
 where r.id = rk.id
   and rk.rn > 1
 returning r.file_path;

-- 2b. Global constraint: the single remaining row per seeker is always active.
update public.resumes set is_active = true;

-- 3. Enforce one resume per seeker.
create unique index if not exists resumes_one_per_seeker_uidx
  on public.resumes(seeker_id);

COMMIT;

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- drop index if exists public.resumes_one_per_seeker_uidx;