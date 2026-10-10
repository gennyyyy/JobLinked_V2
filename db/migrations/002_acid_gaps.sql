-- =============================================================================
-- 002_acid_gaps.sql — ADR-041: close duplicate-path ACID gaps
-- Apply: psql -d joblinked -f db/migrations/002_acid_gaps.sql
-- (db/schema.sql is updated to match; this file upgrades existing DBs.)
-- Safe to re-run: indexes are IF NOT EXISTS + duplicate-guarded, backfill
-- inserts only for job_vacancies ids missing any history row.
-- Lock/time: plain CREATE INDEX (not CONCURRENTLY) so it runs in one
-- transaction; sub-second on current size.
-- Intentionally NOT included: FK on notifications.user_id (fan-out to 3 role
-- tables), speculative indexes, trigger/function changes.
-- =============================================================================
BEGIN;

-- Uniqueness: one account per email (was app-only; duplicates break login).
-- Guarded: skips with NOTICE when duplicates exist — dedupe first, re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT email FROM public.job_seekers GROUP BY email HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE NOTICE 'skipping job_seekers email unique index: duplicate emails present';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS job_seekers_email_uidx ON public.job_seekers(email)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT email FROM public.employers GROUP BY email HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE NOTICE 'skipping employers email unique index: duplicate emails present';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS employers_email_uidx ON public.employers(email)';
  END IF;
END $$;

-- Backfill: one job_status_history row per job missing it (duplicate create
-- path wrote the vacancy without history). Marker identifies backfilled rows.
INSERT INTO public.job_status_history (job_id, status, remarks, changed_by)
SELECT v.id, v.status, 'backfill: duplicate-path orphan', NULL
FROM public.job_vacancies v
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_status_history h WHERE h.job_id = v.id
);

COMMIT;

-- =============================================================================
-- ROLLBACK (run only if forward caused a problem)
-- =============================================================================
-- DELETE FROM public.job_status_history WHERE remarks = 'backfill: duplicate-path orphan' AND changed_by IS NULL;
-- DROP INDEX IF EXISTS public.employers_email_uidx;
-- DROP INDEX IF EXISTS public.job_seekers_email_uidx;
