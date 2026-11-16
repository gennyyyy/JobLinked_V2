# ADR-054 — Accreditation document petitions

**Status:** Accepted (plan pending)
**Date:** 2026-11-16

## Context

Employers may lack a required accreditation document. Previously the only
options were to upload one or have the super-admin request resubmission. There
was no way for an employer to explain why a document is unavailable, nor a
structured record of that justification for the super-admin's decision.

## Decision

Add a per-document petition mechanism:

- New table `employer_document_petitions` (company, doc_type, reason, status).
- Employer files a petition (reason ≥ 10 chars) for a missing document.
- Super-admin approves/rejects each petition with remarks.
- Accreditation approval remains a separate explicit decision.

## Alternatives considered

- Overloading `employer_documents` with nullable file_path + petition statuses:
  rejected — conflates files with waiver requests and complicates the
  not-null file_path constraint and document status enum.
- Single justification text on `employer_accreditations`: rejected — loses
  per-document granularity the review UI and decision need.
- Auto-approving accreditation when all petitions approved: rejected — keeps
  the accreditation decision explicit and human.

## Consequences

- One new table + migration; portable schema updated.
- Employer and super-admin UI gain petition sections.
- No change to existing accreditation status flow or job-posting gate.
