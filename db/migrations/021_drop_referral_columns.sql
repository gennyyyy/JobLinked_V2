-- Retire the referral feature: nothing in the app ever wrote these.
drop index if exists public.job_applications_referred_idx;
alter table public.job_applications drop column if exists referred_by;
alter table public.job_seekers drop column if exists referral_opt_in;
