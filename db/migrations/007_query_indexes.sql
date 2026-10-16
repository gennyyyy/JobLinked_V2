-- =============================================================================
-- 007_query_indexes.sql — indexes for the search-pattern seq scans found in the
-- performance audit. Apply: psql -d joblinked -f db/migrations/007_query_indexes.sql
-- (db/schema.sql index block is updated to match.)
-- Safe to re-run: every statement is IF NOT EXISTS / guarded.
--
-- Two query patterns were full-table scanning:
--   1. job_seekers.skills && $1::text[]  — runs on EVERY job publish
--      (server/src/routes/jobs.js notifyMatchingSeekers).
--   2. Case-insensitive substring search used by the jobs board and the admin
--      user search (jobs.js list ilike title/description/location +
--      company_name; admin.js ilike full_name/email).
--      btree cannot serve ILIKE '%…%'; these need GIN + pg_trgm.
--
-- pg_trgm needs SUPERUSER on self-hosted Postgres and the Extensions UI on
-- Supabase. Everything below degrades gracefully: if the extension cannot be
-- created the trigram indexes are skipped (with a NOTICE) and the migration
-- still succeeds — plain CREATE INDEX, one transaction, sub-second here.
-- =============================================================================
BEGIN;

-- (1) No extension required — array overlap match.
CREATE INDEX IF NOT EXISTS job_seekers_skills_gin ON public.job_seekers USING gin (skills);

-- (2) Best-effort extension: never fail the migration over a privilege issue.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'pg_trgm unavailable — skipping trigram search indexes';
END $$;

DO $$
DECLARE trgm boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') INTO trgm;
  IF NOT trgm THEN
    RAISE NOTICE 'trigram search indexes skipped (no pg_trgm)';
    RETURN;
  END IF;

  -- Jobs board: public list + seeker job list (jobs.js GET /jobs)
  CREATE INDEX IF NOT EXISTS job_vacancies_title_trgm   ON public.job_vacancies USING gin (title gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS job_vacancies_desc_trgm    ON public.job_vacancies USING gin (description gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS job_vacancies_location_trgm ON public.job_vacancies USING gin (location gin_trgm_ops);

  -- Company name shown/joined on the jobs board
  CREATE INDEX IF NOT EXISTS employers_company_name_trgm ON public.employers USING gin (company_name gin_trgm_ops);

  -- Admin user search across the three role tables (admin.js GET /admin/users)
  CREATE INDEX IF NOT EXISTS job_seekers_full_name_trgm   ON public.job_seekers USING gin (full_name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS job_seekers_email_trgm       ON public.job_seekers USING gin (email gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS employers_full_name_trgm     ON public.employers   USING gin (full_name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS employers_email_trgm         ON public.employers   USING gin (email gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS super_admins_full_name_trgm  ON public.super_admins USING gin (full_name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS super_admins_email_trgm      ON public.super_admins USING gin (email gin_trgm_ops);
END $$;

COMMIT;

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- DROP INDEX IF EXISTS public.super_admins_email_trgm;
-- DROP INDEX IF EXISTS public.super_admins_full_name_trgm;
-- DROP INDEX IF EXISTS public.employers_email_trgm;
-- DROP INDEX IF EXISTS public.employers_full_name_trgm;
-- DROP INDEX IF EXISTS public.job_seekers_email_trgm;
-- DROP INDEX IF EXISTS public.job_seekers_full_name_trgm;
-- DROP INDEX IF EXISTS public.employers_company_name_trgm;
-- DROP INDEX IF EXISTS public.job_vacancies_location_trgm;
-- DROP INDEX IF EXISTS public.job_vacancies_desc_trgm;
-- DROP INDEX IF EXISTS public.job_vacancies_title_trgm;
-- DROP INDEX IF EXISTS public.job_seekers_skills_gin;
-- DROP EXTENSION IF EXISTS pg_trgm;  -- only if nothing else needs it
