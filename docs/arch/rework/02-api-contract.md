# API contract — Express API v1 (`VITE_API_URL`, all routes under `/api`)

Auth: `Authorization: Bearer <supabase access token>`. Middleware validates
via Supabase (`auth.getUser`), resolves role from local role tables by user
id, attaches `{ id, email, role }`. 401 invalid/expired token, 403 wrong role
or suspended account. Errors: `{ error: { code, message } }`
(`BAD_REQUEST` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
`CONFLICT` 409, `INTERNAL` 500). Frontend `lib/api.js` throws `Error(message)`
with `.status` — pages already render `error.message`.

**Auth caching (Phase 4 F2, 2026-10-16).** The JWT→user resolution
(`supa().auth.getUser(token)`) is memoized **per process, keyed on the exact
token string, TTL 60 s, cap 5,000 entries (FIFO eviction)**, so an
authenticated read no longer pays the ~120 ms Supabase round-trip measured in
`docs/arch/audit/phase4-loadtest.md`. Two consequences load-bearing enough to
state here:

1. **Revocation delay up to the TTL.** A Supabase-side session revocation
   (sign-out-everywhere, password reset) is not visible to the API for up to
   60 s. The browser cannot fix this by retrying; it is a bounded window.
2. **Local account status stays immediate.** Suspension / deactivation is
   enforced by the *local* role-table read (`resolveRole`, Postgres), which is
   **never cached** and runs on every request. An admin suspending an account
   takes effect on the very next request, inside or outside the TTL — the
   cached principal is only the JWT→id resolution.

Invalid/expired tokens are never cached (they must reach Supabase every time),
so a temporarily failing Supabase never freezes a dead token into the cache.
The per-request memo (`req._supaUser`) is unchanged and still sits on top, so
one request resolves the principal once. The cache is per-process; multiple
instances behind a load balancer are unaffected because each simply memoizes
its own tokens.

**Rate limiting & proxy keying (Phase 4 C1/F1/F2/F5, 2026-10-16).** Four
in-memory buckets, all answering `429` with `{ error: { code: 'RATE_LIMITED', … } }`
and emitting `RateLimit`/`RateLimit-Policy` draft-7 headers:

| Bucket | Scope | Limit |
|---|---|---|
| `authLimiter` | everything under `/api/auth` | 100 req / 15 min |
| `uploadLimiter` | `POST /api/documents`, `POST /api/files/*` | 50 req / 15 min |
| `aiLimiter` | `POST /api/ai/help` only, applied *after* `auth` | 20 req / 15 min |
| `apiLimiter` | every other `/api` route | 300 req / 15 min |

`GET /api/health` is mounted **before** the limiters, so load-balancer probes
are never throttled. `apiLimiter`'s `skip` mirrors the auth + upload scopes
exactly, so a request is never double-counted.

**Keying.** `attachPrincipal` runs before `apiLimiter`, so both buckets are keyed
`req.user?.id || ipKeyGenerator(req.ip)`: an authenticated caller gets a bucket
per user id (NAT'd users no longer share one), an anonymous or bad-token caller
falls back to the IP and is still counted. A garbage token therefore cannot mint
fresh buckets — it consumes the IP bucket and then 401s at the route.

**`TRUST_PROXY`** (`server/src/app.js`, read at app-construction time) decides
what `req.ip` means and therefore how trustworthy the IP half of the key is:

- **unset / `0` / non-numeric → fail-safe `false`** (`trust proxy` off). `req.ip`
  is the socket address, which a client cannot forge. This is the default: a
  directly-exposed instance cannot have its limiter defeated by rotating a
  client-set `X-Forwarded-For`.
- **`1`** (or any hop count) → Express trusts that many proxy hops, so
  `req.ip` is the left-most `X-Forwarded-For` entry — the correct setting behind
  exactly one nginx/Caddy/Cloudflare. Set it to the real hop count; a wrong
  value either re-exposes the spoofing hole or keys every request on the proxy.
- Because the principal id **replaces** the IP as the key for authenticated
  traffic, a `TRUST_PROXY` mis-set degrades to the IP bucket only for anonymous
  callers — it cannot rotate an authenticated user's bucket. Local dev has no
  proxy, so per-IP keys are real socket addresses; tests and the load harness
  that need distinct buckets send `X-Forwarded-For` themselves (or build an app
  with `TRUST_PROXY=1`).

The limiter store is per-process (single instance). Traffic split across several
API instances would give each its own budget — move to a shared store if that
ever happens. `CORS_ORIGIN` unset defaults to `http://localhost:5173`
(fail-closed, never reflected).

## Health (public, unauthenticated, unlimited)
- `GET /api/health` → 200 `{ ok: true, db: 'ok' }` when Postgres answers
  `select 1`; 503 `{ ok: false, db: 'unavailable' }` when it does not. Mounted
  before `attachPrincipal` and every limiter so LB probes are never charged.
- `GET /api/health?deep=true` additionally probes Supabase with a dummy token
  and → 200 `{ ok: true, db: 'ok', auth: 'ok' }`, or 503
  `{ ok: false, db: 'ok', auth: 'unavailable' }`. Any HTTP answer from the auth
  service counts as "up" (a 4xx means Supabase is reachable); only a transport
  failure or 5xx is `unavailable`. Shallow is the default — the deep probe adds
  a real network round-trip, so use it for diagnostics, not for the healthcheck.

## Auth/provisioning (public except `me`)
- `POST /api/auth/provision` { role, first_name, middle_name, last_name, suffix, full_name, email, phone?, address…?, company_name?, industry? } → 201 profile row. Replaces `handle_new_user`. Called once after signup/email-confirm; idempotent on (id) — 200 if row exists (a double-submit that loses the PK race answers the same 200, not a 500). Also accepted: `skills?` (deduped/lowercased array), `employment_status?` (must be `Employed | Unemployed | Underemployed | Fresh Graduate | Student`, else 400), `custom_role_id?` (an unknown/stale/non-numeric id is **ignored**, never a 400 — the invite may be old) and, for `job-seeker`, a one-shot `education { level, school, field?, end_year? }` written in the same transaction. `role` must be `job-seeker|employer|super-admin`; a `super-admin` body role is honoured **only** when the token's unforgeable `app_metadata.role` says so, else 403. An existing non-active row is 403 on repeat calls.
- `GET /api/auth/me` → profile + role (auth). 404 = needs provision. Used by `signIn` after Supabase login (replaces `getProfile` fan-out).

## Jobs
- `GET /api/jobs?search=&location=&employmentType=&employer=&salaryMin=&skills=&status=&page=&pageSize=&order=` → `{ jobs, total, page, pageSize }` (jobs embed `employers{id,company_name,logo_path}`; **public list defaults: pageSize 10, max 100** — tighter than the admin 25/500; employer/skills filtered server-side — the client-side PostgREST workaround dies here). Non-super-admin callers (anonymous included) are **pinned to `status=published`**: a caller-supplied `status` is honoured only for a super-admin, so drafts/pending/rejected cannot be enumerated. `order` is `<column>.<asc|desc>` over an allow-list (`created_at`, `updated_at`, `salary_min`, `salary_max`, `title`, `deadline`, `published_at`); anything unknown falls back to `created_at.desc`. `?status=` outside the enum is 400, not a Postgres 500. `GET /api/jobs` is `optionalAuth` — a valid token changes which rows are visible, it does not gate the route.
- `GET /api/jobs/:id` → job + employer embed. Non-published jobs are **404 for everyone but the owner/super-admin** (not 403 — no existence oracle).
- `GET /api/employers/:employerId/jobs?status=&page=&pageSize=` → jobs with `applicant_count` (replaces embedded `job_applications(count)`; paginated 2026-10-15, 25/500 defaults, same `{ data, total, page, pageSize }` envelope as admin lists). Non-uuid id → 400; another company's id → 403; `?status=` validated against the enum → 400.
- `POST /api/jobs` (employer) → 201 job. `company_id` taken from token, never body. `title` required (an empty title is rejected there, before the coercion below); `work_arrangement` validated against `On-site | Remote / Work from home | Hybrid`. The body's `status` is ignored except `draft`: anything else becomes `published` (ADR-000 — publish is direct), and a non-accredited company gets **403** from the accreditation gate (drafts are still allowed). Empty-string values become NULL.
- `PATCH /api/jobs/:id` (owner employer, admin) → job. Owner employers may set `draft | published | closed | archived`; super-admins get the full enum (400 on anything else). No fields → 400. `published` passes through the same accreditation gate. Writes `job_status_history` in the **same transaction**.
- `POST /api/jobs/:id/duplicate` → 201 draft copy (`title` suffixed `(Copy)`, `deadline` cleared, id/timestamps/status/remarks/company_name/logo_path stripped).
- `POST /api/jobs/:id/status` { status, remarks? } (owner employer, admin) → job; writes `job_status_history` in the SAME transaction (fixes today's two-write drift); notifies admins + matching seekers on `published`.
- `DELETE /api/jobs/:id` (owner employer, admin) → 200 `{ deleted: true, applications: n }` (ADR-013). **Destructive by contract:** the row cascades to `job_status_history` and `job_applications`, which cascades onward to `application_status_history` and `employment_history`. Unconditional — no applicants-present guard. The client confirm dialog must state `n`; the same number is written to the audit detail. Archive is the soft alternative.
- `GET /api/jobs/:id/history` (owner employer, admin) → status history rows, newest first.
- Side effect of every publish (create, PATCH with `status`, `POST /:id/status`, admin review-approve): a best-effort `notifyMatchingSeekers` fan-out — skills overlap or `preferred_location ilike` match, one multi-row INSERT capped at 100 seekers. It is wrapped so a failure never fails the publish.

## Applications (seeker owns own; employer owns own jobs' rows; admin all)
- `POST /api/applications` { job_id, resume_id? } (seeker) → 201; duplicate → 409 (replaces `23505` guard). Notifies employer. Requires the job to be `published` **and** `deadline is null or deadline >= current_date`, checked inside the `INSERT … SELECT … WHERE EXISTS` (not before it) so a job closed or expired between the read and the write cannot slip through — a 400 with "The application deadline for this job has passed." An unknown/foreign `resume_id` is a 400, not a silent NULL.
- `GET /api/applications/mine` (seeker) → rows with job + employer embeds (no seeker embed — it is the caller).
- `GET /api/applications/job/:jobId`, `GET /api/applications/company/:companyId` (owner employer, admin) → rows with seeker embeds (`attachSeekers` moves server-side). **Deliberately unpaginated: a plain JSON array, no `{ data, total, page, pageSize }` envelope** — verified against the code 2026-10-16. `/company/:companyId` takes a non-uuid id → 400 and writes an `application.list.view` audit row; `/job/:jobId` has no such row.
- `GET /api/applications/employers/me/dashboard` (employer) → `{ jobs, stats, recent }` — 3 queries: all of the caller's own jobs (`id, title, status`), the counters `{ total_candidates, new_this_week }` for that company, and the 5 most recent applicants as `{ id, applied_at, seeker_full_name, job_title }`. `company_id` comes from the **token only**, never params — there is no id in the path. Added 2026-10-15 to replace the employer dashboard's full-list fetch plus its per-row resume subquery.
- `POST /api/applications/:id/status` { status, remarks?, employerNotes?, interviewAt?, interviewInstructions? } (owner employer, admin) → application + history row in one transaction; notifies seeker (best-effort, never fails the action — same as today's `notify`). `status` must be one of `Applied | Under Review | Interview | Accepted | Rejected | Placed | Terminated` (400 otherwise). `remarks` and `employerNotes` both land in `employer_notes` (`employerNotes` wins when both are present).
- `GET /api/applications/:id/history` → status history rows, newest first. Readable by the seeker who owns it, the owner of the job, or an admin.
- Addendum B reads: `GET /api/applications/seekers/:seekerId/{education,experience,employment}`.

## Employers / seekers / accreditation / documents+files
- `GET/PATCH /api/employers/me`, `GET/PATCH /api/seekers/me` (replaces `updateProfile` fan-out; PATCH allow-lists per-role columns, stamps `updated_at`, writes audit). Empty-string values are NULL for optional columns and stay `''` for the `not null default ''` text columns. Text fields named in `LOWERCASE_FIELDS` are trimmed + lowercased server-side. An empty patch is 400; the target row missing is 404; wrong role is 403.
- `POST /api/accreditations` (employer, own company) → 201 pending + syncs `employers.accreditation_status` (DB trigger, not the route). `GET /api/accreditations/company/:companyId` → newest-first rows, each embedding `decided_by {full_name}`; non-uuid id → 400. `PATCH /api/accreditations/:id` (admin) { status, remarks? } → syncs employer row, notifies employer, stamps `decided_at` on terminal states — `status` must be one of `none | pending | approved | rejected | resubmission | revoked` (400 otherwise), and a non-uuid id is 404.
- `POST /api/documents` multipart (employer) { doc_type, accreditation_id? } → 201 + file row; notifies admins. **`doc_type` is required → 400 `BAD_REQUEST` "doc_type is required"** (2026-10-15, F-04 fix): without it there is no `employer_documents` row, no audit, and no read path. A missing file is 400, a disallowed extension is 400, a >2 MB PDF is 400 (and the temp file is deleted). `accreditation_id` is verified against the caller's own company and **silently dropped** when it is unknown, malformed, or another company's — never a 403, never a 22P02 500.
- Files (replaces Supabase Storage `resumes`/`documents` buckets): `POST /api/files/resumes` multipart (seeker) → { path, resume row } — takes **no** `doc_type` (a resume is not a document); the `resumes` row is always created, and an insert failure (e.g. the one-active-resume unique index on a concurrent upload) answers 500 with the just-written temp file unlinked. `POST /api/files/documents` multipart (employer) → { path, document row } — **`doc_type` is required → 400 `BAD_REQUEST` "doc_type is required"** while deleting the just-written file, so no unreachable orphan can be left on disk (F-04 fix, 2026-10-15); `accreditation_id` is ownership-checked and silently dropped when unknown, malformed, or another company's — same rule as `POST /api/documents`. `DELETE /api/files/resumes/:id` (DB row + disk file); `GET /api/files/:bucket/*path` (auth + ownership check: own resume, own-company doc, or admin — plus the Addendum A employer-via-application exception) replaces `signedUrl`. The upload rules — 5 MB general, pdf/doc/docx/png/jpg, **PDF capped at 2 MB** — are pre-checked client-side by `validateFile` (`src/shared/services/documents.js`) and re-enforced server-side by `uploadSingle` (`server/src/upload.js`); a violation is 400 and the temp file is deleted. Active-resume semantics (`setActiveResume`, one active per seeker) move server-side.
- `GET /api/documents/company/:companyId` (owner employer, admin) → document rows, each embedding `reviewed_by {full_name}` and `company {id, company_name}` (replacing the two PostgREST embeds). Non-uuid id → 400.
- `PATCH /api/documents/:id` (admin) { status, remarks? } → stamps `reviewed_at`, notifies the employer on `verified`/`rejected`. `status` must be `pending | verified | rejected | missing` (400 otherwise); a non-uuid id is 404, not a 22P02 500.

## Admin (role `super-admin` only)
- `GET /api/admin/stats` → `{ seekers, employers, companies, jobs, applications, pendingAccreditations, unreadNotifications, pendingJobs, approvedJobs, closedJobs, expiredJobs, acceptedApplicants, placedApplicants, accreditedEmployers }` — **14 keys**, all `::int` numbers (2026-10-15: seven counters were added; `companies` is still the same value as `employers`, kept for the old client name). Additive only — read the keys you need, never assume the set is closed.
- **`pageParams` guard (`util.js:52`), shared by every paginated route (`GET /jobs`, the five admin lists, `GET /employers/:employerId/jobs`, `GET /admin/reports/:type/export`):** `Number()`, not `parseInt` — `parseInt('1e21')` silently truncates to page 1; `Number` keeps the magnitude so the clamp below catches it. A present-but-junk `page`/`pageSize` (non-integer, 0, negative; an empty string counts as absent → default) is **400 `BAD_REQUEST`** sent by the guard itself, not a silent default. `page` is then clamped to ≤ 1,000,000 and `pageSize` to the route's max, so an absurd OFFSET cannot overflow the SQL. See ADR-029.
- `GET /api/admin/users?role=&search=&status=&page=&pageSize=` → **`{ data, total, page, pageSize }`** (paginated 2026-10-15; merged single `UNION ALL` ordered in SQL, role re-attached from the branch literal). One row per user id, chosen exactly like `resolveRole`: an **active row wins, then table precedence** (super-admin → employer → job-seeker) — see ADR-027. Filters run on the *deduped* row, so a deactivated row can never leak through `?role=`/`?status=`/`?search=`. `role` must be `job-seeker|employer|super-admin` and `status` one of `active|inactive|suspended`, else 400.
  `GET /api/admin/companies?status=&page=&pageSize=`, `GET /api/admin/jobs?status=&page=&pageSize=`, `GET /api/admin/applications?status=&search=&page=&pageSize=`, `GET /api/admin/accreditations?page=&pageSize=` → same envelope (defaults 25/500). Enum-valued filters are validated against their allow-list first, so a bad value is 400 rather than a Postgres 500; the applications `search` is a server-side `ilike` on the seeker's name via the join.
  Frontend `shared/services/admin.js` returns the envelope; pages read `.data` and render the shared `Pager` from `components/dashboard.jsx`.
  **Known unbounded gaps (plain arrays, no envelope):** `/admin/employees`,
  `/admin/referrals`, `GET /applications/job/:jobId`,
  `GET /applications/company/:companyId`. Paginate each when its row count
  outgrows one screen.
- `GET /api/admin/employees` (Accepted/Terminated + job/company/seeker embeds, newest-updated first), `GET /api/admin/referrals` (`referred_by not null` + job/company/seeker embeds) → **plain arrays**. `/admin/jobs` rows carry `j.*` plus an `employers {id, company_name}` embed (there is no `employer_id` column on `job_vacancies` — it is `company_id`); `/admin/accreditations` rows carry the full `employers` row as `employers` and `decided_by {full_name}`; `/admin/applications` rows carry `job` (title/location/employers) and `seeker` (the 9-column projection) embeds.
- Retention is fully automated (no API trigger, no UI): `runRetentionPurge()` in `admin.js` runs daily via `setInterval`, deleting 12+ month-old non-employment applications only (Accepted/Placed/Terminated always retained per Terms §4; seeker profiles, résumés, documents kept); each run writes a `data.purge` audit row with `user_id NULL` (System). The cutoff is computed by Postgres (`now() - make_interval`), never by JS `setMonth`. Disable with `RETENTION_DISABLE=1`.
- `GET /api/admin/audit-logs?limit=&userId=&action=&from=&to=` (+ rows carry `actor_name` + `actor_email`, resolved server-side via left joins to the three role tables; null when `user_id` is null; UI renders `actor_email`, falling back to "System / legacy"). `limit` defaults to 500 and is clamped to 1–2000. A malformed `userId` is 400; `from`/`to` must be `YYYY-MM-DD` (400 otherwise) and are compared naively against the Postgres session timezone (fixed UTC+8 deployment — see the `ponytail:` note in `admin.js`).
  `GET/POST /api/admin/reference/:category`, `DELETE /api/admin/reference/:id` (reference data: employment types, education levels, custom roles…; delete of an unknown or non-numeric id → 404/400).
- `GET /api/admin/permissions` → the canonical permission catalog, `[{ key, label }]` (9 entries: `dashboard.view`, `accreditation.manage`, `jobs.manage`, `users.manage`, `roles.manage`, `reports.view`, `logs.view`, `notifications.send`, `settings.manage`). Server-owned so the client has no copy; every role payload is validated against the same list.
- **Custom roles** (`reference_data` rows, `category = 'custom_role'` — tag-only, they never create a login identity):
  - `GET /api/admin/roles` → `[{ id, name, description, permissions, base_role, sort_order }]`.
  - `POST /api/admin/roles` { name, description?, permissions?, base_role? } → 201 the same shape. `name` required, `base_role` one of `super-admin|employer|job-seeker` (default `super-admin`), unknown permission keys are dropped rather than 400. Duplicate name → 409.
  - `PATCH /api/admin/roles/:id` (same body) → updated row; unknown id → 404, duplicate name → 409, non-numeric id → 400.
  - `DELETE /api/admin/roles/:id` → 200 `{ deleted: true }`; every user tagged with it is untagged first (the 3 role tables are `custom_role_id = null`), non-numeric/unknown id → 400/404.
  - `POST /api/admin/users/:id/custom-role` { custom_role_id? } → updated user row + `role`. Self-move → 403; unknown user → 404; unknown role id → 400. `null` untags.
- **User lifecycle:** `POST /api/admin/users/invite` (ADR-024) { email, first_name, last_name, role, custom_role_id?, middle_name?, suffix?, phone?, company_name? } → 201 `{ invited: true, email, role }`; a duplicate email is 409 and a bad payload 400. **Writes no DB row** — the invitee's role row is created by `POST /auth/provision` when they accept the invite, and `app_metadata.role` (service-role-only, unforgeable) is what lets provision honour a `super-admin` role.
  `POST /api/admin/users/:id/role` { role } → 200 `{ id, role }`. **Deactivate + upsert, never delete** (ADR-027): deleting the old table's row cascades through `job_vacancies` → `job_applications` and destroys the user's postings, applications and history. Both writes share one transaction; a same-email row already in the target table is 409; self-move → 403; unknown user → 404; an invalid role → 400. Moving back onto a table that still holds the deactivated row **reactivates** it (`on conflict (id) do update`) instead of hitting the PK.
  `PATCH /api/admin/users/:id` → updated row. Allow-list from the live table (`information_schema.columns`), `id`/`email`/`role`/`created_at`/`updated_at` stripped, `role` change → 400 (disabled by design — use `/role`), self-editing `status` or `custom_role_id` → 403, unknown user → 404, empty patch → 400, email collision → 409.
- `PATCH /api/admin/jobs/:id` (edits + status in one transaction), `POST /api/admin/jobs/:id/publish` (→ `published`, stamps `published_at`), `POST /api/admin/jobs/:id/unpublish` (→ `draft`) → updated job row. These are admin routes, so there is **no ownership check** — a super-admin may moderate any company's posting. `status`/`work_arrangement` validated against the same allow-lists as the employer routes (400); empty patch → 400; non-uuid or unknown id → 404. Each writes a `job_status_history` row in the same transaction and fires the same publish fan-out as the employer path (employer notified + matching seekers). The admin allow-list includes the PESO review statuses (`pending`, `approved`, `rejected`).
- `POST /api/admin/system-notifications` { title, message, link?, expires_at? } → 200 `{ sent: n }` — one `system` notification row per **active** user across all three role tables (never a NULL `user_id`; the column is NOT NULL). `expires_at` has no column to live in, so it is recorded in the audit detail only. Missing `title`/`message` → 400.
- `GET /api/admin/seekers/:id/{education,experience,employment}` (admin unrestricted; non-uuid id → 404).
- **`GET /api/admin/reports/:type/export?format=csv&page=&pageSize=`** → 200 `text/csv` + `Content-Disposition: attachment; filename="<type>-report.csv"`. Super-admin only. `type` must be one of `applicants | vacancies | placements | employers | barangay | monthly | seekers`; the legacy frontend names `applications` and `jobs` are aliased to `applicants` and `vacancies`. `format` must be `csv` (ADR-030 — anything else is 400 `BAD_REQUEST`; the old excel/pdf branches are gone). Row report types are paginated with the same `pageParams` defaults (500/2000); the aggregate types (`barangay`, `monthly`) group down to a naturally bounded result and are unpaginated. **The endpoint has no client caller** — the Reports page builds its CSV in the browser, which is why the export was kept server-side as a documented deliverable while the client wrapper was removed.
- `POST /api/audit` { action, entity?, entity_id?, details? } — token-auth, best-effort (a failed WRITE never 4xxs the caller; 204). For client-observed events only; `action` is allow-listed to `auth.login`, `auth.logout`, `auth.password.change`, `auth.password.reset.request` (exactly what the SPA posts) — **an unknown action is a deliberate 400 `BAD_REQUEST`** (request validation, 2026-10-15: audit-trail forgery fix F-03 — without the list any authenticated user could forge server action names such as `user.role.change` into the admin Audit-Logs view). Everything else about the route is unchanged: `entity`/`entity_id`/`details` are optional and are **never** validated (they are free-text payload for the operator's own log). All data-action auditing still happens server-side. (2026-10-03: added so Login History has rows.)
- `GET /api/notifications/mine?unreadOnly=true|1` → newest-first array capped at **50 rows**. `POST /api/notifications/:id/read` → 200 `{ read: true }` (404 when the id is not the caller's row — the update is scoped, but a 200 would imply their row was touched); non-numeric id → 400. `POST /api/notifications/read-all` → 200 `{ read: true }`. `DELETE /api/notifications/:id` — see Addendum C. `user_id` comes from the token on every one of them, never params.

Guard matrix (only rules the API enforces; everything else is 403): seeker ⇄ own `id`; employer ⇄ rows where `company_id` = own `id`; admin ⇄ all. Audit writes use the token user id, wrapped so they never throw.

## Addendum A (2026-10-03, arch ruling on backend-flagged gaps)
- Resumes: `GET /api/files/resumes/mine` (seeker) → own resume rows (`listResumes`); `POST /api/files/resumes/:id/activate` (seeker) → active-resume swap (`setActiveResume`).
- Seeker profile children: `GET/POST /api/seekers/me/education`, `DELETE /api/seekers/me/education/:id`; same trio under `…/experience` (work_experience); `GET /api/seekers/me/employment` (read-only, trigger-written). Admin may read all three via `GET /api/admin/seekers/:id/{education,experience,employment}`.
- Employer resume reads: file GET additionally allows an employer when a `job_applications` row links that resume to one of their jobs (replaces today's storage-policy applicant reads).
- Job-search `total` agrees with the page: the skills filter runs in SQL, in the same WHERE clause as the count (`jobs.js`), so a page can no longer come back short while `total` counts unfiltered rows. This supersedes the 2026-10-03 ruling ("count before skills post-filter") — the filter moved into SQL when the list was server-paginated.

## Addendum B (2026-10-03, arch ruling on frontend-flagged gaps)
- Provision bypass (BOOT-BLOCKING): `POST /api/auth/provision` validates the
  token (authenticity) but SKIPS the provisioned-row check — a fresh session
  has no row by definition. `GET /api/auth/me`: valid token + no row → 404
  (not 403); suspended row → 403 stays. Frontend treats both 404/403 as
  needs-provision, so either shape works, but 404 is canonical.
- Employer credential reads: an employer may `GET` education/experience (and
  employment, read-only) of any seeker having a `job_applications` row on one
  of their jobs — same join rule as the resume-file exception in Addendum A.
  `GET /api/applications/seekers/:seekerId/{education,experience,employment}`
  (owner employer of a linked application; admin unrestricted). Frontend drops
  its admin-endpoint workaround and uses these (empty-on-error fallback stays).
  An employer asking about a seeker with no linked application is 403, not an
  empty list; a malformed seeker id is 400.

## Addendum C (2026-10-13, arch-approved notification delete)
- `DELETE /api/notifications/:id` (owner-scoped, user_id from token, never params) → 200 `{ deleted: true }`; id of another user's row → 404 `NOT_FOUND`; non-numeric id → 400 `BAD_REQUEST`. Errors: `{ error: { code, message } }`.

## Addendum D (2026-10-13, arch-approved AI help chat — ADR-023)
- `POST /api/ai/help` (role `job-seeker` only; every other role and anonymous → 403/401) → 200 `{ reply: string }`.
  Body `{ messages: [{ role: "user" | "assistant", content: string }] }`, 1–10 entries, final entry must be `user`, each `content` 1–1000 chars.
  `400 BAD_REQUEST` on any shape/limit violation · `429 RATE_LIMITED` via `aiLimiter` (20 req / 15 min, keyed `req.user?.id || req.ip`, applied after `auth`) · `502 UPSTREAM_ERROR` when the provider returns non-OK or exceeds 10s · `503 AI_NOT_CONFIGURED` when `OPENROUTER_API_KEY` is unset (the API still boots). Errors: `{ error: { code, message } }`.
  Reads no tables and returns no personal data. No streaming, no history, no per-user memory.

## Reconciliation pass (2026-10-16)

This document was reconciled against the code after the Phase 6 review
(`docs/arch/audit/phase6-code-review.md` §4 listed 13 drift rows). What changed,
so a future reader can tell what is new here versus what was always true:

- Documented the admin surface that had grown outside the rework: `/admin/permissions`,
  the `custom_role` CRUD (`GET/POST/PATCH/DELETE /admin/roles`),
  `POST /admin/users/invite` (ADR-024), `/users/:id/role`, `/users/:id/custom-role`,
  `PATCH /admin/jobs/:id`, `POST /admin/jobs/:id/publish|unpublish`,
  `POST /admin/system-notifications`, `GET /admin/reports/:type/export` (ADR-030),
  `GET /api/health`, and `GET /applications/employers/me/dashboard`.
- `GET /admin/stats` documented at its real 14 keys (was 7).
- `DELETE /api/jobs/:id` (ADR-013) and the envelope on `GET /employers/:employerId/jobs`.
- The `POST /api/audit` unknown-action 400 (deliberate exception to best-effort).
- The token-cache revocation tradeoff, the four rate-limit buckets, and `TRUST_PROXY`
  keying — the last three are cross-cutting and were previously only in code comments.
- Response shapes that had never been written down (notification read/read-all,
  document reviews, report pagination, `pageParams` clamping, embed shapes per list).
- Second-pass corrections (2026-10-16, same review round): the first pass overreached
  on two points — only `POST /files/documents` requires `doc_type` (`/files/resumes`
  never did; it writes a `resumes` row), and `validateFile` is the *client* pre-check
  (`shared/services/documents.js`) whose rules `uploadSingle` re-enforces server-side.
  Addendum A's skills/`total` ruling was also superseded by the SQL filter.

Not changed here (recorded as gaps, not decisions): the unbounded
`/admin/employees`, `/admin/referrals` and `GET /applications/{job,company}/…`
reads, and the `/notifications/*` routes still being mounted from
`routes/admin.js` instead of `routes/notifications.js` (ADR-026 is still open).
