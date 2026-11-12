# ADR-049: One resume per job-seeker account

Date: 2026-11-13
Status: Accepted

## Context

Accounts can hold up to 20 resumes with an "active" selector. Multiple upload surfaces (profile, job detail), an activate endpoint, and a promote-newest-on-delete flow all grew around the multi-resume model, and the one-active partial index has already raced once (bug B4). Product decision: one resume per account, replaced on upload.

## Decision

- `resumes(seeker_id)` becomes unique (full index, not the partial `where is_active` one).
- Replace is in-place: the row keeps its id; only `file_path`, `file_name`, `uploaded_at` change. `job_applications.resume_id` references that id, so past applications resolve to the new file with no repoint query and no transient two-row state.
- Migration 014 collapses multi-resume accounts: keeper = newest `uploaded_at` (tie-break `id desc`); non-keeper applications repoint to the keeper, then rows are deleted.
- Upload is offered only on the profile page. Registration's resume picker is local autofill only (never uploads) and stays unchanged.
- `is_active` stays for backward compat, always `true`. The activate endpoint is removed.
- Applying without a resume stays allowed (`resume_id` nullable).

## Consequences

- Replace and delete require UI copy updates: the profile currently promises applications "keep the resume that was attached at the time", which is false once applications resolve to the replaced file and delete nulls `resume_id` (existing `on delete set null`).
- Old files are unlinked in Node on replace/delete; the migration emits doomed `file_path` values for a scripted cleanup (SQL cannot unlink).
- Implementation plan: docs/plan/2026-11-13-resume-single-per-account.md
