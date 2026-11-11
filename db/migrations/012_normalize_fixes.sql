-- =============================================================================
-- 012_normalize_fixes.sql — normalization-floor follow-ups from
-- docs/plan/2026-11-11-db-normalization-analysis.md (ADR-046).
--
-- 1. P1 — job_vacancies.tags case domain: lowercase + dedupe existing arrays so
--    the publish fan-out (`skills && $n::text[]`, case-sensitive) matches the
--    lowercased seeker skills (P1's write-path helper covers new rows).
-- 2. P3 — employment_type domain: seed the `Casual`, `Project-based` and
--    `Internship` reference rows and pin the canonical list (Full-time,
--    Part-time, Contractual, Seasonal, Casual, Job Order, Project-based,
--    Internship) with a CHECK. The same list lives in db/seed.sql,
--    db/schema.sql, server/src/routes/jobs.js and src/shared/constants.js;
--    ADR-046 requires a migration + schema.sql sync for any change (never
--    live DDL, never a lone app edit).
-- 3. P5 — salary sanity: salary_min <= salary_max when both are set.
--
-- Apply: psql -d joblinked -f db/migrations/012_normalize_fixes.sql
-- Safe to re-run: the tags statement only rewrites rows that still differ, the
-- reference rows are upserted (`on conflict (category, value) do update`), and
-- each check is
-- dropped if present and re-added NOT VALID + VALIDATE (brief exclusive lock,
-- trusted by the planner afterwards) exactly like 008. A check whose live data
-- still violates it is skipped with a NOTICE — reconcile, then re-run.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. P1 — tags: trim + lowercase + dedupe + drop empties. Only rows whose
--    stored array differs are touched, so a second run is a no-op.
-- -----------------------------------------------------------------------------
UPDATE public.job_vacancies jv
SET tags = normalized.tags
FROM (
  SELECT id,
         coalesce(array_agg(distinct lower(btrim(t)) ORDER BY lower(btrim(t))), '{}') AS tags
  FROM public.job_vacancies, unnest(tags) AS t
  WHERE btrim(t) <> ''
  GROUP BY id
) normalized
WHERE jv.id = normalized.id
  AND jv.tags IS DISTINCT FROM normalized.tags;

-- -----------------------------------------------------------------------------
-- 2. P3 — canonical employment_type domain.
-- -----------------------------------------------------------------------------
INSERT INTO public.reference_data (category, value, sort_order) VALUES
  ('employment_type', 'Casual', 5),
  ('employment_type', 'Project-based', 7),
  ('employment_type', 'Internship', 8)
ON CONFLICT (category, value) DO UPDATE SET sort_order = excluded.sort_order;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.job_vacancies
    WHERE employment_type IS NOT NULL
      AND employment_type NOT IN ('Full-time', 'Part-time', 'Contractual', 'Seasonal', 'Casual', 'Job Order', 'Project-based', 'Internship')
  ) THEN
    RAISE NOTICE 'skipping job_vacancies_employment_type_chk: out-of-domain employment_type rows present — reconcile them (ADR-046), then re-run';
  ELSE
    EXECUTE 'alter table public.job_vacancies drop constraint if exists job_vacancies_employment_type_chk';
    EXECUTE 'alter table public.job_vacancies
             add constraint job_vacancies_employment_type_chk
             check (employment_type is null or employment_type in (''Full-time'', ''Part-time'', ''Contractual'', ''Seasonal'', ''Casual'', ''Job Order'', ''Project-based'', ''Internship''))
             not valid';
    EXECUTE 'alter table public.job_vacancies validate constraint job_vacancies_employment_type_chk';
    RAISE NOTICE 'job_vacancies employment_type domain pinned to the canonical 8 values';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. P5 — salary range sanity (008 covered the date ranges, not this one).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.job_vacancies
    WHERE salary_min IS NOT NULL AND salary_max IS NOT NULL AND salary_min > salary_max
  ) THEN
    RAISE NOTICE 'skipping job_vacancies_salary_range_chk: rows with salary_min > salary_max present — clean data first, then re-run';
  ELSE
    EXECUTE 'alter table public.job_vacancies drop constraint if exists job_vacancies_salary_range_chk';
    EXECUTE 'alter table public.job_vacancies
             add constraint job_vacancies_salary_range_chk
             check (salary_min is null or salary_max is null or salary_min <= salary_max)
             not valid';
    EXECUTE 'alter table public.job_vacancies validate constraint job_vacancies_salary_range_chk';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- alter table public.job_vacancies drop constraint if exists job_vacancies_salary_range_chk;
-- alter table public.job_vacancies drop constraint if exists job_vacancies_employment_type_chk;
-- Reference-data rows are intentionally left in place on rollback: Casual,
-- Project-based and Internship may pre-exist (seed.sql / live DB), so deleting
-- them here would remove pre-existing values. Only the CHECK is reversed.
-- The tags lowercase/dedupe data fix is intentionally not reversible: the
-- original mixed-case array was the defect and is not stored anywhere.
