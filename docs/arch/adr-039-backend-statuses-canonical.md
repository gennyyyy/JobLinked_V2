# ADR-039 — Backend statuses are canonical, UI statuses are presentation [ACCEPTED 2026-11-03]

## Context
The moved UI invents its own status vocabulary (`Shortlisted`, `Pending`, `Verified`, …) that does
not match the database enums (`job_vacancies.status`, `job_applications.status`,
accreditation status). Migration `004` already removed `Shortlisted` on the backend. Letting each
component translate strings guarantees drift: a status the UI does not know renders as `undefined`.

## Decision
- **Backend enums are the source of truth.** Every translation lives in exactly one file,
  `services/mappers.ts`:

  | Domain | API value → UI label |
  |---|---|
  | Job | `draft→Draft`, `pending→Pending Approval`, `approved→Approved`, `rejected→Rejected`, `published→Published`, `closed→Closed`, `archived→Archived` |
  | Application | `Applied→Submitted`, `Under Review→Under Review`, `Interview→Interview Scheduled`, `Accepted→Hired`, `Placed→Placed`, `Rejected→Rejected`, `Terminated→Terminated` |
  | Accreditation | `none→Not Submitted`, `pending→Pending Review`, `approved→Approved`, `rejected→Rejected`, `resubmission→Resubmission Requested`, `revoked→Revoked` |
  | Roles | `super-admin→admin`, `job-seeker→jobseeker`, `employer→employer`; UI `staff` = `admin` + `custom_role != null` |

- Unknown values fall back to the raw value with a neutral label/badge — never `undefined`, never a crash.
- UI actions call **action endpoints** (`/jobs/:id/status`, `/jobs/:id/duplicate`,
  `/applications/:id/status`), never a blind `PATCH status`.
- `Shortlisted` is removed everywhere; the UI union gains `Placed` and `Terminated`.

## Consequences
- One exhaustive mapper test per enum value plus an unknown-value case guards every screen.
- Changing a backend enum is a deliberate two-file change (mapper + its test), not a silent UI bug.
- Components carry no status strings and no badge logic for status semantics.

## Alternatives
- **Translate per component** — the current state; drift is guaranteed. Rejected.
- **Make the backend speak UI labels** — rewrites the schema, migrations, and every existing test
  for a presentation concern. Rejected.
