-- =============================================================================
-- JobLinked · Dev fixture seeds for the authed browser smoke (Phase 3,
-- docs/plan/2026-11-04-05-testing-plan.md)
--
-- NOT reference data, NOT for deployment: three role rows + one pending-review
-- employer + one published vacancy that `npm run smoke` drives through the UI.
-- Apply to the SAME database the dev API uses:
--
--   psql -U postgres -h localhost -d joblinked -f db/seed-dev.sql
--
-- The Supabase side (auth users with these exact UUIDs + a per-run generated
-- password) is created by scripts/system-check.mjs; credentials never live in
-- the repo. Keep the constants here and in that script in sync.
-- Idempotent: re-running changes nothing. No schema changes.
-- =============================================================================

-- Smoke seeker (browses + applies).
insert into public.job_seekers
  (id, first_name, last_name, full_name, email, barangay_district, city_municipality, province_state,
   skills, employment_status, preferred_position, preferred_location)
values
  ('5eed0000-0000-4000-8000-000000000001', 'smoke', 'seeker', 'smoke seeker', 'smoke.seeker@joblinked.test',
   'Poblacion', 'Santa Maria', 'Bulacan', '{customer service}', 'Unemployed', 'service crew', 'Poblacion')
on conflict (id) do nothing;

-- Smoke employer (applicants + status change). Accredited so its vacancy is
-- browsable and applies cleanly.
insert into public.employers
  (id, first_name, last_name, full_name, email, company_name, company_email, industry,
   barangay_district, city_municipality, province_state, representative_position)
values
  ('5eed0000-0000-4000-8000-000000000002', 'smoke', 'employer', 'smoke employer', 'smoke.employer@joblinked.test',
   'smoke test company', 'smoke.employer@joblinked.test', 'Food & Beverage',
   'Poblacion', 'Santa Maria', 'Bulacan', 'store manager')
on conflict (id) do nothing;

-- Subject of the admin approval step. Never logs in.
insert into public.employers
  (id, first_name, last_name, full_name, email, company_name, company_email, industry,
   barangay_district, city_municipality, province_state, representative_position)
values
  ('5eed0000-0000-4000-8000-000000000003', 'smoke', 'pending', 'smoke pending', 'smoke.pending@joblinked.test',
   'smoke pending fixture co.', 'smoke.pending@joblinked.test', 'Retail / Construction Supply',
   'San Jose', 'Santa Maria', 'Bulacan', 'branch supervisor')
on conflict (id) do nothing;

-- Smoke super-admin (approve + CSV download).
insert into public.super_admins (id, first_name, last_name, full_name, email)
values
  ('5eed0000-0000-4000-8000-000000000004', 'smoke', 'admin', 'smoke admin', 'smoke.admin@joblinked.test')
on conflict (id) do nothing;

-- Accreditation state; the sync trigger mirrors these onto employers.
-- employer A approved → its vacancy passes the browse gate. The pending fixture
-- gives the admin queue a real row to approve; the smoke re-opens it (through
-- POST /api/accreditations) before every run, so re-runs always find one.
insert into public.employer_accreditations (id, company_id, status, remarks, decided_at)
values
  ('5eed0000-0000-4000-8000-000000000022', '5eed0000-0000-4000-8000-000000000002', 'approved', 'seed-dev fixture', now())
on conflict (id) do nothing;

insert into public.employer_accreditations (id, company_id, status)
values
  ('5eed0000-0000-4000-8000-000000000021', '5eed0000-0000-4000-8000-000000000003', 'pending')
on conflict (id) do nothing;

-- The one published vacancy: browsed, applied to and deep-linked by the smoke.
insert into public.job_vacancies
  (id, company_id, title, office, location, employment_type, work_arrangement, salary_min, salary_max,
   description, requirements, benefits, vacancies, deadline, instructions, tags, status, published_at)
values
  ('5eed0000-0000-4000-8000-000000000011', '5eed0000-0000-4000-8000-000000000002', 'Smoke Test Service Crew',
   'smoke test company', 'Poblacion', 'Full-time', 'On-site', 15000, 18000,
   'Fixture vacancy driven by scripts/system-check.mjs. Safe to close or delete on a real deployment.',
   'No experience required; willing to learn.', 'SSS, PhilHealth, Pag-IBIG', 1, current_date + 30,
   'Apply through JobLinked and attach your resume.', '{customer service}', 'published', now())
on conflict (id) do nothing;
