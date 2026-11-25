# Center every list pager

**Status:** approved by user 2026-11-26 ("in the audit log page selector should be center… just
make all page selector centered").

## Problem

`Pager` (`src/shared/components/dashboard.jsx`) defaults `align = 'between'`: the "1–8 of 26
records" text and the prev/next controls sit at opposite ends. The audit log page uses the
default, so its selector is split. The same is true on nine other list pages.

## Scope

One line: change the `Pager` default to `align = 'center'`. No call-site edits — the `align`
prop and its `between` branch stay for any explicit caller. Two call sites already pass
`align="center"` (JobsBrowser, super-admin User Management) and are unaffected.

Pages that change by inheriting the new default:

| Route | Page | Component |
|---|---|---|
| `/super-admin/logs` | Audit Logs | `features/super-admin/Logs.jsx` |
| `/super-admin/applications` | Applications | `features/super-admin/Applications.jsx` |
| `/super-admin/job-posts` | Job Posts | `features/super-admin/JobPosts.jsx` |
| `/super-admin/employment-tracking` | Employment Tracking | `features/super-admin/Employment.jsx` |
| `/super-admin/accreditation` | Accreditation | `features/super-admin/Accreditation.jsx` |
| `/employer/applicants` | Applicants | `features/employer/Applicants.jsx` |
| `/employer/employees` | Employees | `features/employer/Employees.jsx` |
| `/employer/job-posts` | Job Posts | `features/employer/JobPosts.jsx` |
| `/job-seeker/applications` | My Applications | `features/job-seeker/Applications.jsx` |
| `/job-seeker/employment` | Employment | `features/job-seeker/Employment.jsx` |

Already centered (no change): `/jobs` (JobsBrowser), super-admin User Management.

## Done when

- `Pager`'s default is `align = 'center'`; every page above renders the record count and the
  prev/next controls as one centered group.
- `npm run lint` passes and the list-page tests stay green (`npx vitest run src/features/super-admin src/features/employer src/features/job-seeker`).
