-- JobLinked · Supabase schema
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Creates all tables, enums, RLS policies, storage buckets, and seed data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin create type user_role as enum ('super-admin','employer','job-seeker'); exception when duplicate_object then null; end $$;
do $$ begin create type account_status as enum ('active','inactive','suspended'); exception when duplicate_object then null; end $$;
do $$ begin create type job_status as enum ('draft','pending','approved','rejected','published','closed','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type application_status as enum ('Applied','Under Review','Shortlisted','Interview','Accepted','Rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type accreditation_status as enum ('none','pending','approved','rejected','resubmission'); exception when duplicate_object then null; end $$;
do $$ begin create type document_status as enum ('pending','verified','rejected','missing'); exception when duplicate_object then null; end $$;
do $$ begin create type fb_post_status as enum ('pending','posting','posted','failed','retry'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null default 'job-seeker',
  first_name text not null default '',
  middle_name text not null default '',
  last_name text not null default '',
  suffix text not null default '',
  full_name text not null default '',
  email text not null default '',
  phone text,
  barangay text,
  status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists middle_name text not null default '';
alter table public.profiles add column if not exists suffix text not null default '';

-- ---------------------------------------------------------------------------
-- Helper: admin check (security definer so it never recurses through RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'super-admin') $$;

alter table public.profiles enable row level security;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert with check (true);
-- users may update their own row but cannot change their own role (anti-escalation)
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (
    (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()))
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Reference data (admin-managed: barangays, job categories, employment types,
-- education levels, skills)
-- ---------------------------------------------------------------------------
create table if not exists public.reference_data (
  id bigint generated always as identity primary key,
  category text not null,
  value text not null,
  sort_order int not null default 0,
  unique (category, value)
);

alter table public.reference_data enable row level security;
drop policy if exists "reference_select" on public.reference_data;
drop policy if exists "reference_write" on public.reference_data;
create policy reference_select on public.reference_data for select using (true);
create policy reference_write on public.reference_data for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Barangays
-- ---------------------------------------------------------------------------
create table if not exists public.barangays (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.barangays enable row level security;
drop policy if exists "barangays_select" on public.barangays;
drop policy if exists "barangays_write" on public.barangays;
create policy barangays_select on public.barangays for select using (true);
create policy barangays_write on public.barangays for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  industry text,
  address text,
  barangay text,
  phone text,
  website text,
  description text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;
drop policy if exists "companies_select" on public.companies;
drop policy if exists "companies_insert" on public.companies;
drop policy if exists "companies_update" on public.companies;
drop policy if exists "companies_delete" on public.companies;
create policy companies_select on public.companies for select using (true);
create policy companies_insert on public.companies for insert with check (owner_id = auth.uid() or public.is_admin());
create policy companies_update on public.companies for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy companies_delete on public.companies for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Accreditation
-- ---------------------------------------------------------------------------
create table if not exists public.employer_accreditations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  status accreditation_status not null default 'pending',
  remarks text,
  decided_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.employer_accreditations enable row level security;
drop policy if exists "accred_select" on public.employer_accreditations;
drop policy if exists "accred_insert" on public.employer_accreditations;
drop policy if exists "accred_update" on public.employer_accreditations;
create policy accred_select on public.employer_accreditations for select
  using (public.is_admin() or exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid()));
create policy accred_insert on public.employer_accreditations for insert
  with check (public.is_admin() or exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid()));
create policy accred_update on public.employer_accreditations for update
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.employer_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  accreditation_id uuid references public.employer_accreditations(id) on delete set null,
  doc_type text not null,
  file_path text not null,
  file_name text not null,
  status document_status not null default 'pending',
  remarks text,
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz
);

alter table public.employer_documents enable row level security;
drop policy if exists "docs_select" on public.employer_documents;
drop policy if exists "docs_insert" on public.employer_documents;
drop policy if exists "docs_update" on public.employer_documents;
drop policy if exists "docs_delete" on public.employer_documents;
create policy docs_select on public.employer_documents for select
  using (public.is_admin() or exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid()));
create policy docs_insert on public.employer_documents for insert
  with check (public.is_admin() or exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid()));
create policy docs_update on public.employer_documents for update
  using (public.is_admin() or exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid()));
create policy docs_delete on public.employer_documents for delete
  using (public.is_admin() or exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid()));

create or replace function public.is_accredited_employer(target_company_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1
    from public.companies c
    join public.employer_accreditations a on a.company_id = c.id
    where c.id = target_company_id
      and c.owner_id = auth.uid()
      and a.status = 'approved'
  )
$$;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create table if not exists public.job_vacancies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  office text,
  location text,
  employment_type text,
  salary_min numeric,
  salary_max numeric,
  description text,
  requirements text,
  benefits text,
  vacancies int not null default 1,
  deadline date,
  instructions text,
  status job_status not null default 'draft',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz
);

alter table public.job_vacancies enable row level security;
drop policy if exists "jobs_select" on public.job_vacancies;
drop policy if exists "jobs_insert" on public.job_vacancies;
drop policy if exists "jobs_update" on public.job_vacancies;
drop policy if exists "jobs_delete" on public.job_vacancies;
create policy jobs_select on public.job_vacancies for select
  using (
    status in ('published')
    or public.is_admin()
    or exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid())
  );
create policy jobs_insert on public.job_vacancies for insert
  with check (public.is_admin() or public.is_accredited_employer(company_id));
create policy jobs_update on public.job_vacancies for update
  using (public.is_admin() or public.is_accredited_employer(company_id))
  with check (public.is_admin() or public.is_accredited_employer(company_id));
create policy jobs_delete on public.job_vacancies for delete using (public.is_admin());

create table if not exists public.job_status_history (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.job_vacancies(id) on delete cascade,
  status job_status not null,
  remarks text,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

alter table public.job_status_history enable row level security;
drop policy if exists "jobhist_select" on public.job_status_history;
drop policy if exists "jobhist_insert" on public.job_status_history;
create policy jobhist_select on public.job_status_history for select
  using (public.is_admin() or exists (
    select 1 from public.job_vacancies j join public.companies c on c.id = j.company_id
    where j.id = job_id and c.owner_id = auth.uid()
  ));
create policy jobhist_insert on public.job_status_history for insert
  with check (public.is_admin() or exists (
    select 1 from public.job_vacancies j join public.companies c on c.id = j.company_id
    where j.id = job_id and c.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Resumes + applications
-- ---------------------------------------------------------------------------
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_vacancies(id) on delete cascade,
  seeker_id uuid not null references public.profiles(id) on delete cascade,
  resume_id uuid,
  status application_status not null default 'Applied',
  employer_notes text,
  interview_at timestamptz,
  interview_instructions text,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, seeker_id)
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  is_active boolean not null default true,
  uploaded_at timestamptz not null default now()
);

alter table public.job_applications
  add column if not exists resume_id uuid references public.resumes(id) on delete set null;

alter table public.job_applications enable row level security;
drop policy if exists "apps_select" on public.job_applications;
drop policy if exists "apps_insert" on public.job_applications;
drop policy if exists "apps_update" on public.job_applications;
drop policy if exists "apps_delete" on public.job_applications;
create policy apps_select on public.job_applications for select
  using (
    seeker_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.job_vacancies j join public.companies c on c.id = j.company_id
      where j.id = job_id and c.owner_id = auth.uid()
    )
  );
create policy apps_insert on public.job_applications for insert
  with check (
    seeker_id = auth.uid()
    and exists (select 1 from public.job_vacancies j where j.id = job_id and j.status = 'published')
  );
create policy apps_update on public.job_applications for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.job_vacancies j join public.companies c on c.id = j.company_id
      where j.id = job_id and c.owner_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.job_vacancies j join public.companies c on c.id = j.company_id
      where j.id = job_id and c.owner_id = auth.uid()
    )
  );
create policy apps_delete on public.job_applications for delete using (public.is_admin());

create table if not exists public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  status application_status not null,
  remarks text,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

alter table public.application_status_history enable row level security;
drop policy if exists "apphist_select" on public.application_status_history;
drop policy if exists "apphist_insert" on public.application_status_history;
create policy apphist_select on public.application_status_history for select
  using (
    exists (select 1 from public.job_applications a where a.id = application_id and a.seeker_id = auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.job_applications a
      join public.job_vacancies j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where a.id = application_id and c.owner_id = auth.uid()
    )
  );
create policy apphist_insert on public.application_status_history for insert
  with check (
    exists (select 1 from public.job_applications a where a.id = application_id and a.seeker_id = auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.job_applications a
      join public.job_vacancies j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where a.id = application_id and c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Seeker profile detail (skills / education / work experience)
-- ---------------------------------------------------------------------------
create table if not exists public.skills (
  id bigint generated always as identity primary key,
  seeker_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  level text default 'beginner'
);

create table if not exists public.education (
  id bigint generated always as identity primary key,
  seeker_id uuid not null references public.profiles(id) on delete cascade,
  level text not null,
  school text not null,
  field text,
  start_year int,
  end_year int
);

create table if not exists public.work_experience (
  id bigint generated always as identity primary key,
  seeker_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  position text not null,
  start_date date,
  end_date date,
  description text
);

-- employer-applicant access helper reused by the three tables above
-- (applicants who applied to any of the employer's jobs)
do $$
declare t text;
begin
  foreach t in array array['public.skills','public.education','public.work_experience'] loop
    execute format('alter table %s enable row level security', t);
    execute format('drop policy if exists detail_select on %s', t);
    execute format(
      'create policy detail_select on %s for select using (
         seeker_id = auth.uid()
         or public.is_admin()
         or exists (
           select 1 from public.job_applications a
           join public.job_vacancies j on j.id = a.job_id
           join public.companies c on c.id = j.company_id
           where a.seeker_id = seeker_id and c.owner_id = auth.uid()
         )
       )', t);
    execute format('drop policy if exists detail_write on %s', t);
    execute format(
      'create policy detail_write on %s for all using (seeker_id = auth.uid() or public.is_admin()) with check (seeker_id = auth.uid() or public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Notifications (one DB-backed service for all portals)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
drop policy if exists "notif_select" on public.notifications;
drop policy if exists "notif_insert" on public.notifications;
drop policy if exists "notif_update" on public.notifications;
drop policy if exists "notif_delete" on public.notifications;
create policy notif_select on public.notifications for select using (user_id = auth.uid());
-- ponytail: any authenticated user can insert (no server to gate "system" sends);
-- fine for municipal scale; move to service-role edge function if spam becomes a problem
create policy notif_insert on public.notifications for insert with check (true);
create policy notif_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;
drop policy if exists "audit_select" on public.audit_logs;
drop policy if exists "audit_insert" on public.audit_logs;
create policy audit_select on public.audit_logs for select using (public.is_admin());
create policy audit_insert on public.audit_logs for insert with check (true);

-- ---------------------------------------------------------------------------
-- Facebook integration (PESO page connection + auto-post tracking)
-- ---------------------------------------------------------------------------
create table if not exists public.facebook_integrations (
  id uuid primary key default gen_random_uuid(),
  page_id text not null,
  page_name text not null,
  access_token text not null,
  status text not null default 'connected',
  auto_post boolean not null default true,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz
);

create table if not exists public.facebook_posts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_vacancies(id) on delete cascade,
  integration_id uuid references public.facebook_integrations(id) on delete set null,
  post_id text,
  post_url text,
  status fb_post_status not null default 'pending',
  error text,
  retry_count int not null default 0,
  created_at timestamptz not null default now(),
  posted_at timestamptz
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
-- Auto-create profile row on user signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, first_name, middle_name, last_name, suffix, full_name, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'job-seeker'),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'middle_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'suffix', ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Seed: barangays (Santa Maria, Bulacan), reference data, admin account
-- ---------------------------------------------------------------------------
insert into public.barangays (name) values
  ('Poblacion'),('Bagbaguin'),('Balasing'),('Buenavista'),('Bulac'),('Camangyanan'),
  ('Catmon'),('Caypombo'),('Caysio'),('Guyong'),('Lalakhan'),('Mag-asawang Sapa'),
  ('Mahabang Parang'),('Manggahan'),('Parada'),('Pulo'),('San Gabriel'),
  ('San Jose Patag'),('San Vicente'),('Santa Clara'),('Santa Cruz'),('Silangan'),
  ('Tabing Bakod'),('Tumana')
on conflict (name) do nothing;

insert into public.reference_data (category, value, sort_order) values
  ('employment_type','Full-time',1),('employment_type','Part-time',2),
  ('employment_type','Contractual',3),('employment_type','Seasonal',4),
  ('employment_type','Casual',5),('employment_type','Job Order',6),
  ('education_level','Elementary',1),('education_level','High School',2),
  ('education_level','Senior High School',3),('education_level','Vocational',4),
  ('education_level','College',5),('education_level','Post-Graduate',6)
on conflict (category, value) do nothing;

-- Initial super-admin. CHANGE THIS PASSWORD IMMEDIATELY after first login.
do $$
declare
  admin_id uuid;
begin
  select id into admin_id
  from auth.users
  where email = 'admin@joblinked.ph'
  limit 1;

  if admin_id is null then
    insert into auth.users
      (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values
      (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'admin@joblinked.ph', crypt('Admin123!', gen_salt('bf')), now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"super-admin"}'::jsonb)
    returning id into admin_id;
  end if;

  insert into public.profiles (id, role, first_name, last_name, full_name, email, status)
  values (admin_id, 'super-admin', 'System', 'Administrator', 'System Administrator', 'admin@joblinked.ph', 'active')
  on conflict (id) do update set role = 'super-admin', status = 'active';
end $$;

-- ---------------------------------------------------------------------------
-- Storage buckets (private; paths are unguessable uuids, DB RLS gates who
-- receives signed URLs)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

drop policy if exists "resumes_owner_write" on storage.objects;
drop policy if exists "resumes_auth_read" on storage.objects;
drop policy if exists "documents_owner_write" on storage.objects;
drop policy if exists "documents_auth_read" on storage.objects;
-- folder name (first path segment) must equal the uploader's user id
create policy resumes_owner_write on storage.objects for all
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy resumes_auth_read on storage.objects for select
  using (bucket_id = 'resumes' and auth.role() = 'authenticated');
create policy documents_owner_write on storage.objects for all
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy documents_auth_read on storage.objects for select
  using (bucket_id = 'documents' and auth.role() = 'authenticated');
