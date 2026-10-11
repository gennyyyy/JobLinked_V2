ALTER TABLE public.job_vacancies
  ADD COLUMN IF NOT EXISTS work_arrangement text NOT NULL DEFAULT 'On-site'
  CHECK (work_arrangement IN ('On-site', 'Remote / Work from home', 'Hybrid'));
