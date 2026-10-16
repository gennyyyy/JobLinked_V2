# GAP MATRIX — `to_do.md` spec vs real code (`src/`, `supabase/migration.sql`)

Legend: **DONE** = wired UI + service + schema. **PARTIAL** = exists but incomplete/different. **STUB** = code/schema exists, never exercised end-to-end. **MISSING** = no evidence.
Counts = DONE / PARTIAL / STUB / MISSING per module.

> **Stale-premise notice (2026-10-16).** The rows below were written 2026-10-03 against
> `src/pages/*` + `supabase/migration.sql`. Both have since been superseded: the app moved to
> `src/features/<role>/` + `src/shared/`, and the live schema is `db/schema.sql` + `db/migrations/*`
> (Supabase is auth-only, ADR-020). Row *statuses* are updated where re-verified below; several
> *evidence paths* still point at files that no longer exist. See
> **"Session close-out status (2026-10-16)"** at the bottom for the re-verified list.

---

## 1. Employee / Job Seeker (counts: 62 / 18 / 5 / 17)

### Authentication & Account (4/1/0/1)

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Register | DONE | `src/pages/JobSeekerRegister.jsx:41-84` → `auth.js:43-88`; trigger `migration.sql:805-890` | Full form + `emailConfirmationRequired` branch |
| Login | DONE | `src/pages/Login.jsx:20-32` → `auth.js:30-41` | Role-based redirect via `PORTALS` |
| Logout | DONE | `layouts/JobSeekerLayout.jsx:18-28` → `auth.js:90-95` | + AFK logout `hooks/useAFKTimer.js:29-31` |
| Forgot Password | DONE | `src/pages/ForgotPassword.jsx:12-29` → `auth.js:109-114` | Sends reset link |
| Reset Password | DONE | `auth.js:resetPassword` `redirectTo: origin/reset-password`; `App.jsx:66` route → `auth/ResetPassword.jsx` (ADR-002) | Full round-trip |
| Account Verification | DONE | `JobSeekerRegister.jsx:89-122` `needsConfirmation` + Supabase confirm | — |

### Dashboard (5/2/0/0)

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Overview | DONE | `job-seeker/Dashboard.jsx:35-86` stats + recent apps | — |
| Recommended Jobs | DONE | `Dashboard.jsx:13-24,45-58` skill/pref/barangay scorer, top-3 | Client-side only |
| Active Applications | DONE | `Dashboard.jsx:67` count (actually total) | Label says Active, value = all |
| Pending Applications | PARTIAL | Same file: no `Applied`/`Under Review` bucket | Only Active/Shortlisted/Rejected/New |
| Shortlisted Applications | DONE | `Dashboard.jsx:68,77` | — |
| Accepted Applications | PARTIAL | Dashboard shows `Rejected`, not `Accepted`; `Applications.jsx:26` has accepted filter | Accepted visible only on Applications page |
| Notifications | DONE | `NotificationBell.jsx:1-89` in `JobSeekerLayout.jsx:45,80` | — |
| Profile Completion | DONE | `Dashboard.jsx:26-33,112-128` + `Profile.jsx:151-154` | Two formulas differ slightly |

### Profile Management (14/0/0/0) — all DONE

Personal/Contact/Address/Barangay/Employment Status/Education/Work Exp/Skills/Pref Position/Pref Location/Edit: `job-seeker/Profile.jsx:92,120-139` form; `250-287` `updateProfile`; education `169-190`, experience `199-221`, `EMPLOYMENT_STATUSES` from `constants.js:5`, address via `utils/address.js`.

### Resume Management (3/1/0/2)

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Upload | DONE | `Profile.jsx:223-237` → `documents.js:15-23` bucket `resumes` (`migration.sql:920,928-945`) | 5 MB + ext check `documents.js:8-13` |
| View Resume | DONE | `job-seeker/Profile.jsx:35` View (new tab, blob URL from the API file GET) | ADR-004 closed |
| Download Resume | DONE | `Profile.jsx:36` `<a download>` with the original file name | ADR-004 closed |
| Replace Resume | PARTIAL | `Profile.jsx:498` "Replace" label re-triggers upload; no explicit replace-by-id (adds new row) | Old file orphaned |
| Delete Resume | DONE | `Profile.jsx:244-248` → `documents.js:59-63` | DB + storage remove |
| Resume Management (active flag) | DONE | `Profile.jsx:492-497` + `documents.js:52-57` | — |

### Job Search & Browsing (10/0/0/0) — all DONE

`job-seeker/Jobs.jsx:7-37` → `jobs.js:9-36`: keyword/title (`search`), employer (client filter `jobs.js:25-26`), skills (client filter `27-32`), location `14`, salary `16`, employment type `15`, employer filter, sort `17-18,104-115`. Public mirror `PublicJobs.jsx:7-33` (keyword+location only).

### Job Details (7/3/0/3)

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Job Description | DONE | `JobDetail.jsx:99-102`, `PublicJobDetail.jsx:76-79` | — |
| Qualifications | DONE | `JobDetail.jsx:56,104-116` splits `requirements` | Free-text, not structured |
| Salary | DONE | `JobDetail.jsx:73-75,78-82` | — |
| Benefits | DONE | `JobDetail.jsx:118-123` | — |
| Location | DONE | `JobDetail.jsx:83-86` | — |
| Number of Vacancies | DONE | `JobDetail.jsx:135` renders `job.vacancies` ("—" when null) → ADR-005 | Closed |
| Education Requirements | PARTIAL | Folded into free-text `requirements` | No separate field |
| Experience Requirements | PARTIAL | Same | — |
| Skills (tags) | DONE | `JobDetail.jsx:89,187-191` tag chips, only when non-empty → ADR-005 | Closed |
| Application Deadline | DONE | `JobDetail.jsx:139` formatted date, "No deadline" when null → ADR-005 | Also drives the closed/disabled apply state |
| Application Instructions | DONE | `JobDetail.jsx:125-130` | — |

### Applications & Status (10/1/2/2)

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Apply for Job | DONE | `JobDetail.jsx:43-54` → `applications.js:33-48` unique guard `23505` | RLS requires `published` (`migration.sql:508-512`) |
| Select Resume | DONE | `JobDetail.jsx:145-153` dropdown, active default `32-33` | — |
| Upload New Resume (inline) | MISSING | No file input on `JobDetail.jsx`; must leave to Profile | — |
| Application Confirmation | DONE | `JobDetail.jsx:134-137` inline confirmation | No modal, adequate |
| Application History | DONE | `Applications.jsx:15-21` `listBySeeker`; expandable rows `121-140` | — |
| Application Status | DONE | Status pills `Applications.jsx:108-118` | — |
| Interview Details | DONE | `Applications.jsx:101-105,124-132` `interview_at` + `interview_instructions` | Set by employer `Applicants.jsx:57-61` |
| Employer Instructions/Notes | DONE | `Applications.jsx:133-138` `employer_notes` | Written by `applications.js:106-110` but no employer UI input (see §2) → ADR-007 |
| Status: Applied | DONE | Default `'Applied'` `migration.sql:482`; rendered | — |
| Status: Under Review | DONE | `employer/Applicants.jsx:167,218,294` tab + "move back" action → ADR-003 | Wired |
| Status: Shortlisted | STUB | `Dashboard.jsx:68`, `Applications.jsx:110` render/count it; `Applicants.jsx:166-170` has **no** shortlist action | Still unwired → ADR-003 half-open |
| Status: Interview | DONE | `Applicants.jsx:184-187,260-301` schedule flow | — |
| Status: Accepted | DONE | `Applicants.jsx:188-190`; moves to Employees `95` | Triggers `record_accepted_employment()` `migration.sql:634-668` |
| Status: Rejected | DONE | `Applicants.jsx:191-195` | — |

### Notifications (5/0/0/2)

New Job Notifications **MISSING** (no push on publish to seekers; only admin notified `jobs.js:124-135`); Application Received / Shortlisted / Interview / Accepted / Rejected **DONE** via generic `notify()` `applications.js:125-133`; System **DONE** type exists `constants.js:39-45`, bell renders all `NotificationBell.jsx:65-80`.

---

## 2. Employer Module (counts: 55 / 15 / 3 / 20)

### Authentication (4/1/0/1) — same pattern as §1

Register `EmployerRegister.jsx:46-100`, Login `Login.jsx`, Logout `EmployerLayout.jsx:22-46`, Forgot DONE, Reset **PARTIAL** (no route → ADR-002), Verification DONE (`EmployerRegister.jsx:102-140` + `EmployerStatus.jsx:30-51` tracker).

### Dashboard (3/4/0/3)

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Total Job Posts | DONE | `employer/Dashboard.jsx:46` `Total Jobs` | — |
| Active Jobs | DONE | `Dashboard.jsx:38,45` `published` filter | — |
| Pending Jobs | MISSING | No pending concept anymore (`migration.sql:403-410` flushes pending→published) | By design → ADR-000 |
| Approved Jobs | MISSING | Same | → ADR-000 |
| Closed Jobs | PARTIAL | Computed nowhere on dashboard; only in `JobPosts.jsx:321` stats | — |
| Expired Jobs | PARTIAL | Deadline check only in `JobPosts.jsx:422-425` | Not on dashboard |
| Total Applicants | DONE | `Dashboard.jsx:47` | — |
| Shortlisted Applicants | MISSING | No shortlist action exists | → ADR-003 |
| Accreditation Status | PARTIAL | Shown on `CompanyProfile.jsx:127-132`, gating `JobPosts.jsx:446-465` — not on dashboard | — |
| Notifications | DONE | `EmployerLayout.jsx:65,100` bell | New-applicant push `applications.js:50-63` |

### Company Profile (10/0/0/2)

Company Name/Business Info/Address/Authorized+Contact Person/Email/Phone/Industry/Description all DONE `CompanyProfile.jsx:28-50,148-222,232-314`. **Company Logo MISSING**: `logo_path` col (`migration.sql:90`) selected `jobs.js:7` but zero upload/preview UI → ADR-006. Contact Person vs Authorized Person conflated into one rep block — acceptable.

### Accreditation & Requirements (13/2/0/1)

Application/Upload/View/Doc Status/Remarks/Resubmit (Replace `EmployerAccreditation.jsx:187-189`)/History-ordered list all DONE `EmployerAccreditation.jsx:19-100,156-203` + `documents.js:25-44,65-73`. Missing Documents **PARTIAL** (inferred as "Not uploaded" `176-178`, no explicit missing-flag flow; `missing` status in enum never set by UI). Accreditation History **PARTIAL** (only `latest` used `61-62`; full list fetched but not rendered). All 9 DOC_TYPES DONE `constants.js:27-37` rendered `168-202`.

### Job Management & Details (17/4/0/4)

Create/Save Draft/Edit/View modal/Duplicate/Close/Reopen/Archive DONE `JobPosts.jsx:137-313` + `jobs.js:62-144`. Submit for Approval **MISSING** (deleted; `migration.sql:403-406` drops `job_approval_gate`; publish is direct) → ADR-000. View PESO Remarks DONE (rejected banner `730-737`). Title/Description/Vacancies/Salary/Employment Type/Location/Benefits/Deadline/Instructions DONE in form `908-1203`. Qualifications **PARTIAL** (free-text `requirements`), Education/Experience/Skills **PARTIAL** (folded into same textarea; `tags` in `initialForm:47` but no tag picker). Benefits DONE.

### Applicant Management (9/1/1/4)

View/Search/Filter DONE `employer/Applicants.jsx:100-104,135-143`; View Profile DONE `198-256`; View Resume **PARTIAL** — the employer applicant list no longer opens a resume link itself (the blob-URL row action was removed in the Phase 6 cleanup; the seeker Profile page keeps its own View/Download, ADR-004); Shortlist **MISSING** → ADR-003 (Under Review **is** wired, `:167,294`); Reject/Interview/Accept/Update Status DONE `37-61,182-196`; Internal Notes **DONE** → ADR-007 (`:440-444` "Internal Notes" → `extra.employerNotes`); Interview Instructions DONE; Application History **DONE** on the seeker page; `listApplicationHistory` is gone from `services/applications.js` (dead-code pass).

### Notifications (4/1/0/2)

Accreditation Approved/Rejected DONE `documents.js:149-159`; Missing Documents **PARTIAL** (document rejected notify `84-92`, no dedicated missing-docs push); Job Approved/Rejected **MISSING** (no approval flow → ADR-000); New Applicant DONE `applications.js:50-63`.

---

## 3. PESO Super Admin (counts: 28 / 20 / 6 / 44)

### Dashboard (5/2/0/5)

DONE: Total Job Seekers / Total Employers / Pending Accred / Total Applications / Job Posts — `superadmin/Dashboard.jsx:26-33` via `getStats()` `admin.js:6-25`. PARTIAL: Accredited vs Pending Employers (only pending count). MISSING: Active Vacancies, Pending Job Approvals (→ ADR-000), Shortlisted/Accepted/Placed Applicants, Employment Statistics (Reports has placed count only).

### Employer Management (4/2/0/3)

All/Pending via `Accreditation.jsx:142,204-258` DONE; Accredited/Rejected **PARTIAL** (badges `292-308`, no filter tabs); Employer Details + Company Profile DONE (modal `DetailModal:18-115`); Employer Activity **MISSING**; Job Posts per employer **MISSING**; Applicants per employer **MISSING**.

### Employer Verification (7/1/0/1)

Queue/Review/View/Verify/Approve/Reject/Remarks/History-order DONE `Accreditation.jsx:40-43,96-98,145-166,218-256`. Request Additional Documents **MISSING** (no `resubmission` action in admin UI). Revoke/Reinstate + Suspend/Activate extra DONE `175-189,168-173`.

### Job Vacancy Management (6/3/0/6)

All/Published/Closed/Expired/DONE `superadmin/JobPosts.jsx:14-46,80-125`. PARTIAL: Pending/Approved/Rejected labels `48-51` but unreachable (DB migrates them away). MISSING by design: Review/Approve/Reject/Return-for-Revision/Publish/Unpublish → ADR-000; Edit Job MISSING (no admin edit UI).

### Applicant Management (5/3/1/5)

All Seekers + Search + Filter DONE `Employees.jsx:7-56`; Referral History DONE `299-353`; Placement Monitoring DONE (grouped by company `194-295`, via `listAllEmployees()` `admin.js:116-129`). PARTIAL: View Profile (name/email only), Barangay + Employment Status + Job Preferences columns omitted. MISSING: View Resume (admin), per-seeker Application History.

### Application Monitoring (0/4/4/1)

No dedicated page, but no longer dead: `listAllApplications()` (`services/admin.js:35`) is now consumed by `super-admin/Reports.jsx:31` for the applicants report → PARTIAL → ADR-010. By-Employer/By-Job/By-Status aggregates visible inside Reports → PARTIAL. (The old `super-admin/Employees.jsx` page was deleted in the Phase 6 dead-code pass — it had no route and no nav entry.)

### User Management (6/0/0/3)

Employee/Employer/Admin lists DONE `super-admin/UserManagement.jsx:18-26,51` — **role/search/status are filtered server-side** (`GET /admin/users` accepts all three; the Phase 6 F-04 client-side filter over a single 25-row page is gone). Activate/Deactivate/Suspend DONE `34-46,152-157`. Reset Password **MISSING** (self-service only). Custom-role tagging DONE via `POST /admin/users/:id/custom-role`; role *table* moves DONE via `POST /admin/users/:id/role` (ADR-027); direct `PATCH role` remains 400 by design (CUT list).

### System Settings (2/0/0/8)

DONE: Employment Types, Education Levels (`Settings.jsx:6-66`, seed `migration.sql:960-973`). MISSING: Job Categories, Skills, Barangays, Application Status, Accreditation Status, Vacancy Status, Notification Settings — CUT unless filtering measurably fails.

---

## 4. Reports & Analytics (counts: 8 / 6 / 0 / 7)

Applicant / Vacancy / Placement / Employer / Barangay-Employment reports DONE (`Reports.jsx:38-80,243-288` + CSV `82-88`); Print DONE (`Reports.jsx:132` `window.print()`). Monthly PESO Report MISSING; time-series stats PARTIAL; Charts MISSING; PDF/Excel export MISSING (CSV only) → ADR-009.

## 5. Notification System (counts: 8 / 2 / 1 / 4)

Employee Application Updates DONE (`applications.js:125-133`); New Relevant Jobs MISSING → ADR-012. Employer Accreditation Updates DONE; Missing-Docs push PARTIAL; Job Approval MISSING → ADR-000; New Applicants DONE. Admin pushes PARTIAL/DONE via `notifyAdmins` RPC (`notifications.js:24-29`); Job-Awaiting-Approval obsolete → ADR-000.

## 6. Search & Filtering (counts: 10 / 5 / 0 / 3)

Seeker-side all DONE (`Jobs.jsx:54-115` + `jobs.js:9-36`). Employer: Name DONE, Skills/Education/Barangay/Experience MISSING → ADR-011. Admin: PARTIAL across entities (name/status filters only).

## 8. Security & Audit (counts: 12 / 2 / 0 / 3)

RBAC / Secure Login / Hashing (Supabase Auth) / Private storage + RLS / File validation / Audit + Login history DONE. Session Mgmt PARTIAL (`persistSession:false` + AFK timer; no server session table). HTTPS/TLS, DB/File Backup MISSING — deploy-layer, CUT.

## 9. Core Database Entities (counts: 13 / 3 / 0 / 4)

DONE: employers, employer_documents, employer_accreditations (+status denormalized on employers table), job_vacancies (+history), job_applications (+history, +`referred_by`), resumes, education, work_experience, notifications, audit_logs. PARTIAL: users (`auth.users` + 3 role tables, no `public.users`), employees (`job_seekers` + derived `employment_history`). MISSING: skills, barangays, reports tables — all three CUT by design. NOTE: `plan.md` Phase 3 `referred_by` migration is stale — column already exists (`migration.sql:495`).

---

## REVERSE + TECH DEBT

**Mock data still rendered:** none — every list comes from the Express API (`src/shared/services/*`); empty states are honest.

**Dead exports (zero page imports):** **none left** (2026-10-16). Every export named here in the 2026-10-03 pass was removed: `listByJob`, `listByCompanyIds`, `listApplicationHistory` (applications.js), `listJobHistory`, `countApplicants` (jobs.js), `unreadCount` (notifications.js), `getSession` (auth.js), `listAllEmployees` + `listReferrals` + `exportReport` (admin.js). Server-side, `userFromToken` in `server/src/auth.js` was internal-only and its `export` keyword was dropped. One dead export remains and is deliberately kept: `roleFrom` (`server/src/auth.js:35`) — same shape, same reasoning, but touching it was outside the approved footprint.

**Direct Supabase calls bypassing `src/services/`:** **resolved (2026-10-16)** — the browser no longer talks to Supabase for data at all (ADR-020 is fully landed). A service module now exists for the seeker profile children (`src/shared/services/seekers.js`: `listEducation`/`addEducation`/`removeEducation`, `listExperience`/`addExperience`/`removeExperience`, `listEmployment`, plus the employer-facing `listSeekerEducation`/`listSeekerExperience`). The remaining direct Supabase use is `supabase.auth.*` (sign-in, session, password) and file uploads through `src/shared/services/documents.js` — auth-only, which is exactly ADR-020's line.

**Enum mismatches:** (1) `ACCREDITATION_STATUSES` lacks `'revoked'` → ADR-001. (2) `JOB_STATUSES` keeps dead `pending/approved` — still true: the employer PATCH/POST `/status` allow-list is `draft|published|closed|archived` while the super-admin one keeps the full enum, so `pending/approved/rejected` are reachable only through admin routes. (3) `APPLICATION_STATUSES` `Applied`/`Terminated` added via fragile `ALTER … ADD VALUE IF NOT EXISTS`. (4) `DOC_TYPES` strings vs free-text `doc_type` col — exact-string match risk. (5) `NOTIFICATION_TYPES.SYSTEM` rarely emitted.

**Other:** `Reports.jsx:194` references a "Mark as Placed" employer button that doesn't exist (only Accept/Terminate); `JobSeekerRegister.jsx:16` bad route → ADR-001.

---

## Session close-out status (2026-10-16)

Re-verified against the working tree on 2026-10-16. Each row cites the file:line that proves it.

### Closed

| Item | Evidence | Notes |
|---|---|---|
| ADR-002 — reset-password completion | `App.jsx:66` route, `auth/ResetPassword.jsx` | Round-trip works |
| ADR-004 — seeker resume View/Download | `job-seeker/Profile.jsx:35-36` | API streams the file; blob URL |
| ADR-005 — job detail fields | `JobDetail.jsx:135` vacancies, `:139` deadline, `:187-191` tags | Deadline also gates Apply |
| ADR-007 — employer internal notes | `employer/Applicants.jsx:440-444` → `:92` `extra.employerNotes` | Rendered on seeker side |
| ADR-003 — "Under Review" | `employer/Applicants.jsx:167,218,294` | Half-closed: "Shortlist" is still absent |
| F-01 — "Open vacancies" hardwired to 0 | `super-admin/Reports.jsx:145` `job.status === "published"` | — |
| F-02 — "Employers posting" hardwired to 0 | `super-admin/Reports.jsx:146` `job.company_id` (`job_vacancies` has no `employer_id`) | — |
| F-03 — audit-log user filter truncated to 25 | `super-admin/Logs.jsx:159` `listUsers({ pageSize: 500 })`, `:88` search-keyed | Server max is 500 |
| F-04 — filters over the current page only | `super-admin/UserManagement.jsx:42-44,48-49,51` sends role/search (search debounced); `GET /admin/users` also accepts `status` — the page has no status filter control | Employer `Employees.jsx` keeps a client filter over its own company's rows |
| Dead `export` on `userFromToken` | `server/src/auth.js:43` | Keyword only; function and all 4 call sites intact |
| Scratch artifacts | `dbcheck.cjs`, `test-final.txt`, `new_landing_page/` deleted | All three were untracked (`git ls-files` → empty); 1.34 KB + 3.5 KB + 1.49 MB removed |
| API contract drift | `docs/arch/rework/02-api-contract.md` | See its "Reconciliation pass (2026-10-16)" section for the change list; second-pass corrections at the end of that section |
| F-05 — 4 report types dropped with no decision on record | `server/src/routes/reports.js` keeps all 7 types server-side; `02-api-contract.md` records the browser-CSV client path and the export as a documented deliverable | Deletion recorded as a decision (not an ADR) |
| F-14 — `attachPrincipal` runs on every `/api` request | `app.js:61-66` rationale comment; `tokenCache.js` (ADR-028) bounds the added cost | Accepted by design — the limiter keys on the principal |
| Supabase token cache (Phase 4 F2) | `server/src/tokenCache.js` + `auth.js:43-49`; ADR-028 | 60 s TTL, positives only; revocation tradeoff in the contract |
| Pagination envelope (Phase 1's top API gap) | `util.js:52` `pageParams`; five admin lists + `employers/:employerId/jobs`; ADR-029 | `{ data, total, page, pageSize }`; four reads left unbounded on purpose |
| F-06 — failed PATCH reported as success | `src/shared/services/auth.js:49-50`, `50` guards the confirm re-read with `!refused && Object.keys(patch).length` | `refused` = 4xx (400 "Nothing to update", 403, 409) — the server refused *before* writing, so a matching re-read can no longer mask it. The re-read still runs for a lost response (5xx / unreachable). `auth.test.js` covers empty patch, 409 + matching re-read, and the 5xx-confirm path |
| F-07 — 500 instead of 400 on NOT NULL / CHECK columns | `server/src/routes/jobs.js:255-260`; `server/src/routes/admin.js:601-606` — `vacancies must be a whole number` | Chose 400 over preserving the old value: `'' → null` cannot express "clear" for `vacancies int not null` (`schema.sql:190`), so it is a bad request, not a null write. `work_arrangement: ''` already 400s (it coerces to `null`, which is not in the allow-list). Covered by `jobs.crud.test.js` and `admin.jobs.patch.test.js` |
| F-09 — double-encoded UTF-8 mojibake | `server/src/routes/jobs.js:37,54,55,95,101,160,195,223,337`; `auth.provision.test.js:28`; `api-rate-limit.test.js:15`; `notifications.routes.test.js:76,84` | Byte-level re-save (`C3 A2 …9D` → `—`, `C3 A2 …99` → `→`), line counts unchanged, zero logic touched. No other file in the tree carries the pattern |
| F-13 — dead `companyPhone` in the signup payload | `src/features/auth/EmployerRegister.jsx` (line removed) | `signUp`'s `meta` never read `extra.companyPhone` and no such column exists; no other code referenced it. `contactNumber` input and its validation stay |

### Still open (carried forward, now recorded as ADRs)

- **ADR-027** — status-aware role resolution: **shipped and signed off**
  (`auth.js:17-27`, `admin.js:672-695`). Carried forward as a do-not-revert warning,
  not as work: reverting to a plain `delete` silently destroys a user's job postings,
  applications, and applicant PII.
- **ADR-024/025/026** (new records) — invite flow, thin shared helpers, admin-router decomposition (still not done: `routes/admin.js` is one 697-line file and `/notifications/*` still lives in it).
- **Unbounded reads:** `GET /admin/employees`, `GET /admin/referrals`, `GET /applications/job/:jobId`, `GET /applications/company/:companyId`.
- **"Shortlist" application status** — rendered and counted, but no employer action sets it.
- **Live-Postgres verification** of `resolveRole` / the `/admin/users` `distinct on` ordering (no DB in this environment; `not null default 'active'` closes the NULL-sort hole on paper only).
- **Migrations 007–009** may not be applied to any environment; without them the retention purge still cascades through `employment_history` and the pending-unique index is missing.
