-- =============================================================================
-- Security Fixes Migration
-- Run this after the main migration to apply security hardening.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Prevent privilege escalation via registration
-- Re-create the trigger to reject 'super-admin' from user metadata.
-- Only 'job-seeker' and 'employer' can self-register.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare r user_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'job-seeker');
begin
  -- Reject super-admin self-registration
  if r = 'super-admin' then
    raise exception 'Super admin accounts cannot be self-registered';
  end if;

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
    insert into public.employer_accreditations (company_id)
    values (new.id) on conflict do nothing;

  else
    -- Unknown role — default to job-seeker for safety
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
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Revoke notify_admins from authenticated users
-- Only service role should be able to call this function.
-- ---------------------------------------------------------------------------
revoke execute on function public.notify_admins(text, text, text, text) from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Additional hardening: ensure audit_logs can't be tampered with
-- Only allow insert, no update or delete
-- ---------------------------------------------------------------------------
drop policy if exists audit_update on public.audit_logs;
drop policy if exists audit_delete on public.audit_logs;
