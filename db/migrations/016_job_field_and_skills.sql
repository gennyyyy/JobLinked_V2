-- =============================================================================
-- 016_job_field_and_skills.sql — structured field + skills, shared vocabulary
-- Apply: psql -d joblinked -f db/migrations/016_job_field_and_skills.sql
-- (db/schema.sql is updated to match; this file upgrades existing DBs.)
--
-- What it adds:
--   1. job_vacancies.field / job_vacancies.skills — the posting's field and the
--      skills it asks for. `tags` keeps its meaning ("highlights") and is not
--      touched.
--   2. job_seekers.field — the seeker's field, from the same vocabulary.
--   3. Controlled vocabularies in reference_data: categories 'job_field' and
--      'skill'. The same rows live in db/seed.sql for fresh installs.
--   4. A backfill: every distinct existing seeker skill becomes a 'skill'
--      vocabulary row, so no legacy value is lost before validation starts.
--
-- Safe to re-run via the ledger: every statement is guarded, nothing here is
-- destructive, and no existing row is rewritten. The two CREATE INDEX calls are
-- plain (transactional) and take a short write lock on job_vacancies.
--
-- ROLLBACK (manual, only if this migration must be undone):
--   delete from public.reference_data where category in ('job_field', 'skill');
--   drop index if exists public.job_vacancies_field_idx;
--   drop index if exists public.job_vacancies_skills_gin;
--   alter table public.job_seekers  drop column if exists field;
--   alter table public.job_vacancies drop column if exists skills;
--   alter table public.job_vacancies drop column if exists field;
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Structured columns. Legacy rows stay valid: field null, skills '{}'.
-- -----------------------------------------------------------------------------
alter table public.job_vacancies add column if not exists field  text;
alter table public.job_vacancies add column if not exists skills text[] not null default '{}';
alter table public.job_seekers  add column if not exists field  text;

create index if not exists job_vacancies_skills_gin on public.job_vacancies using gin (skills);
create index if not exists job_vacancies_field_idx  on public.job_vacancies (field);

-- -----------------------------------------------------------------------------
-- 2. Controlled vocabularies. Same rows as db/seed.sql — keep the two lists in
--    sync (db/migrations/016_job_field_and_skills.test.js fails otherwise).
-- -----------------------------------------------------------------------------
insert into public.reference_data (category, value, sort_order) values
  ('job_field', 'Administrative & Office',        1),
  ('job_field', 'Sales & Retail',                 2),
  ('job_field', 'Food & Beverage',                3),
  ('job_field', 'Production & Manufacturing',     4),
  ('job_field', 'Construction',                   5),
  ('job_field', 'Logistics & Delivery',           6),
  ('job_field', 'Customer Service',               7),
  ('job_field', 'Healthcare',                     8),
  ('job_field', 'Education',                      9),
  ('job_field', 'Information Technology',        10),
  ('job_field', 'Finance & Accounting',          11),
  ('job_field', 'Human Resources',               12),
  ('job_field', 'Engineering',                   13),
  ('job_field', 'Maintenance & Repair',          14),
  ('job_field', 'Security Services',             15)
on conflict (category, value) do nothing;

insert into public.reference_data (category, value, sort_order) values
  ('skill', 'Customer Service',       1),
  ('skill', 'Cashiering',             2),
  ('skill', 'Inventory',              3),
  ('skill', 'MS Excel',               4),
  ('skill', 'Data Entry',             5),
  ('skill', 'Welding',                6),
  ('skill', 'Electrical Wiring',      7),
  ('skill', 'Driving',                8),
  ('skill', 'Food Preparation',       9),
  ('skill', 'Housekeeping',          10),
  ('skill', 'Sales',                 11),
  ('skill', 'Communication',         12),
  ('skill', 'Teamwork',              13),
  ('skill', 'Attention to Detail',   14),
  ('skill', 'Time Management',       15),
  ('skill', 'Problem Solving',       16),
  ('skill', 'POS Operation',         17),
  ('skill', 'Merchandising',         18),
  ('skill', 'Stocking',              19),
  ('skill', 'Order Picking',         20),
  ('skill', 'Packing',               21),
  ('skill', 'Forklift Operation',    22),
  ('skill', 'Delivery',              23),
  ('skill', 'Route Planning',        24),
  ('skill', 'Plumbing',              25),
  ('skill', 'Carpentry',             26),
  ('skill', 'Masonry',               27),
  ('skill', 'Painting',              28),
  ('skill', 'Machine Operation',     29),
  ('skill', 'Quality Control',       30),
  ('skill', 'Assembly',              31),
  ('skill', 'Soldering',             32),
  ('skill', 'Sewing',                33),
  ('skill', 'Food Safety',           34),
  ('skill', 'Cooking',               35),
  ('skill', 'Baking',                36),
  ('skill', 'Barista Skills',        37),
  ('skill', 'Serving',               38),
  ('skill', 'Cleaning',              39),
  ('skill', 'Laundry',               40),
  ('skill', 'Front Desk',            41),
  ('skill', 'Phone Handling',        42),
  ('skill', 'Bookkeeping',           43),
  ('skill', 'Billing',               44),
  ('skill', 'MS Word',               45),
  ('skill', 'Typing',                46),
  ('skill', 'Filing',                47),
  ('skill', 'Scheduling',            48),
  ('skill', 'Report Writing',        49),
  ('skill', 'Leadership',            50),
  ('skill', 'Supervisory Skills',    51),
  ('skill', 'Recruitment',           52),
  ('skill', 'Patient Care',          53),
  ('skill', 'Caregiving',            54),
  ('skill', 'First Aid',             55),
  ('skill', 'Teaching',              56),
  ('skill', 'Computer Literacy',     57),
  ('skill', 'Troubleshooting',       58),
  ('skill', 'Air Conditioning Repair', 59),
  ('skill', 'Security Guarding',     60)
on conflict (category, value) do nothing;

-- -----------------------------------------------------------------------------
-- 3. No skill is lost: every distinct existing seeker skill becomes a
--    vocabulary entry. A value already covered case-insensitively by the
--    canonical rows above (e.g. seeker 'ms excel' vs vocabulary 'MS Excel') is
--    left alone so the vocabulary never holds two casings of one skill;
--    anything else keeps the lowercase form the profile write path stores.
-- -----------------------------------------------------------------------------
insert into public.reference_data (category, value, sort_order)
select 'skill', s, 1000 + row_number() over (order by s)
from (select distinct trim(lower(skill)) s
      from public.job_seekers, unnest(skills) as skill
      where trim(skill) <> '') existing
where not exists (
  select 1 from public.reference_data r
  where r.category = 'skill' and lower(r.value) = existing.s
)
on conflict (category, value) do nothing;

COMMIT;
