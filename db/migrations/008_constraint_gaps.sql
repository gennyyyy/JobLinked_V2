-- =============================================================================
-- 008_constraint_gaps.sql — DB-level enforcement for invariants the app assumes
-- but the database does not enforce. Found in the data-layer audit.
-- Apply: psql -d joblinked -f db/migrations/008_constraint_gaps.sql
-- (db/schema.sql is updated to match.)
-- Safe to re-run: every statement is guarded; nothing here is destructive.
--
-- The headline item is #1: an employer deleting a stale job cascades
-- job_applications → employment_history (on delete cascade), silently erasing
-- every citizen's placement record for that job while reports still count it.
-- application_id is already nullable, so `on delete set null` preserves the
-- row (with its employer_name/position/dates) instead of destroying it.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. employment_history.application_id: ON DELETE CASCADE → ON DELETE SET NULL
--    Reason: preserves placement history when a job is deleted. Rolling back
--    means re-adding the constraint WITH cascade (documented below).
--    NOT VALID + VALIDATE CONSTRAINT so the EXCLUSIVE lock is brief on big
--    tables; the constraint is then trusted by the planner.
-- -----------------------------------------------------------------------------
DO $$
DECLARE existing_cascade text;
BEGIN
  SELECT con.conname INTO existing_cascade
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'employment_history'
    AND con.contype = 'f'
    AND con.confdeltype = 'c';   -- ON DELETE CASCADE

  IF existing_cascade IS NULL THEN
    RAISE NOTICE 'employment_history cascade FK already converted (or absent) — skipping';
  ELSE
    EXECUTE format('alter table public.employment_history drop constraint %I', existing_cascade);
    EXECUTE 'alter table public.employment_history
             add constraint employment_history_application_id_fkey
             foreign key (application_id) references public.job_applications(id)
             on delete set null not valid';
    EXECUTE 'alter table public.employment_history validate constraint employment_history_application_id_fkey';
    RAISE NOTICE 'employment_history.application_id is now ON DELETE SET NULL';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. At most ONE pending accreditation per company.
--    auth/provision inserts a pending row at signup and the resubmit path
--    inserts another, so an employer who resubmits twice ends up with two
--    pending rows; trg_sync_accreditation_status is last-write-wins, so
--    approve #1 then reject #2 leaves the company reading "rejected" with an
--    approval on file. Guarded: skips with a NOTICE when duplicates already
--    exist (dedupe first, re-run).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.employer_accreditations
    WHERE status = 'pending'
    GROUP BY company_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'skipping employer_accreditations pending unique index: duplicate pending rows present — dedupe first, then re-run';
  ELSE
    EXECUTE 'create unique index if not exists employer_accreditations_one_pending_uidx
             on public.employer_accreditations(company_id) where status = ''pending''';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. super_admins never received the email unique index that job_seekers and
--    employers got in 002. Same guarded pattern as those two.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT email FROM public.super_admins GROUP BY email HAVING count(*) > 1
    ) d
  ) THEN
    RAISE NOTICE 'skipping super_admins email unique index: duplicate emails present';
  ELSE
    EXECUTE 'create unique index if not exists super_admins_email_uidx on public.super_admins(email)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Date-range sanity on seeker-entered ranges (currently accepted and shown
--    to employers). Guarded: skips with a NOTICE while violating rows exist.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.education WHERE end_year IS NOT NULL AND start_year IS NOT NULL AND end_year < start_year)
     OR EXISTS (SELECT 1 FROM public.work_experience WHERE end_date IS NOT NULL AND start_date IS NOT NULL AND end_date < start_date) THEN
    RAISE NOTICE 'skipping date-range CHECKs: existing rows violate them — clean data first, then re-run';
  ELSE
    EXECUTE 'alter table public.education drop constraint if exists education_years_order_chk';
    EXECUTE 'alter table public.education add constraint education_years_order_chk
             check (end_year is null or start_year is null or end_year >= start_year) not valid';
    EXECUTE 'alter table public.education validate constraint education_years_order_chk';
    EXECUTE 'alter table public.work_experience drop constraint if exists work_experience_dates_order_chk';
    EXECUTE 'alter table public.work_experience add constraint work_experience_dates_order_chk
             check (end_date is null or start_date is null or end_date >= start_date) not valid';
    EXECUTE 'alter table public.work_experience validate constraint work_experience_dates_order_chk';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- alter table public.work_experience drop constraint if exists work_experience_dates_order_chk;
-- alter table public.education drop constraint if exists education_years_order_chk;
-- drop index if exists public.super_admins_email_uidx;
-- drop index if exists public.employer_accreditations_one_pending_uidx;
-- -- Restore the previous cascade behaviour (re-introduces the placement-history
-- -- wipe, so only do this if the set-null behaviour is somehow wrong):
-- alter table public.employment_history drop constraint if exists employment_history_application_id_fkey;
-- alter table public.employment_history
--   add constraint employment_history_application_id_fkey
--   foreign key (application_id) references public.job_applications(id) on delete cascade not valid;
-- alter table public.employment_history validate constraint employment_history_application_id_fkey;
