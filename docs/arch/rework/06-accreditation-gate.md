# ADR-022 — Accreditation gate removed, posting restriction kept [SIGNED OFF]

Employers enter the full portal regardless of `accreditation_status` — the
layout redirect to `/register/employer/status` and the JobPosts full-page
"LOCKED" wall are deleted. The only enforcement left is the create guard in
`handleOpenCreate` ("must be accredited before you can post jobs"); pending
employers see an empty job list. `EmployerStatus.jsx` + route stay for the
fresh-registration flow. Server-side `company_id`-ownership and status rules
are unchanged.
