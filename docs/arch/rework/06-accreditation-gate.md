# ADR-022 — Accreditation gate removed, posting restriction kept [SIGNED OFF]

Employers enter the full portal regardless of `accreditation_status` — the
layout redirect to `/register/employer/status` and the JobPosts full-page
"LOCKED" wall are deleted. The only enforcement left is the create guard in
`handleOpenCreate` ("must be accredited before you can post jobs"); pending
employers see an empty job list. `EmployerStatus.jsx` + route stay for the
fresh-registration flow. Server-side `company_id`-ownership and status rules
are unchanged.

---

## Addendum — 2026-10-15: the posting restriction is now also enforced server-side

ADR-022 kept the *product rule* ("must be accredited before you can post jobs")
but recorded the *mechanism* as the `handleOpenCreate` client guard alone, with
server-side rules unchanged. That mechanism is not enforcement at the trust
boundary: an employer could `POST /api/jobs` directly, never be accredited, and
harvest citizen applications/resumes (readable by any employer holding a
`job_applications` link).

Nothing about the rule changes — the same restriction now holds on both sides.
Enforced in `server/src/routes/jobs.js` on every write path that can produce a
`published` job:

- `POST /jobs` — a non-draft create
- `POST /jobs/:id/status` — the publish transition
- `PATCH /jobs/:id` — `status: 'published'`

Non-approved employers may still save drafts. Super-admins may publish on an
employer's behalf. Read/visibility paths are deliberately untouched — whether
already-published jobs belonging to an employer whose accreditation is later
revoked should disappear from the public board remains a separate policy
question, not decided here.
