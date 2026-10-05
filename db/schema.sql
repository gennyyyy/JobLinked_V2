-- =============================================================================
-- JobLinked · Local Postgres schema (ADR-020)
-- Derived from supabase/migration.sql. Portable Postgres — no Supabase-only
-- constructs (no auth-schema refs, no RLS, no storage policies, no
-- handle_new_user / notify_admins). NEVER edit supabase/migration.sql;
-- that file stays the Supabase-target schema for the later move back.
-- Apply: psql -d joblinked -f db/schema.sql  (then db/seed.sql)
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums (complete value lists — includes Placed/Terminated/revoked up front)
-- ---------------------------------------------------------------------------
do $$ begin create type user_role as enum ('super-admin','employer','job-seeker'); exception when duplicate_object then null; end $$;
do $$ begin create type account_status as enum ('active','inactive','suspended'); exception when duplicate_object then null; end $$;
do $$ begin create type job_status as enum ('draft','pending','approved','rejected','published','closed','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type application_status as enum ('Applied','Under Review','Shortlisted','Interview','Accepted','Rejected','Placed','Terminated'); exception when duplicate_object then null; end $$;
do $$ begin create type accreditation_status as enum ('none','pending','approved','rejected','resubmission','revoked'); exception when duplicate_object then null; end $$;
do $$ begin create type document_status as enum ('pending','verified','rejected','missing'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Role tables (id is a plain uuid PK — filled from the Supabase auth user id
-- by POST /api/auth/provision; no references to auth.users locally)
-- ---------------------------------------------------------------------------
create table if not exists public.job_seekers (
  id                   uuid        primary key,
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
  id                     uuid        primary key,
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
  -- Denormalised accreditation state, kept in sync by the
  -- trg_sync_accreditation_status trigger below.
  accreditation_status   text        default null,
  accreditation_remarks  text        default null,
  status                 account_status not null default 'active',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.super_admins (
  id         uuid        primary key,
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
-- Reference data (rows live in db/seed.sql)
-- ---------------------------------------------------------------------------
create table if not exists public.reference_data (
  id         bigint generated always as identity primary key,
  category   text not null,
  value      text not null,
  sort_order int  not null default 0,
  unique (category, value)
);

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

create table if not exists public.job_status_history (
  id         bigint generated always as identity primary key,
  job_id     uuid         not null references public.job_vacancies(id) on delete cascade,
  status     job_status   not null,
  remarks    text,
  changed_by uuid,
  changed_at timestamptz  not null default now()
);

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
  referred_by            uuid               references public.job_seekers(id) on delete set null,
  unique (job_id, seeker_id)
);

create table if not exists public.application_status_history (
  id             bigint generated always as identity primary key,
  application_id uuid               not null references public.job_applications(id) on delete cascade,
  status         application_status not null,
  remarks        text,
  changed_by     uuid,
  changed_at     timestamptz        not null default now()
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
create unique index if not exists employment_history_application_uidx on public.employment_history(application_id) where application_id is not null;

-- Auto-maintain employment_history from application status transitions.
-- (Ported verbatim from migration.sql — verified: no auth-schema references.)
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

-- ---------------------------------------------------------------------------
-- Notifications (API inserts directly — no notify_admins RPC locally)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null,
  type       text        not null,
  title      text        not null,
  message    text        not null,
  link       text,
  is_read    boolean     not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id);

-- ---------------------------------------------------------------------------
-- Audit log (API writes with the token user id, best-effort)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  action     text        not null,
  entity     text,
  entity_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_user_idx on public.audit_logs(user_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- ---------------------------------------------------------------------------
-- Trigger: keep employers.accreditation_status in sync automatically.
-- (Ported verbatim from migration.sql — verified: no auth-schema references.)
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
