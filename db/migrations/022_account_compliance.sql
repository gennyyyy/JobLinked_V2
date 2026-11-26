-- 022: Registration consent record (RA 10173, ADR-059).
-- terms_version stores legal_documents.updated_at (ISO-8601) of the accepted
-- Terms at the moment of acceptance. Pre-migration rows stay null: no evidence
-- exists to backfill.
alter table public.job_seekers
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version    text;

alter table public.employers
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version    text;

comment on column public.job_seekers.terms_accepted_at is
  'When the registrant accepted the Terms (ADR-059).';
comment on column public.job_seekers.terms_version is
  'legal_documents.updated_at (ISO-8601) of the accepted Terms.';
comment on column public.employers.terms_accepted_at is
  'When the registrant accepted the Terms (ADR-059).';
comment on column public.employers.terms_version is
  'legal_documents.updated_at (ISO-8601) of the accepted Terms.';
