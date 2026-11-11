-- =============================================================================
-- 004_remove_shortlisted.sql — ADR-045: purge 'Shortlisted' application status
-- Apply: psql -d joblinked -f db/migrations/004_remove_shortlisted.sql
-- (db/schema.sql is updated to match; this file upgrades existing DBs.)
--
-- NOTE: supabase/migration.sql is intentionally untouched (repo rule: NEVER
-- edit it; it stays the Supabase-target schema for the later move back).
-- It diverges after this migration by retaining 'Shortlisted' in its
-- application_status enum definition.
--
-- Order: remap existing rows to 'Under Review' FIRST (enum removal fails
-- while the value is in use), then swap the enum via the create-new-type /
-- alter-column / drop-old pattern (works on all supported local Postgres;
-- ALTER TYPE ... DROP VALUE only handles one label on PG14+ and cannot run
-- inside a transaction block on older versions, so the swap is simpler).
-- Covers both application_status columns: job_applications.status and
-- application_status_history.status (+ the job_applications default).
-- =============================================================================
BEGIN;

-- Remap existing rows (no-op when none use the old value).
UPDATE public.job_applications SET status = 'Under Review' WHERE status = 'Shortlisted';
UPDATE public.application_status_history SET status = 'Under Review' WHERE status = 'Shortlisted';

-- The status column carries the record_accepted_employment trigger
-- (AFTER INSERT OR UPDATE OF status, defined in db/schema.sql); Postgres
-- refuses a column type swap while it depends on the column, so drop it here
-- and recreate it (identical) after the swap.
DROP TRIGGER IF EXISTS record_accepted_employment ON public.job_applications;

-- Recoverability: drop a leftover _new type from a partial run before recreating.
DROP TYPE IF EXISTS public.application_status_new;
-- New enum without 'Shortlisted' (order of the rest unchanged).
DO $$ BEGIN CREATE TYPE application_status_new AS ENUM
  ('Applied','Under Review','Interview','Accepted','Rejected','Placed','Terminated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Drop defaults so the column type swap is allowed.
ALTER TABLE public.job_applications ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.application_status_history ALTER COLUMN status DROP DEFAULT;

-- Swap both columns to the new type.
ALTER TABLE public.job_applications
  ALTER COLUMN status TYPE application_status_new USING status::text::application_status_new;
ALTER TABLE public.application_status_history
  ALTER COLUMN status TYPE application_status_new USING status::text::application_status_new;

-- Replace the old type and restore the default.
ALTER TYPE public.application_status RENAME TO application_status_old;
ALTER TYPE public.application_status_new RENAME TO application_status;
ALTER TABLE public.job_applications ALTER COLUMN status SET DEFAULT 'Applied'::public.application_status;
DROP TYPE IF EXISTS public.application_status_old;

-- Recreate the trigger identically to db/schema.sql. The guard keeps databases
-- that predate the trigger (no function either) untouched.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'record_accepted_employment'
  ) THEN
    CREATE TRIGGER record_accepted_employment
    AFTER INSERT OR UPDATE OF status ON public.job_applications
    FOR EACH ROW EXECUTE FUNCTION public.record_accepted_employment();
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- ROLLBACK (run only if forward caused a problem; re-adds the label — data
-- already remapped to 'Under Review' stays remapped)
-- =============================================================================
-- ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'Shortlisted';
