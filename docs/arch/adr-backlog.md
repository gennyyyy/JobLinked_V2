# ADR Backlog — to_do.md vs reality (2026-10-03)

Source of evidence: `docs/arch/gap-matrix.md` (full per-feature table with file:line citations).
Schema source of truth: `supabase/migration.sql`. No schema change without architect sign-off.

## ADR-000 — Job approval flow stays REMOVED [SIGNED OFF — WONTFIX by design]

`migration.sql:403-410` deliberately drops `job_approval_gate` and flushes
pending/approved rows to `published`. Spec §2 ("Submit for Approval") and §3
("Review/Approve/Reject/Publish/Unpublish") contradict the shipped schema.
Decision: spec is amended, not code. Publish is direct; admin retains
Close + Archive (`superadmin/JobPosts.jsx:113-116`). All "Job Approved /
Rejected / Awaiting Approval" notification items are consequently out of scope.

## P0 — signed off, dispatch now (no schema changes)

### ADR-001 — Dead/broken one-liners bundle
Fix, don't redesign:
1. `JobSeekerRegister.jsx:16` navigates to `/job-seeker/dashboard` — route does not
   exist (`App.jsx` nests index at `/job-seeker`). Change to `/job-seeker`.
   Verify-then-fix: grep for any other `navigate('...dashboard')` strings.
2. `constants.js` `ACCREDITATION_STATUSES` lacks `'revoked'` while DB enum
   (`migration.sql:34`) and both accreditation UIs write it. Add it.
3. `admin.js:9-10` `getStats()` runs identical queries for employers/companies —
   collapse to one query, two aliases out.
4. `Logs.jsx:149` reads `log.user` join that `listAuditLogs` never selects
   (always falls back to "System / legacy"). Either add the join in
   `admin.js:listAuditLogs` or render `actor_id` short. Cheaper of the two wins.
Contract: existing signatures unchanged. No new files except none.
Test: `npm run lint` + manual click-through of the four spots.

### ADR-002 — Reset-password completion
Spec §1/§2 require Reset Password; only the request half exists
(`auth.js:109-114`, `ForgotPassword.jsx`). Completion lands on `/` with no handler.
Contract:
- `POST` n/a — client-side. New route `/reset-password` → `src/pages/ResetPassword.jsx`:
  reads Supabase recovery session from URL hash, one password field + confirm,
  calls `supabase.auth.updateUser({ password })`, then navigates to `/portals`.
- One-line service change: `auth.js:resetPassword` `redirectTo` becomes
  `` `${window.location.origin}/reset-password` ``.
- Reuse `Login.jsx` card layout; no new components, no new deps.
Test: lint + request-link → set-password → login round-trip on local dev.

### ADR-003 — Wire the two dead application statuses
`'Under Review'` and `'Shortlisted'` are in the enum and rendered, but no UI
anywhere calls `updateApplicationStatus` with them (gap-matrix §1/§2).
Contract:
- `employer/Applicants.jsx` status buttons row: add `Under Review` and
  `Shortlist` buttons calling existing
  `updateApplicationStatus(id, status)` — zero service changes.
- Seeker `Applications.jsx` filter row: confirm `Shortlisted` bucket exists,
  add if missing (dashboard already counts it).
- No new statuses, no enum edits, no migration.
Test: lint + employer clicks each transition on one test application, seeker sees it.

## P1 — signed off, dispatch now (no API/schema changes expected)

### ADR-004 — Seeker resume View/Download
`src/features/job-seeker/Profile.jsx` resume section: add View (opens
`signedUrl('resumes', path)` blob URL in new tab — service already exists)
and Download (`<a href={blobUrl} download={file_name}>`) buttons per resume
row. No service/API changes. If the API file-GET 403s the owner, that is a
backend bug — report, don't work around.

### ADR-005 — Job detail fields
`src/features/job-seeker/JobDetail.jsx` + `src/features/public-site/PublicJobDetail.jsx`:
render `vacancies`, `deadline` (formatted date, "No deadline" when null),
`tags` chips (only when non-empty). Pure render; columns already come back
on the job payload. If a field is absent from the API response, report —
don't add an endpoint.

### ADR-007 — Employer internal notes
`src/features/employer/Applicants.jsx` status/interview modal: add Notes
textarea wired to the existing `employerNotes` param of
`updateApplicationStatus` (contract already accepts it; seeker side already
renders `employer_notes`). No service/API changes. Empty notes send nothing.

| ID | Item | Scope note |
|---|---|---|
| ADR-004 | ✅ signed off above (frontend-only) |
| ADR-005 | ✅ signed off above (frontend-only) |
| ADR-006 | Company logo upload | `logo_path` col exists; reuse `documents.js` upload pattern + private bucket. Needs bucket name decision at schedule time. |
| ADR-007 | ✅ signed off above (frontend-only) |
| ADR-010 | Admin All-Applications table | `admin.js:listAllApplications` exported, zero page imports; new tab reusing `Reports.jsx` table markup. |
| ADR-011 | Employer applicant search by skill/edu/barangay | Name-only today (`Applicants.jsx:136-143`); extend client filter over already-fetched seeker fields. |

## P2 — backlog, needs design before code

| ID | Item | Why P2 |
|---|---|---|
| ADR-009 | Reports: monthly bucketing, charts, .xlsx | Client CSV + `window.print()` cover 80%; chart lib is a new dep — needs ADR. |
| ADR-012 | Seeker "new relevant jobs" fan-out | No trigger on publish; needs fan-out design (notify-all vs matched-only) to avoid notification spam. |

## Explicitly CUT (YAGNI — do not re-propose without new evidence)

- `skills` / `barangays` tables — `text[]` + free text satisfy all current filters.
- `reports` table — reports are computed; storing them adds nothing.
- Admin role-mutation — `updateUser` throws on role change by design; `RoleManagement.jsx` stays descriptive.
- HTTPS/TLS, DB/file backup — deploy-layer concerns, nothing to build in-repo.
- Data Retention beyond `purgeOldApplications` — deferred per `plan.md` Phase 5.
- `plan.md` Phase 3 `referred_by` migration — column already exists (`migration.sql:495`); plan.md is stale on this point.
