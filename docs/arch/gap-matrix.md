# GAP MATRIX — `to_do.md` spec vs real code (`src/`, `supabase/migration.sql`)

Legend: **DONE** = wired UI + service + schema. **PARTIAL** = exists but incomplete/different. **STUB** = code/schema exists, never exercised end-to-end. **MISSING** = no evidence.
Counts = DONE / PARTIAL / STUB / MISSING per module.

---

## 1. Employee / Job Seeker (counts: 62 / 18 / 5 / 17)

### Authentication & Account (4/1/0/1)

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Register | DONE | `src/pages/JobSeekerRegister.jsx:41-84` → `auth.js:43-88`; trigger `migration.sql:805-890` | Full form + `emailConfirmationRequired` branch |
| Login | DONE | `src/pages/Login.jsx:20-32` → `auth.js:30-41` | Role-based redirect via `PORTALS` |
| Logout | DONE | `layouts/JobSeekerLayout.jsx:18-28` → `auth.js:90-95` | + AFK logout `hooks/useAFKTimer.js:29-31` |
| Forgot Password | DONE | `src/pages/ForgotPassword.jsx:12-29` → `auth.js:109-114` | Sends reset link |
| Reset Password | PARTIAL | `auth.js:109-114` sets `redirectTo: origin/`; `App.jsx:39-111` has **no** `/reset-password` route | Request works, completion lands on `/` with no handler → ADR-002 |
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
| View Resume | MISSING | Seeker UI has no View/open; only employer `Applicants.jsx:81-89` + admin modal open via `signedUrl` | `signedUrl()` exists `documents.js:164-169` but seeker never calls it → ADR-004 |
| Download Resume | MISSING | No `download`/`createObjectURL` for resume anywhere; only `window.open(url)` for view | → ADR-004 |
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
| Number of Vacancies | MISSING | `vacancies` col (`migration.sql:390`) never rendered in `JobDetail.jsx`/`PublicJobDetail.jsx` | Only shown in employer table `JobPosts.jsx:750-758` → ADR-005 |
| Education Requirements | PARTIAL | Folded into free-text `requirements` | No separate field |
| Experience Requirements | PARTIAL | Same | — |
| Skills (tags) | MISSING | `tags` col (`migration.sql:393`) never rendered on detail pages | `JOB_TAGS` `constants.js:9-17` unused in seeker UI → ADR-005 |
| Application Deadline | MISSING | `deadline` col exists but `JobDetail.jsx`/`PublicJobDetail.jsx` omit it | Employer form has it `JobPosts.jsx:1097-1107` → ADR-005 |
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
| Status: Under Review | STUB | In enum `constants.js:19`, counted `Applicants.jsx:97` but **no button/flow ever sets it** | Dead status → ADR-003 |
| Status: Shortlisted | STUB | Displayed `Dashboard.jsx:68`, `Applications.jsx:110` but **no employer UI sets it** | → ADR-003 |
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

View/Search/Filter DONE `Applicants.jsx:100-104,135-143`; View Profile DONE `198-256`; View Resume DONE `81-89,222-226`; Download Resume **MISSING** (view-only `window.open`); Shortlist **MISSING** → ADR-003; Reject/Interview/Accept/Update Status DONE `37-61,182-196`; Internal Notes **MISSING** → ADR-007; Interview Instructions DONE; Application History **STUB** (`listApplicationHistory` `applications.js:137-145` exported, zero page imports).

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

No dedicated page. `listAllApplications()` `admin.js:93-106` exists but **no page imports it** → STUB → ADR-010. By-Employer/By-Job/By-Status aggregates visible only inside Reports → PARTIAL.

### User Management (6/0/0/3)

Employee/Employer/Admin lists DONE `UserManagement.jsx:18-26`; Activate/Deactivate/Suspend DONE `34-46,152-157`. Reset Password **MISSING** (self-service only). Role Management **MISSING** as mutation — `updateUser` throws on role change `admin.js:44`, by design (CUT list).

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

DONE: employers, employer_documents, employer_accreditations, job_vacancies (+history), job_applications (+history, +`referred_by`), resumes, education, work_experience, notifications, audit_logs. PARTIAL: users (`auth.users` + 3 role tables, no `public.users`), employees (`job_seekers` + derived `employment_history`). MISSING: skills, barangays, reports tables — all three CUT by design. NOTE: `plan.md` Phase 3 `referred_by` migration is stale — column already exists (`migration.sql:495`).

---

## REVERSE + TECH DEBT

**Mock data still rendered:** none — all lists come from Supabase; empty states are honest.

**Dead exports (zero page imports):** `listByJob`, `listByCompanyIds`, `listApplicationHistory` (applications.js); `listJobHistory`, `countApplicants` (jobs.js); `unreadCount` (notifications.js — bell counts client-side); `getSession` (auth.js — session deliberately non-persistent). Candidates for deletion in a cleanup pass; not scheduled.

**Enum mismatches:** (1) `ACCREDITATION_STATUSES` lacks `'revoked'` → ADR-001. (2) `JOB_STATUSES` keeps dead `pending/approved`. (3) `APPLICATION_STATUSES` `Applied`/`Terminated` added via fragile `ALTER … ADD VALUE IF NOT EXISTS`. (4) `DOC_TYPES` strings vs free-text `doc_type` col — exact-string match risk. (5) `NOTIFICATION_TYPES.SYSTEM` rarely emitted.

**Direct Supabase calls bypassing `src/services/`:** `job-seeker/Profile.jsx:109-111,169,188,199,219` (education/work_exp/employment_history CRUD — no service layer exists for these tables), `job-seeker/Employment.jsx:15`, `employer/Applicants.jsx:74-75`, `employer/CompanyProfile.jsx:23,86-90`, `employer/JobPosts.jsx:86`, `employer/EmployerAccreditation.jsx:21`, `EmployerStatus.jsx:40-44`, `employer/Dashboard.jsx:21`. Mostly read-only lookups; education/experience writes have no service home — future cleanup item, not scheduled.

**Other:** `Reports.jsx:194` references a "Mark as Placed" employer button that doesn't exist (only Accept/Terminate); `JobSeekerRegister.jsx:16` bad route → ADR-001.
