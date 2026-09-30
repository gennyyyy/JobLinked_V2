-- =============================================================================
-- JobLinked · Supabase Migration
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- This file is the single source of truth for the current schema.
-- It is safe to run on a fresh database OR on an existing one (idempotent).
-- All legacy partial-migration files (role_tables_migration.sql,
-- role_tables_post_migration.sql, add_revoked_accreditation.sql,
-- remove_job_approval.sql) are superseded by this file.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Drop old trigger FIRST so no new writes go to the legacy companies/profiles
-- tables while this migration is running.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin create type user_role          as enum ('super-admin','employer','job-seeker'); exception when duplicate_object then null; end $$;
do $$ begin create type account_status     as enum ('active','inactive','suspended');       exception when duplicate_object then null; end $$;
do $$ begin create type job_status         as enum ('draft','pending','approved','rejected','published','closed','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type application_status as enum ('Applied','Under Review','Shortlisted','Interview','Accepted','Rejected','Placed'); exception when duplicate_object then null; end $$;
do $$ begin create type accreditation_status as enum ('none','pending','approved','rejected','resubmission'); exception when duplicate_object then null; end $$;
do $$ begin create type document_status    as enum ('pending','verified','rejected','missing'); exception when duplicate_object then null; end $$;
do $$ begin create type fb_post_status     as enum ('pending','posting','posted','failed','retry'); exception when duplicate_object then null; end $$;

-- Enum value additions (safe on both fresh and existing databases)
alter type application_status    add value if not exists 'Placed';
alter type application_status    add value if not exists 'Terminated';
alter type accreditation_status  add value if not exists 'revoked';

-- ---------------------------------------------------------------------------
-- Role tables  (auth.users.id == role-table.id — no separate profiles/companies)
-- ---------------------------------------------------------------------------
create table if not exists public.job_seekers (
  id                   uuid        primary key references auth.users(id) on delete cascade,
  first_name           text        not null default '',
  middle_name          text        not null default '',
  last_name            text        not null default '',
  suffix               text        not null default '',
  full_name            text        not null default '',
  email                text        not null default '',
  phone                text,
  house_number_unit    text,
  street_address       text,
  subdivision_building text,
  barangay_district    text,
  city_municipality    text,
  province_state       text,
  postal_code          text,
  country              text        not null default 'Philippines',
  birthdate            date,
  skills               text[]      not null default '{}',
  employment_status    text,
  preferred_position   text,
  preferred_location   text,
  status               account_status not null default 'active',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.employers (
  id                     uuid        primary key references auth.users(id) on delete cascade,
  first_name             text        not null default '',
  middle_name            text        not null default '',
  last_name              text        not null default '',
  suffix                 text        not null default '',
  full_name              text        not null default '',
  email                  text        not null default '',
  phone                  text,
  company_name           text        not null default '',
  company_email          text,
  industry               text,
  house_number_unit      text,
  street_address         text,
  subdivision_building   text,
  barangay_district      text,
  city_municipality      text,
  province_state         text,
  postal_code            text,
  country                text        not null default 'Philippines',
  representative_email   text,
  representative_position text,
  website                text,
  description            text,
  logo_path              text,
  -- Denormalised accreditation state — kept in sync by documents.js so any
  -- page can read status without a join to employer_accreditations.
  accreditation_status   text        default null,
  accreditation_remarks  text        default null,
  status                 account_status not null default 'active',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Add columns to existing installations
alter table public.employers add column if not exists accreditation_status  text default null;
alter table public.employers add column if not exists accreditation_remarks text default null;

-- ---------------------------------------------------------------------------
-- Migrate legacy data from profiles + companies → role tables
-- (Only runs if the old tables still exist. Safe no-op on a fresh install.)
-- ---------------------------------------------------------------------------
do $$
begin
  -- ── job_seekers ──────────────────────────────────────────────────────────
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    insert into public.job_seekers (
      id, first_name, middle_name, last_name, suffix, full_name, email, phone,
      house_number_unit, street_address, subdivision_building, barangay_district,
      city_municipality, province_state, postal_code, country, birthdate,
      skills, employment_status, preferred_position, preferred_location, status, created_at, updated_at
    )
    select
      id, first_name, middle_name, last_name, suffix, full_name, email, phone,
      house_number_unit, street_address, subdivision_building, barangay_district,
      city_municipality, province_state, postal_code, country, birthdate,
      coalesce(skills, '{}'), employment_status, preferred_position, preferred_location,
      status, created_at, updated_at
    from public.profiles where role = 'job-seeker'
    on conflict (id) do update set updated_at = excluded.updated_at;

    -- ── super_admins ────────────────────────────────────────────────────────
    insert into public.super_admins (
      id, first_name, middle_name, last_name, suffix, full_name, email, status, created_at, updated_at
    )
    select id, first_name, middle_name, last_name, suffix, full_name, email, status, created_at, updated_at
    from public.profiles where role = 'super-admin'
    on conflict (id) do update set updated_at = excluded.updated_at;
  end if;

  -- ── employers (from profiles + companies join) ───────────────────────────
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'companies')
  and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    insert into public.employers (
      id, first_name, middle_name, last_name, suffix, full_name, email, phone,
      company_name, company_email, industry,
      house_number_unit, street_address, subdivision_building, barangay_district,
      city_municipality, province_state, postal_code, country,
      representative_email, representative_position, website, description, logo_path,
      status, created_at, updated_at
    )
    select
      p.id, p.first_name, p.middle_name, p.last_name, p.suffix, p.full_name,
      p.email, p.phone,
      coalesce(c.name, ''), c.email, c.industry,
      c.house_number_unit, c.street_address, c.subdivision_building, c.barangay_district,
      c.city_municipality, c.province_state, c.postal_code, coalesce(c.country, 'Philippines'),
      c.representative_email, c.representative_position, c.website, c.description, c.logo_path,
      p.status, p.created_at, greatest(p.updated_at, coalesce(c.updated_at, p.updated_at))
    from public.profiles p
    left join public.companies c on c.owner_id = p.id
    where p.role = 'employer'
    on conflict (id) do update set updated_at = excluded.updated_at;
  end if;

  -- ── Re-point FKs from legacy companies.id → employers.id ─────────────────
  -- employer_accreditations.company_id
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'companies') then
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'employer_accreditations'
               and column_name = 'company_id') then
      -- Drop old FK if it points to companies
      alter table public.employer_accreditations
        drop constraint if exists employer_accreditations_company_id_fkey;
      -- Re-point rows: company uuid → owner's auth uuid
      update public.employer_accreditations a
      set company_id = c.owner_id
      from public.companies c
      where a.company_id = c.id
        and a.company_id != c.owner_id;
    end if;

    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'employer_documents'
               and column_name = 'company_id') then
      alter table public.employer_documents
        drop constraint if exists employer_documents_company_id_fkey;
      update public.employer_documents d
      set company_id = c.owner_id
      from public.companies c
      where d.company_id = c.id
        and d.company_id != c.owner_id;
    end if;

    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'job_vacancies'
               and column_name = 'company_id') then
      alter table public.job_vacancies
        drop constraint if exists job_vacancies_company_id_fkey;
      update public.job_vacancies j
      set company_id = c.owner_id
      from public.companies c
      where j.company_id = c.id
        and j.company_id != c.owner_id;
    end if;

    -- Now drop the legacy tables (cascades handle remaining FK refs)
    drop table if exists public.companies cascade;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    drop table if exists public.profiles cascade;
  end if;
end $$;

create table if not exists public.super_admins (
  id         uuid        primary key references auth.users(id) on delete cascade,
  first_name text        not null default '',
  middle_name text       not null default '',
  last_name  text        not null default '',
  suffix     text        not null default '',
  full_name  text        not null default '',
  email      text        not null default '',
  status     account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Backfill accreditation_status for existing employers
-- (safe to run multiple times — only touches rows where column is still null)
-- ---------------------------------------------------------------------------
update public.employers e
set
  accreditation_status = (
    select a.status::text
    from public.employer_accreditations a
    where a.company_id = e.id
    order by a.submitted_at desc
    limit 1
  ),
  accreditation_remarks = (
    select a.remarks
    from public.employer_accreditations a
    where a.company_id = e.id
      and a.status in ('rejected', 'revoked', 'resubmission')
    order by a.submitted_at desc
    limit 1
  )
where e.accreditation_status is null;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from public.super_admins where id = auth.uid()) $$;

create or replace function public.is_accredited_employer(target_company_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.employer_accreditations
    where company_id = target_company_id
      and status = 'approved'
      and company_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS — role tables
-- ---------------------------------------------------------------------------
alter table public.job_seekers  enable row level security;
alter table public.employers    enable row level security;
alter table public.super_admins enable row level security;

drop policy if exists job_seekers_select on public.job_seekers;
drop policy if exists job_seekers_write  on public.job_seekers;
create policy job_seekers_select on public.job_seekers for select using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.job_applications a
    join public.job_vacancies j on j.id = a.job_id
    where a.seeker_id = job_seekers.id and j.company_id = auth.uid()
  )
);
create policy job_seekers_write on public.job_seekers for all
  using  (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists employers_select on public.employers;
drop policy if exists employers_write  on public.employers;
create policy employers_select on public.employers for select using (true);
create policy employers_write  on public.employers for all
  using  (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- Restrict anon access: only public columns visible without a session
revoke select on public.employers from anon;
grant  select (id, company_name, logo_path) on public.employers to anon;

drop policy if exists super_admins_select on public.super_admins;
drop policy if exists super_admins_write  on public.super_admins;
create policy super_admins_select on public.super_admins for select using (id = auth.uid() or public.is_admin());
create policy super_admins_write  on public.super_admins for all
  using  (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table if not exists public.reference_data (
  id         bigint generated always as identity primary key,
  category   text not null,
  value      text not null,
  sort_order int  not null default 0,
  unique (category, value)
);

alter table public.reference_data enable row level security;
drop policy if exists reference_select on public.reference_data;
drop policy if exists reference_write  on public.reference_data;
create policy reference_select on public.reference_data for select using (true);
create policy reference_write  on public.reference_data for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Accreditation
-- ---------------------------------------------------------------------------
create table if not exists public.employer_accreditations (
  id          uuid               primary key default gen_random_uuid(),
  company_id  uuid               not null references public.employers(id) on delete cascade,
  status      accreditation_status not null default 'pending',
  remarks     text,
  decided_by  uuid               references public.super_admins(id) on delete set null,
  submitted_at timestamptz       not null default now(),
  decided_at  timestamptz
);

alter table public.employer_accreditations enable row level security;
drop policy if exists accred_select on public.employer_accreditations;
drop policy if exists accred_insert on public.employer_accreditations;
drop policy if exists accred_update on public.employer_accreditations;
create policy accred_select on public.employer_accreditations for select
  using (public.is_admin() or company_id = auth.uid());
create policy accred_insert on public.employer_accreditations for insert
  with check (public.is_admin() or company_id = auth.uid());
create policy accred_update on public.employer_accreditations for update
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.employer_documents (
  id               uuid            primary key default gen_random_uuid(),
  company_id       uuid            not null references public.employers(id) on delete cascade,
  accreditation_id uuid            references public.employer_accreditations(id) on delete set null,
  doc_type         text            not null,
  file_path        text            not null,
  file_name        text            not null,
  status           document_status not null default 'pending',
  remarks          text,
  uploaded_at      timestamptz     not null default now(),
  reviewed_by      uuid            references public.super_admins(id) on delete set null,
  reviewed_at      timestamptz
);

alter table public.employer_documents enable row level security;
drop policy if exists docs_select on public.employer_documents;
drop policy if exists docs_insert on public.employer_documents;
drop policy if exists docs_update on public.employer_documents;
drop policy if exists docs_delete on public.employer_documents;
create policy docs_select on public.employer_documents for select
  using (public.is_admin() or company_id = auth.uid());
create policy docs_insert on public.employer_documents for insert
  with check (public.is_admin() or company_id = auth.uid());
create policy docs_update on public.employer_documents for update
  using  (public.is_admin() or company_id = auth.uid())
  with check (public.is_admin() or company_id = auth.uid());
create policy docs_delete on public.employer_documents for delete
  using (public.is_admin() or company_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create table if not exists public.job_vacancies (
  id              uuid        primary key default gen_random_uuid(),
  company_id      uuid        not null references public.employers(id) on delete cascade,
  title           text        not null,
  office          text,
  location        text,
  employment_type text,
  salary_min      numeric,
  salary_max      numeric,
  description     text,
  requirements    text,
  benefits        text,
  vacancies       int         not null default 1,
  deadline        date,
  instructions    text,
  tags            text[]      not null default '{}',
  status          job_status  not null default 'draft',
  remarks         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  published_at    timestamptz,
  closed_at       timestamptz,
  archived_at     timestamptz
);

-- Remove old approval gate if it exists
drop trigger   if exists job_approval_gate on public.job_vacancies;
drop function  if exists public.enforce_job_approval();

-- Flush any rows stuck in the old pending/approved state
update public.job_vacancies
set status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
where status in ('pending', 'approved');

alter table public.job_vacancies enable row level security;
drop policy if exists jobs_select on public.job_vacancies;
drop policy if exists jobs_insert on public.job_vacancies;
drop policy if exists jobs_update on public.job_vacancies;
drop policy if exists jobs_delete on public.job_vacancies;
create policy jobs_select on public.job_vacancies for select
  using (status = 'published' or public.is_admin() or company_id = auth.uid());
create policy jobs_insert on public.job_vacancies for insert
  with check (public.is_admin() or public.is_accredited_employer(company_id));
create policy jobs_update on public.job_vacancies for update
  using  (public.is_admin() or public.is_accredited_employer(company_id))
  with check (public.is_admin() or public.is_accredited_employer(company_id));
create policy jobs_delete on public.job_vacancies for delete
  using (public.is_admin());

create table if not exists public.job_status_history (
  id         bigint generated always as identity primary key,
  job_id     uuid         not null references public.job_vacancies(id) on delete cascade,
  status     job_status   not null,
  remarks    text,
  changed_by uuid         references auth.users(id) on delete set null,
  changed_at timestamptz  not null default now()
);

alter table public.job_status_history enable row level security;
drop policy if exists jobhist_select on public.job_status_history;
drop policy if exists jobhist_insert on public.job_status_history;
create policy jobhist_select on public.job_status_history for select
  using (public.is_admin() or exists (
    select 1 from public.job_vacancies where id = job_id and company_id = auth.uid()
  ));
create policy jobhist_insert on public.job_status_history for insert
  with check (public.is_admin() or exists (
    select 1 from public.job_vacancies where id = job_id and company_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Resumes + applications
-- ---------------------------------------------------------------------------
create table if not exists public.resumes (
  id          uuid        primary key default gen_random_uuid(),
  seeker_id   uuid        not null references public.job_seekers(id) on delete cascade,
  file_path   text        not null,
  file_name   text        not null,
  is_active   boolean     not null default true,
  uploaded_at timestamptz not null default now()
);

alter table public.resumes enable row level security;
drop policy if exists resumes_select on public.resumes;
drop policy if exists resumes_write  on public.resumes;
create policy resumes_select on public.resumes for select
  using (
    seeker_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.job_applications a
      join public.job_vacancies j on j.id = a.job_id
      where a.seeker_id = resumes.seeker_id and j.company_id = auth.uid()
    )
  );
create policy resumes_write on public.resumes for all
  using  (seeker_id = auth.uid())
  with check (seeker_id = auth.uid());

create table if not exists public.job_applications (
  id                     uuid               primary key default gen_random_uuid(),
  job_id                 uuid               not null references public.job_vacancies(id) on delete cascade,
  seeker_id              uuid               not null references public.job_seekers(id)  on delete cascade,
  resume_id              uuid               references public.resumes(id) on delete set null,
  status                 application_status not null default 'Applied',
  employer_notes         text,
  interview_at           timestamptz,
  interview_instructions text,
  applied_at             timestamptz        not null default now(),
  updated_at             timestamptz        not null default now(),
  unique (job_id, seeker_id)
);

-- Referral tracking (Phase 3): who referred this applicant, if anyone.
-- NOTE: once this column exists, job_applications has two FKs to job_seekers,
-- so PostgREST can no longer disambiguate a bare `seeker:job_seekers` embed —
-- the app fetches seekers separately (see attachSeekers in services/applications.js).
alter table public.job_applications add column if not exists referred_by uuid references public.job_seekers(id) on delete set null;

alter table public.job_applications enable row level security;
drop policy if exists apps_select on public.job_applications;
drop policy if exists apps_insert on public.job_applications;
drop policy if exists apps_update on public.job_applications;
drop policy if exists apps_delete on public.job_applications;
create policy apps_select on public.job_applications for select
  using (
    seeker_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.job_vacancies where id = job_id and company_id = auth.uid())
  );
create policy apps_insert on public.job_applications for insert
  with check (
    seeker_id = auth.uid()
    and exists (select 1 from public.job_vacancies where id = job_id and status = 'published')
  );
create policy apps_update on public.job_applications for update
  using  (public.is_admin() or exists (select 1 from public.job_vacancies where id = job_id and company_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.job_vacancies where id = job_id and company_id = auth.uid()));
create policy apps_delete on public.job_applications for delete
  using (public.is_admin());

create table if not exists public.application_status_history (
  id             bigint generated always as identity primary key,
  application_id uuid               not null references public.job_applications(id) on delete cascade,
  status         application_status not null,
  remarks        text,
  changed_by     uuid               references auth.users(id) on delete set null,
  changed_at     timestamptz        not null default now()
);

alter table public.application_status_history enable row level security;
drop policy if exists apphist_select on public.application_status_history;
drop policy if exists apphist_insert on public.application_status_history;
create policy apphist_select on public.application_status_history for select
  using (
    public.is_admin()
    or exists (select 1 from public.job_applications where id = application_id and seeker_id = auth.uid())
    or exists (
      select 1 from public.job_applications a
      join public.job_vacancies j on j.id = a.job_id
      where a.id = application_id and j.company_id = auth.uid()
    )
  );
create policy apphist_insert on public.application_status_history for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.job_applications where id = application_id and seeker_id = auth.uid())
    or exists (
      select 1 from public.job_applications a
      join public.job_vacancies j on j.id = a.job_id
      where a.id = application_id and j.company_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Seeker profile detail
-- ---------------------------------------------------------------------------
create table if not exists public.education (
  id        bigint generated always as identity primary key,
  seeker_id uuid not null references public.job_seekers(id) on delete cascade,
  level     text not null,
  school    text not null,
  field     text,
  start_year int,
  end_year   int
);

create table if not exists public.work_experience (
  id          bigint generated always as identity primary key,
  seeker_id   uuid not null references public.job_seekers(id) on delete cascade,
  company     text not null,
  position    text not null,
  start_date  date,
  end_date    date,
  description text
);

create table if not exists public.employment_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.job_applications(id) on delete cascade,
  seeker_id uuid not null references public.job_seekers(id) on delete cascade,
  employer_name text not null,
  position text not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.employment_history add column if not exists application_id uuid references public.job_applications(id) on delete cascade;
update public.employment_history h
set application_id = a.id
from public.job_applications a
join public.job_vacancies j on j.id = a.job_id
join public.employers e on e.id = j.company_id
where h.application_id is null
  and h.seeker_id = a.seeker_id
  and h.employer_name = e.company_name
  and h.position = j.title
  and h.id = (
    select h2.id from public.employment_history h2
    where h2.application_id is null
      and h2.seeker_id = a.seeker_id
      and h2.employer_name = e.company_name
      and h2.position = j.title
    order by h2.created_at
    limit 1
  )
  and not exists (select 1 from public.employment_history x where x.application_id = a.id);
delete from public.employment_history newer
using public.employment_history older
where newer.seeker_id = older.seeker_id
  and newer.employer_name = older.employer_name
  and newer.position = older.position
  and newer.start_date is not distinct from older.start_date
  and newer.end_date is not distinct from older.end_date
  and newer.is_current = older.is_current
  and newer.created_at > older.created_at;
create unique index if not exists employment_history_application_uidx on public.employment_history(application_id) where application_id is not null;

alter table public.employment_history enable row level security;
drop policy if exists employment_history_select on public.employment_history;
drop policy if exists employment_history_write on public.employment_history;
create policy employment_history_select on public.employment_history for select using (seeker_id = auth.uid() or public.is_admin());
create policy employment_history_write on public.employment_history for all
  using (seeker_id = auth.uid() or public.is_admin())
  with check (seeker_id = auth.uid() or public.is_admin());

delete from public.employment_history newer
using public.employment_history older
where newer.seeker_id = older.seeker_id
  and newer.employer_name = older.employer_name
  and newer.position = older.position
  and newer.is_current
  and older.is_current
  and newer.created_at > older.created_at;

create or replace function public.record_accepted_employment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_employer_name text; v_job_title text; v_history_id uuid;
begin
  select e.company_name, j.title into v_employer_name, v_job_title
  from public.job_vacancies j
  join public.employers e on e.id = j.company_id
  where j.id = new.job_id;

  if new.status in ('Accepted', 'Placed') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select id into v_history_id from public.employment_history where application_id = new.id limit 1;
    if v_history_id is null then
      update public.employment_history
      set is_current = false, end_date = coalesce(end_date, current_date)
      where seeker_id = new.seeker_id and is_current;
      insert into public.employment_history (application_id, seeker_id, employer_name, position, start_date, is_current)
      values (new.id, new.seeker_id, coalesce(v_employer_name, 'Employer'), coalesce(v_job_title, 'Position'), current_date, true);
    else
      update public.employment_history
      set is_current = true, end_date = null
      where id = v_history_id;
    end if;
  elsif new.status = 'Terminated' and (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    update public.employment_history
    set is_current = false, end_date = coalesce(end_date, current_date)
    where application_id = new.id and is_current;
  end if;
  return new;
end $$;

drop trigger if exists record_accepted_employment on public.job_applications;
create trigger record_accepted_employment
after insert or update of status on public.job_applications
for each row execute function public.record_accepted_employment();

insert into public.employment_history (application_id, seeker_id, employer_name, position, start_date, is_current)
select a.id, a.seeker_id, e.company_name, j.title, coalesce(a.applied_at::date, current_date), true
from public.job_applications a
join public.job_vacancies j on j.id = a.job_id
join public.employers e on e.id = j.company_id
where a.status in ('Accepted', 'Placed')
  and not exists (select 1 from public.employment_history h where h.application_id = a.id);

do $$
declare t text;
begin
  foreach t in array array['public.education','public.work_experience'] loop
    execute format('alter table %s enable row level security', t);
    execute format('drop policy if exists detail_select on %s', t);
    execute format('drop policy if exists detail_write  on %s', t);
    execute format('
      create policy detail_select on %s for select using (
        seeker_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.job_applications a
          join public.job_vacancies j on j.id = a.job_id
          where a.seeker_id = seeker_id and j.company_id = auth.uid()
        )
      )', t);
    execute format('
      create policy detail_write on %s for all
        using  (seeker_id = auth.uid() or public.is_admin())
        with check (seeker_id = auth.uid() or public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  type       text        not null,
  title      text        not null,
  message    text        not null,
  link       text,
  is_read    boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
drop policy if exists notif_select on public.notifications;
drop policy if exists notif_insert on public.notifications;
drop policy if exists notif_update on public.notifications;
drop policy if exists notif_delete on public.notifications;
create policy notif_select on public.notifications for select using (user_id = auth.uid());
create policy notif_insert on public.notifications for insert with check (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.job_applications a
    join public.job_vacancies j on j.id = a.job_id
    where (a.seeker_id = auth.uid() and j.company_id = user_id)
       or (a.seeker_id = user_id   and j.company_id = auth.uid())
  )
);
create policy notif_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.notify_admins(p_type text, p_title text, p_message text, p_link text default null)
returns void language sql security definer set search_path = public
as $$
  insert into public.notifications (user_id, type, title, message, link)
  select id, p_type, p_title, p_message, p_link from public.super_admins;
$$;
revoke execute on function public.notify_admins(text, text, text, text) from public, anon;
grant  execute on function public.notify_admins(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid        references auth.users(id) on delete set null,
  action     text        not null,
  entity     text,
  entity_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;
drop policy if exists audit_select on public.audit_logs;
drop policy if exists audit_insert on public.audit_logs;
create policy audit_select on public.audit_logs for select using (public.is_admin());
create policy audit_insert on public.audit_logs for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Facebook integration
-- ---------------------------------------------------------------------------
create table if not exists public.facebook_integrations (
  id              uuid        primary key default gen_random_uuid(),
  page_id         text        not null,
  page_name       text        not null,
  access_token    text        not null,
  status          text        not null default 'connected',
  auto_post       boolean     not null default true,
  connected_at    timestamptz not null default now(),
  disconnected_at timestamptz
);

create table if not exists public.facebook_posts (
  id             uuid           primary key default gen_random_uuid(),
  job_id         uuid           not null references public.job_vacancies(id) on delete cascade,
  integration_id uuid           references public.facebook_integrations(id) on delete set null,
  post_id        text,
  post_url       text,
  status         fb_post_status not null default 'pending',
  error          text,
  retry_count    int            not null default 0,
  created_at     timestamptz    not null default now(),
  posted_at      timestamptz
);

do $$
declare t text;
begin
  foreach t in array array['public.facebook_integrations','public.facebook_posts'] loop
    execute format('alter table %s enable row level security', t);
    execute format('drop policy if exists fb_all on %s', t);
    execute format('create policy fb_all on %s for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Auto-create role-table row on user signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare r user_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'job-seeker');
begin
  if r = 'job-seeker' then
    insert into public.job_seekers (
      id, first_name, middle_name, last_name, suffix, full_name, email, phone,
      house_number_unit, street_address, subdivision_building, barangay_district,
      city_municipality, province_state, postal_code, country, birthdate
    ) values (
      new.id,
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'middle_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name', ''),
      coalesce(new.raw_user_meta_data->>'suffix', ''),
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.email,
      new.raw_user_meta_data->>'phone',
      new.raw_user_meta_data->>'house_number_unit',
      new.raw_user_meta_data->>'street_address',
      new.raw_user_meta_data->>'subdivision_building',
      new.raw_user_meta_data->>'barangay_district',
      new.raw_user_meta_data->>'city_municipality',
      new.raw_user_meta_data->>'province_state',
      new.raw_user_meta_data->>'postal_code',
      coalesce(nullif(new.raw_user_meta_data->>'country', ''), 'Philippines'),
      nullif(new.raw_user_meta_data->>'birthdate', '')::date
    ) on conflict (id) do nothing;

  elsif r = 'employer' then
    insert into public.employers (
      id, first_name, middle_name, last_name, suffix, full_name, email, phone,
      company_name, company_email, industry,
      house_number_unit, street_address, subdivision_building, barangay_district,
      city_municipality, province_state, postal_code, country,
      representative_email, representative_position
    ) values (
      new.id,
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'middle_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name', ''),
      coalesce(new.raw_user_meta_data->>'suffix', ''),
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.email,
      new.raw_user_meta_data->>'phone',
      coalesce(new.raw_user_meta_data->>'company_name', ''),
      new.raw_user_meta_data->>'company_email',
      new.raw_user_meta_data->>'industry',
      new.raw_user_meta_data->>'house_number_unit',
      new.raw_user_meta_data->>'street_address',
      new.raw_user_meta_data->>'subdivision_building',
      new.raw_user_meta_data->>'barangay_district',
      new.raw_user_meta_data->>'city_municipality',
      new.raw_user_meta_data->>'province_state',
      new.raw_user_meta_data->>'postal_code',
      coalesce(nullif(new.raw_user_meta_data->>'country', ''), 'Philippines'),
      new.raw_user_meta_data->>'representative_email',
      new.raw_user_meta_data->>'representative_position'
    ) on conflict (id) do nothing;
    -- Auto-create pending accreditation row; accreditation_status will be set
    -- to 'pending' by the trigger below.
    insert into public.employer_accreditations (company_id)
    values (new.id) on conflict do nothing;

  else -- super-admin
    insert into public.super_admins (
      id, first_name, middle_name, last_name, suffix, full_name, email
    ) values (
      new.id,
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'middle_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name', ''),
      coalesce(new.raw_user_meta_data->>'suffix', ''),
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.email
    ) on conflict (id) do nothing;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Trigger: keep employers.accreditation_status in sync automatically
-- (backs up the client-side sync in documents.js with a server-side guarantee)
-- ---------------------------------------------------------------------------
create or replace function public.sync_employer_accreditation_status()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.employers
  set
    accreditation_status  = new.status::text,
    accreditation_remarks = case
      when new.status in ('rejected', 'revoked', 'resubmission') then new.remarks
      else null
    end,
    updated_at = now()
  where id = new.company_id;
  return new;
end $$;

drop trigger if exists trg_sync_accreditation_status on public.employer_accreditations;
create trigger trg_sync_accreditation_status
  after insert or update of status, remarks on public.employer_accreditations
  for each row execute function public.sync_employer_accreditation_status();

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('resumes',   'resumes',   false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

drop policy if exists resumes_owner_write  on storage.objects;
drop policy if exists resumes_auth_read    on storage.objects;
drop policy if exists documents_owner_write on storage.objects;
drop policy if exists documents_auth_read  on storage.objects;

create policy resumes_owner_write on storage.objects for all
  using      (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy resumes_auth_read on storage.objects for select
  using (
    bucket_id = 'resumes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.job_applications a
        join public.job_vacancies j on j.id = a.job_id
        where j.company_id = auth.uid()
          and a.seeker_id::text = (storage.foldername(name))[1]
      )
    )
  );

create policy documents_owner_write on storage.objects for all
  using      (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy documents_auth_read on storage.objects for select
  using (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- Seed: reference data
-- ---------------------------------------------------------------------------
insert into public.reference_data (category, value, sort_order) values
  ('employment_type', 'Full-time',    1),
  ('employment_type', 'Part-time',    2),
  ('employment_type', 'Contractual',  3),
  ('employment_type', 'Seasonal',     4),
  ('employment_type', 'Casual',       5),
  ('employment_type', 'Job Order',    6),
  ('education_level', 'Elementary',   1),
  ('education_level', 'High School',  2),
  ('education_level', 'Senior High School', 3),
  ('education_level', 'Vocational',   4),
  ('education_level', 'College',      5),
  ('education_level', 'Post-Graduate', 6)
on conflict (category, value) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: initial super-admin account
-- IMPORTANT: Change this password immediately after first login.
-- ---------------------------------------------------------------------------
do $$
declare admin_id uuid;
begin
  select id into admin_id from auth.users where email = 'admin@joblinked.ph' limit 1;
  if admin_id is null then
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@joblinked.ph',
      crypt('Admin123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"super-admin","first_name":"System","last_name":"Administrator","full_name":"System Administrator"}'::jsonb
    ) returning id into admin_id;
  end if;
  insert into public.super_admins (id, first_name, last_name, full_name, email, status)
  values (admin_id, 'System', 'Administrator', 'System Administrator', 'admin@joblinked.ph', 'active')
  on conflict (id) do update set status = 'active';
end $$;
