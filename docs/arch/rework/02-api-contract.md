# API contract — Express API v1 (`VITE_API_URL`, all routes under `/api`)

Auth: `Authorization: Bearer <supabase access token>`. Middleware validates
via Supabase (`auth.getUser`), resolves role from local role tables by user
id, attaches `{ id, email, role }`. 401 invalid/expired token, 403 wrong role
or suspended account. Errors: `{ error: { code, message } }`
(`BAD_REQUEST` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
`CONFLICT` 409, `INTERNAL` 500). Frontend `lib/api.js` throws `Error(message)`
with `.status` — pages already render `error.message`.

## Auth/provisioning (public except `me`)
- `POST /api/auth/provision` { role, first_name, middle_name, last_name, suffix, full_name, email, phone?, address…?, company_name?, industry? } → 201 profile row. Replaces `handle_new_user`. Called once after signup/email-confirm; idempotent on (id) — 200 if row exists.
- `GET /api/auth/me` → profile + role (auth). 404 = needs provision. Used by `signIn` after Supabase login (replaces `getProfile` fan-out).

## Jobs
- `GET /api/jobs?search=&location=&employmentType=&employer=&salaryMin=&skills=&status=&page=&pageSize=&order=` → `{ jobs, total, page, pageSize }` (jobs embed `employers{id,company_name,logo_path}`; default status `published`; employer/skills filtered server-side — the client-side PostgREST workaround dies here).
- `GET /api/jobs/:id` → job + employer embed.
- `GET /api/employers/:employerId/jobs?status=` → jobs with `applicant_count` (replaces embedded `job_applications(count)`).
- `POST /api/jobs` (employer) → 201 job. `company_id` taken from token, never body.
- `PATCH /api/jobs/:id` (owner employer) → job. `POST /api/jobs/:id/duplicate` → 201 draft copy, same strip list as today. `POST /api/jobs/:id/status` { status, remarks? } (owner employer) → job; writes `job_status_history` in the SAME transaction (fixes today's two-write drift); notifies admins on `published`.
- `GET /api/jobs/:id/history` (owner employer, admin) → status history rows.

## Applications (seeker owns own; employer owns own jobs' rows; admin all)
- `POST /api/applications` { job_id, resume_id? } (seeker) → 201; duplicate → 409 (replaces `23505` guard). Notifies employer.
- `GET /api/applications/mine` (seeker) → rows with job + employer embeds.
- `GET /api/applications/job/:jobId`, `GET /api/applications/company/:companyId` (owner employer) → rows with seeker embeds (`attachSeekers` moves server-side).
- `POST /api/applications/:id/status` { status, remarks?, employerNotes?, interviewAt?, interviewInstructions? } (owner employer) → application + history row in one transaction; notifies seeker (best-effort, never fails the action — same as today's `notify`).
- `GET /api/applications/:id/history` → status history.

## Employers / seekers / accreditation / documents+files
- `GET/PATCH /api/employers/me`, `GET/PATCH /api/seekers/me` (replaces `updateProfile` fan-out; PATCH allow-lists per-role columns, stamps `updated_at`, writes audit).
- `POST /api/accreditations` (employer, own company) → 201 pending + syncs `employers.accreditation_status`. `GET /api/accreditations/company/:companyId`. `PATCH /api/accreditations/:id` (admin) { status, remarks? } → syncs employer row, notifies employer, stamps `decided_at` on terminal states — same rules as `updateAccreditation`.
- `POST /api/documents` multipart (employer) { doc_type, accreditation_id? } → 201 + file row; notifies admins. `GET /api/documents/company/:companyId` (embed reviewer name + company name, replacing the two PostgREST embeds). `PATCH /api/documents/:id` (admin) { status, remarks? } → stamps `reviewed_at`, notifies employer.
- Files (replaces Supabase Storage `resumes`/`documents` buckets): `POST /api/files/resumes` multipart (seeker) → { path, resume row }; `POST /api/files/documents` multipart (employer); `DELETE /api/files/resumes/:id` (DB row + disk file); `GET /api/files/:bucket/*path` (auth + ownership check: own resume, own-company doc, or admin) replaces `signedUrl`. `validateFile` rules (5 MB, pdf/doc/docx/png/jpg) enforced server-side via multer limits + extension check. Active-resume semantics (`setActiveResume`, one active per seeker) move server-side.

## Admin (role `super-admin` only)
- `GET /api/admin/stats` → `{ seekers, employers, companies, jobs, applications, pendingAccreditations, unreadNotifications }` (same shape as `getStats`).
- `GET /api/admin/users?role=&search=&status=` → merged role-tagged rows, newest first. `PATCH /api/admin/users/:id` → same no-role-change rule.
- `GET /api/admin/companies?status=`, `GET /api/admin/jobs?status=`, `GET /api/admin/applications?status=&search=` (search on seeker name server-side via join — today's client filter moves down), `GET /api/admin/employees` (Accepted/Terminated + embeds, company-grouped), `GET /api/admin/referrals` (`referred_by not null` + embeds), `GET /api/admin/accreditations` (full embeds), `POST /api/admin/purge` { monthsOld=12 } → `{ deleted }` (same keep-Accepted/Placed rule).
- `GET /api/admin/audit-logs?limit=&userId=&action=&from=&to=` (+ rows carry `actor_name` + `actor_email`, resolved server-side via left joins to the three role tables; null when `user_id` is null; UI renders `actor_email`, falling back to "System / legacy"), `GET/POST /api/admin/reference/:category`, `DELETE /api/admin/reference/:id`.
- `POST /api/audit` { action, entity?, entity_id?, details? } — token-auth, best-effort (never 4xxs the caller; 204). For client-observed events only (login, logout, password change/reset). All data-action auditing still happens server-side. (2026-10-03: added so Login History has rows.)
- `GET /api/notifications/mine?unreadOnly=`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` (user_id from token, never params).

Guard matrix (only rules the API enforces; everything else is 403): seeker ⇄ own `id`; employer ⇄ rows where `company_id` = own `id`; admin ⇄ all. Audit writes use the token user id, wrapped so they never throw.

## Addendum A (2026-10-03, arch ruling on backend-flagged gaps)
- Resumes: `GET /api/files/resumes/mine` (seeker) → own resume rows (`listResumes`); `POST /api/files/resumes/:id/activate` (seeker) → active-resume swap (`setActiveResume`).
- Seeker profile children: `GET/POST /api/seekers/me/education`, `DELETE /api/seekers/me/education/:id`; same trio under `…/experience` (work_experience); `GET /api/seekers/me/employment` (read-only, trigger-written). Admin may read all three via `GET /api/admin/seekers/:id/{education,experience,employment}`.
- Employer resume reads: file GET additionally allows an employer when a `job_applications` row links that resume to one of their jobs (replaces today's storage-policy applicant reads).
- Job-search `total` keeps today's semantics (count before skills post-filter) — no change.

## Addendum B (2026-10-03, arch ruling on frontend-flagged gaps)
- Provision bypass (BOOT-BLOCKING): `POST /api/auth/provision` validates the
  token (authenticity) but SKIPS the provisioned-row check — a fresh session
  has no row by definition. `GET /api/auth/me`: valid token + no row → 404
  (not 403); suspended row → 403 stays. Frontend treats both 404/403 as
  needs-provision, so either shape works, but 404 is canonical.
- Employer credential reads: an employer may `GET` education/experience (and
  employment, read-only) of any seeker having a `job_applications` row on one
  of their jobs — same join rule as the resume-file exception in Addendum A.
  New: `GET /api/applications/seekers/:seekerId/{education,experience}` (owner
  employer of a linked application; admin unrestricted). Frontend drops its
  admin-endpoint workaround and uses these (empty-on-error fallback stays).
