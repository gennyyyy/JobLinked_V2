-- ADR-057: the company/business phone stays in employers.phone; the authorized
-- representative's mobile gets its own column so the profile can edit them
-- independently. Additive only — existing phone values are not moved because a
-- company may already have replaced the old representative value with a real
-- business number.
alter table public.employers add column if not exists representative_phone text;
