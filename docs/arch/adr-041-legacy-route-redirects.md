# ADR-041 — Legacy routes redirect, they do not 404 [ACCEPTED 2026-11-03]

## Context
The new app renames route families: `super-admin → admin`, `job-seeker → jobseeker`,
`register/* → signup/*`. Old URLs are in bookmarks, emails already sent, browser autocomplete, and
search results. A 404 on those URLs reads as "the service is gone", not "the page moved".

## Decision
Implement redirects in `next.config.mjs` `async redirects()`:

| Source | Destination | `permanent` |
|---|---|---|
| `/portals` | `/` | yes (308) |
| `/register`, `/register/job-seeker`, `/register/employer`, `/register/employer/status` | `/signup`, `/signup/jobseeker`, `/signup/employer`, `/employer/accreditation` | yes |
| `/super-admin/login`, `/employer/login`, `/job-seeker/login` | `/login` | no (307, keeps any `?next=`) |
| `/super-admin` | `/admin/dashboard` | yes |
| `/super-admin/:path*` | `/admin/:path*` | yes |
| `/super-admin/job-posts` | `/admin/jobs` | yes (`permanent`) |
| `/job-seeker` | `/jobseeker/dashboard` | yes |
| `/job-seeker/jobs` | `/jobseeker/recommended` | yes |
| `/job-seeker/jobs/:id` | `/jobs/:id` | yes |
| `/job-seeker/:path*` | `/jobseeker/:path*` | yes |
| `/employer/status` | `/employer/accreditation` | yes |

Portal logins use 307 so a `?next=…` intent survives to the new login screen. Everything else is a
permanent redirect because the target mapping does not change back.

## Consequences
- Old links keep working; the Playwright suite pins each redirect (Task 9 skeleton, completed in Task 24).
- `/super-admin/job-posts` needs its explicit rule: the generic `/super-admin/:path*` would map it to
  `/admin/job-posts`, which does not exist (the section slug is `jobs`).
- Redirects run before rendering, so no client guard work is needed for legacy URLs.

## Alternatives
- **Pages that `redirect()` in the component** — renders first, costs a client round trip, and needs a
  page file per legacy slug. Rejected.
- **404 with a "we moved" message** — breaks bookmarks and search results. Rejected.
