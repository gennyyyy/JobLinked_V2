# Accreditation Document Petitions — Design Spec

**Date:** 2026-11-16
**Status:** Approved for planning

## Goal

When an employer lacks a required accreditation document, they may file a
petition explaining why. The petition is reviewed by a super-admin, whose
decision (approve/reject) is recorded alongside the document list. The
accreditation approval decision remains a separate, explicit action by the
super-admin.

## Scope

- Employer-side: file a petition per missing document (DOC_TYPES entry with no
  uploaded file) with a text reason.
- Super-admin-side: view petitions for the employer under review and
  approve/reject each with remarks.
- No change to accreditation status transitions; no auto-approval.

## Non-goals (YAGNI)

- No petition withdrawal by employer (refile after rejection instead).
- No supporting-file attachments on a petition (text reason only).
- No auto-approval of accreditation when all petitions approved.
- No separate petition queue page; petitions surface inside the existing
  accreditation review modal.

## Data model

New table `employer_document_petitions`:

```sql
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
```

`doc_type` validated server-side against the existing `DOC_TYPES` set.

## API contract

Base: `/api`. Auth: bearer token. Errors: `{ error: { code, message } }`.

### Employer

- `POST /petitions`
  - Auth: employer.
  - Body: `{ doc_type, reason, accreditation_id? }`.
  - Validates `doc_type` in DOC_TYPES; `reason` trimmed length >= 10.
  - If `accreditation_id` provided, verifies it belongs to the caller's company.
  - 409 if a pending petition already exists for (company, doc_type).
  - 201: petition row.
  - Notifies admins (type `petition`).

- `GET /petitions/company/:companyId`
  - Auth: employer (own company) or super-admin.
  - 403 otherwise.
  - Returns array of petitions ordered by created_at desc.

### Super-admin

- `PATCH /petitions/:id`
  - Auth: super-admin.
  - Body: `{ status: 'approved'|'rejected', remarks? }`.
  - 404 if not found / bad uuid.
  - Sets status, remarks, decided_by, decided_at.
  - Notifies the employer (type `petition`).
  - 200: updated petition.

No delete endpoint (YAGNI).

## Frontend

### EmployerAccreditation.jsx

- For each DOC_TYPE without an uploaded document, show a "File petition" button.
- Button opens a dialog with a textarea (reason, min 10 chars) and submit.
- On success, refresh the petition list and show status badge next to the doc type.
- List existing petitions (status badges) in the review-history panel or under each doc.

### super-admin/Accreditation.jsx (ReviewModal)

- Add a "Document petitions" section that loads `listCompanyPetitions(companyId)`.
- Each petition: doc_type, reason, status badge, decided_at.
- Pending petitions show Approve/Reject buttons (with remarks textarea reuse).
- Approve/reject calls `updatePetition(id, status, remarks)`.

## Service layer (src/shared/services/documents.js)

Add:
- `createPetition({ docType, reason, accreditationId })`
- `listCompanyPetitions(companyId)`
- `updatePetition(id, status, remarks)`

## Security / trust boundaries

- Employer can only create petitions for their own company; server uses req.user.id as company_id.
- Super-admin check via requireRole('super-admin') on PATCH.
- doc_type allow-list enforced server-side (reuse DOC_TYPES).
- reason length enforced server-side.
- Duplicate pending prevented by partial unique index + 409.

## Migration

New migration `db/migrations/015_document_petitions.sql` creating the table/indexes.
Also update `db/schema.sql` to include the table (portable schema).

## Testing

- Server: profiles.petition.test.js (or profiles.accreditation-petition.test.js) covering create, validation, duplicate 409, ownership, admin approve/reject, notify.
- Frontend: update EmployerAccreditation and Accreditation tests for petition flows.

## ADR

docs/arch/adr-054-accreditation-document-petitions.md (this spec's decision record).
