# ADR-060 — Account erasure anonymizes; placement records survive

- Status: Accepted (revised after T6 review)
- Date: 2026-11-26
- Deciders: arch (sign-off), repo owner
- Related: ADR-053 (editable legal documents), ADR-056 (Better Auth), ADR-040 (profile images)

## Context

RA 10173 (Data Privacy Act of 2012) Sec. 16(c) gives a data subject the right to
erasure. The app currently offers only `POST /api/account/deactivate`, which sets
`status = 'inactive'` and revokes sessions; it removes no personal data.

A hard delete is not available as designed: `job_applications.seeker_id`,
`job_vacancies.company_id`, `education.seeker_id`, and `work_experience.seeker_id`
are all `on delete cascade`. Deleting a seeker row would delete their application
and placement history — records PESO must retain for RA 8759/10691 reporting.
Deleting an employer row would delete every application made to its vacancies.

RA 10173 erasure is also not absolute: Sec. 16(c) yields to lawful processing
obligations. The correct end state is therefore: personal data gone, non-identifying
service and placement records retained.

## Decision

Erasure means **anonymise every role row for the id + destroy credentials + delete
files**, never delete the role row. `DELETE /api/account` requires body
`{"confirm":"ERASE"}` and runs one database transaction after best-effort file
removal.

### Every erasure, regardless of role

- Scrub **every role table row that exists for the user id**, not only the role
  `resolveRole()` returns. A role move (admin promote/move) leaves the old row
  `inactive`; it is still the user's data. Run both role-specific cleanup paths
  when both rows exist. The audit `entity` is `account` when more than one row
  was scrubbed, otherwise the role table.
- Delete `auth."user"` (cascades `auth."session"`, `auth."account"`,
  `auth."twoFactor"`). Delete `auth."verification"` rows whose `identifier` is the
  old email, so an outstanding reset/verify token cannot outlive the account.
- Revoke the legacy Supabase session with the same best-effort GoTrue admin
  logout the deactivate route uses, then clear the process token cache
  (`clearTokenCache()`). Without this, a dual-window bearer keeps working and a
  repeat erasure returns 200 instead of 401.
- Delete `public.pending_signups`, the user's own `public.notifications`, and
  `public.user_preferences`, `public.profile_images`.
- Insert the `account.erase` audit row with the transaction client, not the
  best-effort pool helper. The audit marker must commit with the scrub or not at
  all.
- Role row `status` becomes `inactive`.

### Job seeker

Zero out `job_seekers`: `first_name`, `middle_name`, `last_name`, `suffix`,
`full_name` → `''`; `email` → the unique sentinel
`erased+<user-id>@invalid.local`; `phone`, `birthdate`, all address columns →
`null` (`country` stays `'Philippines'`); `headline`, `education_summary`,
`experience_summary`, `employment_status`, `preferred_position`, `field`,
`preferred_location` → `null`; `skills` → `'{}'`.

Delete `education`, `work_experience`, `resumes` rows (capture `file_path` first
and unlink each file).

Retain `job_applications` and `application_status_history` so placement counts and
RA 8759 reporting survive, but remove the free text: `employer_notes = null`,
`interview_instructions = null`, `interview_at = null`, `resume_id = null`;
`application_status_history.remarks = null`. `employment_history` rows stay (they
hold employer/position/dates, not seeker PII).

### Employer

Zero out `employers`: person-name columns, `phone`, `company_name`,
`company_email`, address columns, `representative_email`,
`representative_position`, `representative_phone`, `website`, `description`,
`industry` → `''`/`null`; `email` → the same unique sentinel;
`logo_path` → `null`; `accreditation_status` and `accreditation_remarks` → `null`.

Archive every job vacancy for the employer **and clear its text**, because the
posting body can re-identify the company: `title = 'Archived vacancy'`,
`description`, `requirements`, `benefits`, `instructions`, `remarks`, `office`,
`location`, `field` → `null`; `tags`/`skills` → `'{}'`; `status = 'archived'`,
`archived_at = now()`. Null `job_status_history.remarks` for those jobs and delete
their `job_prohibited_flags` (the matched terms are extracted from the posting
text).

Delete `employer_documents` and `employer_document_petitions` rows, unlinking their
files. Keep `employer_accreditations` rows as verification history with `remarks`
nulled.

Rewrite `employment_history.employer_name = 'Employer (erased)'` for placements
reached through this employer's vacancies (join via
`job_applications → job_vacancies.company_id`).

### Notification copy (root cause)

Erasure cannot scrub a third party's notification text reliably, so the writers
must not embed another person's identity in the first place:

- Applicant notification: `A new applicant applied for <job title>.` — no name.
- Admin job notifications: job title only — no company name.
- Accreditation notifications: status only — no company name, no PESO remarks
  (the employer reads the remarks on the accreditation page).

This also keeps the employer export free of applicant PII.

### Why the email is a sentinel, not `''`

`job_seekers_email_uidx` and `employers_email_uidx` are plain unique indexes
(`schema.sql`; migration 002). Two erased rows holding `''` would collide with
PG `23505` on the second erasure. A per-user sentinel keeps the index useful for
live accounts with no migration and no index rebuild. It carries no personal data
and is never used for login: the auth user is deleted.

## Consequences

- Erasure is reversible only by re-registration — accepted.
- Multiple erasures are safe; each sentinel is unique by UUID.
- The same email can register again after the auth user (and verification rows)
  are gone.
- Admin screens that render `inactive` accounts show blank names; acceptable.
- Archived vacancies keep no text, so seekers' retained application rows show
  `Archived vacancy` with a blank company.
- Erased `employment_history` rows read `Employer (erased)`.
- File unlink failures leave an orphan file; logged, cleaned by ops.

## Alternatives rejected

1. **Hard delete with cascade** — destroys PESO placement reporting and other
   users' application history.
2. **Soft delete only** — does not satisfy the erasure right; the current
   deactivate route already does this.
3. **Crypto-shredding (per-user key, discard key)** — real technique, but adds key
   management and migration of every encrypted column for no benefit over
   anonymisation at this scale.
