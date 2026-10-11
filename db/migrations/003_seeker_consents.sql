-- Seeker consents: optional PESO employer-referral opt-in.
alter table public.job_seekers
  add column if not exists referral_opt_in boolean not null default false;
