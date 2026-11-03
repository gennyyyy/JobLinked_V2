begin;

create table if not exists public.saved_jobs (
  id         bigint generated always as identity primary key,
  seeker_id  uuid not null references public.job_seekers(id) on delete cascade,
  job_id     uuid not null references public.job_vacancies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (seeker_id, job_id)
);
create index if not exists saved_jobs_seeker_idx on public.saved_jobs(seeker_id);

create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  category     text not null default 'General',
  status       text not null default 'draft' check (status in ('draft','published')),
  author_id    uuid,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists announcements_status_idx on public.announcements(status, published_at desc);

create table if not exists public.employment_corrections (
  id            uuid primary key default gen_random_uuid(),
  employment_id uuid not null references public.employment_history(id) on delete cascade,
  seeker_id     uuid not null references public.job_seekers(id) on delete cascade,
  message       text not null,
  status        text not null default 'Pending' check (status in ('Pending','Reviewed')),
  resolution    text,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists employment_corrections_seeker_idx on public.employment_corrections(seeker_id);
create index if not exists employment_corrections_status_idx on public.employment_corrections(status);

alter table public.job_applications add column if not exists cover_letter text;

commit;
