-- =============================================================================
-- 001_feature_fit_indexes.sql — efficiency fixes from schema-vs-features audit
-- Apply: psql -d joblinked -f db/migrations/001_feature_fit_indexes.sql
-- (db/schema.sql is updated to match; this file upgrades existing DBs.)
-- Safe to re-run: all statements are IF NOT EXISTS / guarded.
-- Lock/time: plain CREATE INDEX (not CONCURRENTLY) so it runs in one
-- transaction; sub-second on current size (largest table: audit_logs ~67 rows).
-- =============================================================================
BEGIN;

-- Jobs board + employer lists (server/src/routes/jobs.js: list, employer jobs)
CREATE INDEX IF NOT EXISTS job_vacancies_company_idx ON public.job_vacancies(company_id);
CREATE INDEX IF NOT EXISTS job_vacancies_status_created_idx ON public.job_vacancies(status, created_at DESC);

-- Applications: all three list paths + applicant_count subquery (jobs.js:82)
CREATE INDEX IF NOT EXISTS job_applications_job_idx ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS job_applications_seeker_idx ON public.job_applications(seeker_id);
CREATE INDEX IF NOT EXISTS job_applications_referred_idx ON public.job_applications(referred_by) WHERE referred_by IS NOT NULL;

-- History / seeker profile children (every detail page)
CREATE INDEX IF NOT EXISTS job_status_history_job_idx ON public.job_status_history(job_id);
CREATE INDEX IF NOT EXISTS application_status_history_app_idx ON public.application_status_history(application_id);
CREATE INDEX IF NOT EXISTS resumes_seeker_idx ON public.resumes(seeker_id);
CREATE INDEX IF NOT EXISTS resumes_path_idx ON public.resumes(file_path);
CREATE INDEX IF NOT EXISTS education_seeker_idx ON public.education(seeker_id);
CREATE INDEX IF NOT EXISTS work_experience_seeker_idx ON public.work_experience(seeker_id);
CREATE INDEX IF NOT EXISTS employment_history_seeker_idx ON public.employment_history(seeker_id);

-- Accreditation + documents
CREATE INDEX IF NOT EXISTS employer_accreditations_company_idx ON public.employer_accreditations(company_id);
CREATE INDEX IF NOT EXISTS employer_accreditations_status_idx ON public.employer_accreditations(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS employer_documents_company_idx ON public.employer_documents(company_id);
CREATE INDEX IF NOT EXISTS employer_documents_path_idx ON public.employer_documents(file_path);

-- Notifications: always WHERE user_id ORDER BY created_at DESC LIMIT 50
DROP INDEX IF EXISTS public.notifications_user_idx;
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id, created_at DESC);

-- Correctness: exactly one active resume per seeker (was app-only)
CREATE UNIQUE INDEX IF NOT EXISTS resumes_one_active_uidx ON public.resumes(seeker_id) WHERE is_active;

-- Correctness: accreditation_status should be the enum, not free text.
-- Guarded: only converts when every non-null value is a valid enum label.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.employers
    WHERE accreditation_status IS NOT NULL
      AND accreditation_status NOT IN ('none','pending','approved','rejected','resubmission','revoked')
  ) THEN
    RAISE NOTICE 'skipping accreditation_status type fix: unexpected values present';
  ELSE
    ALTER TABLE public.employers
      ALTER COLUMN accreditation_status TYPE accreditation_status
      USING accreditation_status::accreditation_status;
  END IF;
END $$;

-- Trigger kept in sync with db/schema.sql: assign the enum directly.
CREATE OR REPLACE FUNCTION public.sync_employer_accreditation_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.employers
  SET
    accreditation_status  = NEW.status,
    accreditation_remarks = CASE
      WHEN NEW.status IN ('rejected', 'revoked', 'resubmission') THEN NEW.remarks
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = NEW.company_id;
  RETURN NEW;
END $$;

COMMIT;

-- =============================================================================
-- ROLLBACK (run only if forward caused a problem; backup: see audit summary)
-- =============================================================================
-- ALTER TABLE public.employers ALTER COLUMN accreditation_status TYPE text USING accreditation_status::text;
-- DROP INDEX IF EXISTS public.resumes_one_active_uidx;
-- DROP INDEX IF EXISTS public.notifications_user_created_idx;
-- CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id);
-- DROP INDEX IF EXISTS public.employer_documents_path_idx;
-- DROP INDEX IF EXISTS public.employer_documents_company_idx;
-- DROP INDEX IF EXISTS public.employer_accreditations_status_idx;
-- DROP INDEX IF EXISTS public.employer_accreditations_company_idx;
-- DROP INDEX IF EXISTS public.employment_history_seeker_idx;
-- DROP INDEX IF EXISTS public.work_experience_seeker_idx;
-- DROP INDEX IF EXISTS public.education_seeker_idx;
-- DROP INDEX IF EXISTS public.resumes_path_idx;
-- DROP INDEX IF EXISTS public.resumes_seeker_idx;
-- DROP INDEX IF EXISTS public.application_status_history_app_idx;
-- DROP INDEX IF EXISTS public.job_status_history_job_idx;
-- DROP INDEX IF EXISTS public.job_applications_referred_idx;
-- DROP INDEX IF EXISTS public.job_applications_seeker_idx;
-- DROP INDEX IF EXISTS public.job_applications_job_idx;
-- DROP INDEX IF EXISTS public.job_vacancies_status_created_idx;
-- DROP INDEX IF EXISTS public.job_vacancies_company_idx;
