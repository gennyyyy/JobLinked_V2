-- =============================================================================
-- 015_document_petitions.sql — per-document petitions for accreditation (ADR-054)
-- Apply: psql -d joblinked -f db/migrations/015_document_petitions.sql
-- (db/schema.sql is updated to match.)
-- Rollback = drop index employer_document_petitions_one_pending_uidx and table.
-- =============================================================================
create table if not exists public.employer_document_petitions (
  id               uuid        primary key default gen_random_uuid(),
  company_id       uuid        not null references public.employers(id) on delete cascade,
  accreditation_id uuid        references public.employer_accreditations(id) on delete set null,
  doc_type         text        not null,
  reason           text        not null,
  status           text        not null default 'pending'
    check (status in ('pending','approved','rejected')),
  remarks          text,
  decided_by       uuid        references public.super_admins(id) on delete set null,
  created_at       timestamptz not null default now(),
  decided_at       timestamptz
);
create index if not exists employer_document_petitions_company_idx
  on public.employer_document_petitions(company_id);
create unique index if not exists employer_document_petitions_one_pending_uidx
  on public.employer_document_petitions(company_id, doc_type) where status = 'pending';