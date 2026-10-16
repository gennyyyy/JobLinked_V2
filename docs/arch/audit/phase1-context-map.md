# Phase 1 — Codebase Context Map

> JobLinked · PESO Santa Maria Job-Matching Platform  
> Generated: 2026-10-15

---

## 1. File Inventory

### 1.1 Server (`server/src/`)

| File | Lines | Purpose | Key Imports |
|------|-------|---------|-------------|
| `index.js` | 50 | Express app bootstrap, middleware wiring, error handler | express, cors, all route modules, db pool |
| `auth.js` | 81 | Supabase JWT validation, `resolveRole()`, `auth`/`optionalAuth`/`tokenAuth`/`requireRole` middleware | supabase-js, pg pool, util |
| `db.js` | 7 | PostgreSQL pool singleton, DATE parser | pg |
| `env.js` | 6 | Required-env guard (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) | — |
| `util.js` | 52 | `ah()` async wrapper, `err()` error shape, `audit()`, `notifyUser()`, `notifyAdmins()`, `buildFullName()` | pg pool |
| `upload.js` | 48 | Multer disk storage, file filter (PDF/DOC/DOCX/PNG/JPG), `uploadSingle()` middleware, `relPath()` | multer, fs, path, crypto |
| `middleware/rateLimit.js` | 36 | `authLimiter` (100/15min), `uploadLimiter` (50/15min), `aiLimiter` (20/15min) | express-rate-limit |
| `routes/auth.js` | 155 | `POST /auth/provision`, `POST /audit`, `GET /auth/me` | db, auth, util |
| `routes/jobs.js` | 346 | CRUD for job_vacancies, publish guard, `notifyMatchingSeekers()`, `writeStatus()` | db, auth, util |
| `routes/applications.js` | 189 | Application CRUD, status transitions, employer dashboard, seeker credential reads | db, auth, util |
| `routes/profiles.js` | 314 | Employer/seeker profile GET/PATCH, accreditations, documents, resume upload/download, file serving | db, auth, util, upload |
| `routes/admin.js` | 604 | Super-admin: stats, users, companies, jobs, applications, employees, referrals, accreditations, audit-logs, reference data, custom roles, notifications, job publish/unpublish, role moves, retention purge | db, auth, util, jobs |
| `routes/reports.js` | 101 | CSV export (applicants, vacancies, placements, seekers, employers, barangay, monthly) | db, auth, util |
| `routes/ai.js` | 78 | `POST /ai/help` — OpenRouter chat proxy for job-seeker help | auth, rateLimit, util |

### 1.2 Frontend (`src/`)

| File | Lines | Purpose | Key Imports |
|------|-------|---------|-------------|
| `main.jsx` | 13 | React root render | React, App, AuthProvider |
| `App.jsx` | 157 | Router, lazy-loaded routes, `ProtectedRoute`/`PublicRoute` wrappers | react-router-dom, AuthProvider, all pages |
| `index.css` | — | Tailwind + theme tokens | — |
| **shared/context/** | | | |
| `AuthProvider.jsx` | 75 | Session lifecycle, `onAuthStateChange`, `loadProfile()`, `logout()`, `refreshUser()` | supabase, auth service |
| **shared/hooks/** | | | |
| `useAuth.js` | 9 | `AuthContext` + `useAuth()` hook | React |
| `useAFKTimer.js` | 63 | 5-min AFK auto-logout with 4-min warning | react-router, useAuth |
| **shared/lib/** | | | |
| `api.js` | 129 | Sole HTTP client — `api.get/post/patch/del/blob()`, token refresh on 401 | supabase |
| `supabase.js` | 12 | Supabase client (anon key, no persist) | @supabase/supabase-js |
| `resumeText.js` | — | Resume text extraction for autofill | — |
| **shared/services/** | | | |
| `auth.js` | 174 | `signIn`, `signUp`, `signOut`, `provision`, `getProfile`, `updateProfile`, `changePassword`, `resetPassword` | supabase, api, audit |
| `jobs.js` | 35 | `listJobs`, `getJob`, `listEmployerJobs`, `createJob`, `updateJob`, `changeJobStatus`, `duplicateJob`, `deleteJob` | api |
| `applications.js` | 25 | `applyToJob`, `listBySeeker`, `listByCompany`, `getEmployerDashboard`, `updateApplicationStatus` | api |
| `admin.js` | 121 | All super-admin API calls (stats, users, companies, jobs, applications, roles, reports, notifications) | api |
| `notifications.js` | 27 | `listNotifications`, `markRead`, `markAllRead`, `deleteNotification` | api, notificationEvents |
| `ai.js` | 5 | `askHelp(messages)` — OpenRouter proxy | api |
| `documents.js` | 84 | File validation, `uploadResume`, `uploadDocument`, `listResumes`, `setActiveResume`, `deleteResume`, `listCompanyDocuments`, `updateDocumentStatus`, `listAccreditations`, `createAccreditation`, `updateAccreditation`, `signedUrl` | api |
| `seekers.js` | 39 | Seeker education/experience/employment CRUD + admin reads | api |
| `audit.js` | 9 | `logAudit()` — client-side audit event poster | api |
| **shared/components/** | | | |
| `ProtectedRoute.jsx` | 28 | Role-gated route; destroys wrong-role session | react-router, useAuth |
| `NotificationBell.jsx` | — | Bell icon + unread count dropdown | — |
| `NotificationsPage.jsx` | — | Full notifications list | — |
| `SeekerProfileCard.jsx` | — | Seeker card for employer view | — |
| `ChangePassword.jsx` | — | Password change form | — |
| `ConfirmationModal.jsx` | — | Reusable confirm dialog | — |
| `ErrorBoundary.jsx` | — | React error boundary | — |
| `LoadingScreen.jsx` | — | Full-page spinner | — |
| `PortalLayout.jsx` | — | Portal shell with sidebar | — |
| `SidebarAccount.jsx` | — | Account section in sidebar | — |
| `TagInput.jsx` | — | Skill/tag entry component | — |
| `TermsModal.jsx` | — | Terms & conditions modal | — |
| `Toast.jsx` | — | Toast notifications | — |
| `dashboard.jsx` | — | Shared dashboard components | — |
| **shared/utils/** | | | |
| `address.js` | — | PH address helpers (barangay/municipality lookup) | — |
| `names.js` | — | Name formatting utilities | — |
| `notificationEvents.js` | — | `NOTIFICATIONS_CHANGED` event name | — |
| `notificationLinks.js` | — | Link resolver for notification types | — |
| `phone.js` | — | PH phone validation/formatting | — |
| `resumeAutofill.js` | — | Resume-to-profile autofill logic | — |
| `titleCase.js` | — | String title-case helper | — |
| **shared/constants.js** | 134 | `ROLES`, `SANTA_MARIA_BARANGAYS`, `BULACAN_MUNICIPALITIES`, `JOB_TAGS`, `JOB_BENEFITS`, `DOC_TYPES`, `NOTIFICATION_TYPES`, `PORTALS`, etc. | — |
| **features/auth/** | | | |
| `Login.jsx` | — | Portal login (keyed by `portalKey`) | — |
| `Register.jsx` | — | Role selection → register | — |
| `JobSeekerRegister.jsx` | — | Job seeker signup form | — |
| `EmployerRegister.jsx` | — | Employer signup form | — |
| `AcceptInvite.jsx` | — | Accept admin invite → provision | — |
| `AuthCallback.jsx` | — | Supabase OAuth callback handler | — |
| `ForgotPassword.jsx` | — | Password reset request | — |
| `ResetPassword.jsx` | — | Password reset confirm | — |
| `EmployerStatus.jsx` | — | Employer accreditation status page | — |
| **features/employer/** | | | |
| `EmployerLayout.jsx` | — | Employer portal shell | — |
| `Dashboard.jsx` | — | Employer dashboard (stats + recent) | — |
| `JobPosts.jsx` | — | Job CRUD for employers | — |
| `Applicants.jsx` | — | Applicant management per job | — |
| `Employees.jsx` | — | Hired employees list | — |
| `CompanyProfile.jsx` | — | Company profile edit | — |
| `EmployerAccreditation.jsx` | — | Accreditation submission + status | — |
| **features/job-seeker/** | | | |
| `JobSeekerLayout.jsx` | — | Seeker portal shell | — |
| `Dashboard.jsx` | — | Seeker dashboard | — |
| `Jobs.jsx` | — | Job browse/search | — |
| `JobDetail.jsx` | — | Job detail + apply | — |
| `Applications.jsx` | — | My applications list | — |
| `Employment.jsx` | — | Employment history | — |
| `Profile.jsx` | — | Seeker profile edit | — |
| `AiMatchModal.jsx` | — | AI job-match modal | — |
| `HelpChat.jsx` | — | AI help chat widget | — |
| **features/public-site/** | | | |
| `Landing.jsx` | — | Public landing page | — |
| `PublicJobs.jsx` | — | Public job listings | — |
| `PublicJobDetail.jsx` | — | Public job detail | — |
| `PortalSelect.jsx` | — | Portal selection page | — |
| **features/super-admin/** | | | |
| `SuperAdminLayout.jsx` | — | Admin portal shell | — |
| `Dashboard.jsx` | — | Admin stats dashboard | — |
| `Accreditation.jsx` | — | Accreditation review | — |
| `JobPosts.jsx` | — | Admin job management | — |
| `RoleManagement.jsx` | — | Custom roles CRUD | — |
| `UserManagement.jsx` | — | User list + invite + role assign | — |
| `Settings.jsx` | — | System settings | — |
| `Broadcast.jsx` | — | System notification broadcast | — |
| `Reports.jsx` | — | Report export | — |
| `Logs.jsx` | — | Audit log viewer | — |
| `Notifications.jsx` | — | Admin notifications | — |
| `Profile.jsx` | — | Admin profile | — |
| **test/** | | | |
| `setup.js` | — | Vitest global setup (jsdom, Testing Library) | — |
| `api-helper.js` | — | Test helper for API mocking | — |

### 1.3 Database (`db/`)

| File | Purpose |
|------|---------|
| `schema.sql` | Full PostgreSQL schema (portable, no Supabase constructs) |
| `seed.sql` | Reference data seed |
| `migrations/001–008` | Incremental migrations (indexes, constraints, columns) |

---

## 2. Data Flow Map

### 2.1 Jobs — Create (Employer → API → DB)

```
EmployerJobPosts.jsx → jobs.createJob() → api.post('jobs', body)
  → POST /api/jobs (auth, requireRole('employer'))
    → canPublish() checks employers.accreditation_status = 'approved'
    → INSERT INTO job_vacancies (...) RETURNING id
    → writeStatus() → INSERT INTO job_status_history (same transaction)
    → notifyAdmins() + notifyMatchingSeekers() (best-effort)
    ← 201 { ...job, employers: { id, company_name, logo_path } }
```

### 2.2 Jobs — Read (Public → API → DB)

```
PublicJobs.jsx → jobs.listJobs(filters) → api.get('jobs', params)
  → GET /api/jobs (optionalAuth)
    → listStatusFor(): non-admin pinned to status='published'
    → SELECT j.*, e.company_name FROM job_vacancies j LEFT JOIN employers e
      WHERE status=$1 [+ search/location/skills/salary filters]
      ORDER BY ... LIMIT/OFFSET
    ← { jobs, total, page, pageSize }
```

### 2.3 Jobs — Status Transition

```
Employer/Admin → jobs.changeJobStatus(id, status) → api.post('jobs/:id/status')
  → POST /api/jobs/:id/status (auth)
    → ownOrAdmin() — super-admin or company_id = req.user.id
    → canPublish() if status='published'
    → writeStatus() — UPDATE + history INSERT in one transaction
    → notifyAdmins() + notifyMatchingSeekers() (best-effort)
    ← job object
```

### 2.4 Applications — Create (Seeker → API → DB)

```
JobDetail.jsx → applications.applyToJob(jobId, resumeId)
  → POST /api/applications (auth, requireRole('job-seeker'))
    → Check job exists + status='published'
    → Verify resume ownership (if resume_id provided)
    → INSERT INTO job_applications (job_id, seeker_id, resume_id)
      ON CONFLICT → 409 'Already applied'
    → notifyUser(employer, 'New applicant') (best-effort)
    ← 201 application row
```

### 2.5 Applications — Status Transition (Employer → API → DB)

```
Applicants.jsx → applications.updateApplicationStatus(id, status, notes)
  → POST /api/applications/:id/status (auth)
    → ownOrAdmin() — employer owns the job, or super-admin
    → UPDATE job_applications SET status, employer_notes, interview_at...
    → INSERT INTO application_status_history (same transaction)
    → notifyUser(seeker, 'Application {status}') (best-effort)
    ← updated application
  → Trigger: record_accepted_employment() auto-writes employment_history
```

### 2.6 Profiles — Update (Seeker/Employer → API → DB)

```
Profile.jsx → auth.updateProfile(userId, patch)
  → GET /api/auth/me → determine path (employers/me or seekers/me)
  → PATCH /api/employers/me OR /api/seekers/me (auth, requireRole)
    → Allowlist filter (SEEKER_ALLOW / EMPLOYER_ALLOW)
    → Lowercase + trim fields per LOWERCASE_FIELDS set
    → UPDATE table SET ... WHERE id = req.user.id
    → audit('profile.update')
    ← updated row
```

### 2.7 Notifications — Fan-out (API → DB → Client)

```
notifyUser(userId, { type, title, message, link })
  → INSERT INTO notifications (user_id, type, title, message, link)

notifyAdmins({ type, title, message, link })
  → SELECT id FROM super_admins
  → INSERT INTO notifications (...) SELECT id, ... FROM (admin ids)

Client: NotificationBell.jsx → notifications.listNotifications()
  → GET /api/notifications/mine (auth)
  → SELECT * FROM notifications WHERE user_id = req.user.id [AND is_read = false]
  ← rows (max 50, newest first)
```

### 2.8 Accreditations — Submit (Employer → API → DB)

```
EmployerAccreditation.jsx → documents.createAccreditation(companyId)
  → POST /api/accreditations (auth, requireRole('employer'))
    → INSERT INTO employer_accreditations (company_id, status='pending')
    → notifyAdmins('Accreditation awaiting review')
    ← 201 row
  → Trigger: trg_sync_accreditation_status → UPDATE employers.accreditation_status
```

### 2.9 File Upload — Resume (Seeker → API → Disk)

```
Profile.jsx → documents.uploadResume(file) → api.post('files/resumes', FormData)
  → POST /api/files/resumes (auth, requireRole('job-seeker'), uploadLimiter)
    → multer: diskStorage → uploads/resumes/<userId>/<uuid>-<safe>
    → UPDATE resumes SET is_active=false WHERE seeker_id
    → INSERT INTO resumes (seeker_id, file_path, file_name, is_active=true)
    ← { path: 'resumes/<userId>/<filename>', resume: row }
```

---

## 3. Auth Flow Map

### 3.1 Signup

```
JobSeekerRegister/EmployerRegister → auth.signUp({ email, password, role, ... })
  → supabase.auth.signUp({ email, password, options: { data: user_metadata } })
  → If session present (no email confirm): auth.provision(meta)
    → POST /api/auth/provision (tokenAuth — JWT only, no row gate)
      → role must be 'job-seeker' or 'employer'
      → super-admin requires app_metadata.role = 'super-admin'
      → INSERT INTO job_seekers / employers / super_admins (+ education for seeker)
      → audit('auth.register')
      ← { ...row, role }
  → If no session (email confirm required): first login will provision
```

### 3.2 Provision (lazy)

```
signIn() → getProfile() → GET /api/auth/me
  → If 404 or 403 'not provisioned': auth.provision(user_metadata)
  → Retry getProfile()
```

### 3.3 Login

```
Login.jsx → auth.signIn(email, password)
  → supabase.auth.signInWithPassword({ email, password })
  → getProfile(user.id) → GET /api/auth/me (tokenAuth)
    → resolveRole() → UNION ALL across super_admins/employers/job_seekers
    → If no row → 404 → provision from user_metadata → retry
    → If status !== 'active' → 403 'suspended'
    ← { ...profile, role }
  → logAudit('auth.login')
  ← { ...sessionUser, ...profile }
```

### 3.4 Token Refresh (client-side, transparent)

```
api.request() → 401 → refreshSession() → retry with fresh token → 2nd 401 → bounce
  → bounce(): supabase.auth.signOut() → window.location.href = '/portals'
```

### 3.5 Session Validation (per API request)

```
API request → auth middleware (server/src/auth.js)
  → Extract Bearer token → supa.auth.getUser(token) [Supabase JWT verify]
  → resolveRole(user.id) → DB lookup across 3 tables (precedence: super-admin → employer → job-seeker)
  → If no row → 403 'Account not provisioned'
  → If status !== 'active' → 403 'Suspended/deactivated'
  → req.user = { id, email, role, app_metadata }
```

### 3.6 Role Resolution

```
resolveRole(id):
  SELECT role, profile FROM (
    SELECT 'super-admin', to_jsonb(s), 1 FROM super_admins s WHERE id = $1
    UNION ALL
    SELECT 'employer', to_jsonb(e), 2 FROM employers e WHERE id = $1
    UNION ALL
    SELECT 'job-seeker', to_jsonb(j), 3 FROM job_seekers j WHERE id = $1
  ) ORDER BY ord LIMIT 1
```

### 3.7 Protected Route Enforcement

```
<ProtectedRoute role="employer">
  → useAuth() → { user, role, loading }
  → If loading → LoadingScreen
  → If !user → Navigate to /employer/login
  → If role !== 'employer' → logout() → Navigate to /employer/login
  → Else → render children
```

### 3.8 Logout

```
logout() → auth.signOut() → supabase.auth.signOut() → logAudit('auth.logout')
  → AuthProvider.onAuthStateChange('SIGNED_OUT') → setUser(null)
```

### 3.9 PublicRoute (ADR-021)

```
<PublicRoute> (wraps landing, jobs, register, etc.)
  → If user is signed-in → logout() → render as guest
  → Ensures sessions don't persist across portal boundaries
```

---

## 4. Service Dependency Graph

```
src/shared/lib/supabase.js  (Supabase client — anon key)
  ↑
src/shared/lib/api.js  (HTTP client — sole data path)
  ↑
src/shared/services/
  ├── auth.js      → supabase.js, api.js, audit.js
  ├── jobs.js      → api.js
  ├── applications.js → api.js
  ├── admin.js     → api.js
  ├── notifications.js → api.js, utils/notificationEvents.js
  ├── ai.js        → api.js
  ├── documents.js → api.js
  ├── seekers.js   → api.js
  └── audit.js     → api.js
```

**Server-side dependencies:**

```
server/src/db.js  (pg Pool)
  ↑
server/src/auth.js  (supabase-js + db.js)
  ↑
server/src/routes/
  ├── auth.js      → db, auth, util
  ├── jobs.js      → db, auth, util
  ├── applications.js → db, auth, util
  ├── profiles.js  → db, auth, util, upload
  ├── admin.js     → db, auth, util, jobs
  ├── reports.js   → db, auth, util
  └── ai.js        → auth, rateLimit, util
```

---

## 5. Test Coverage Map

### 5.1 Server Tests (Vitest + Supertest)

| Test File | Coverage Area |
|-----------|---------------|
| `auth.middleware.status.test.js` | Auth middleware status/active checks |
| `auth.resolveRole.test.js` | Role resolution precedence |
| `index.test.js` | Health check, 404, error handler |
| `auth.provision.test.js` | Provision endpoint basics |
| `auth.provision.role.test.js` | Provision role validation, super-admin gate |
| `jobs.create.test.js` | Job creation, validation |
| `jobs.delete.test.js` | Job deletion cascade |
| `jobs.duplicate.test.js` | Job duplication |
| `jobs.publish-guard.test.js` | Accreditation publish guard |
| `jobs.skills.test.js` | Skills filter query |
| `jobs.visibility.test.js` | Public/draft visibility |
| `applications.dashboard.test.js` | Employer dashboard stats |
| `admin.permissions.test.js` | Permission catalog |
| `admin.security.test.js` | Admin route security |
| `admin.users.invite.test.js` | User invite flow |
| `admin.users.patch.test.js` | User update, self-edit guard |
| `ai.test.js` | AI help endpoint |
| `notifications.delete.test.js` | Notification deletion |
| `profiles.accreditation-ownership.test.js` | Accreditation ownership check |
| `profiles.documents.test.js` | Document upload/review |
| `profiles.patch.test.js` | Profile patch validation |
| `reports.export.test.js` | CSV report export |

### 5.2 Frontend Tests (Vitest + Testing Library)

| Test File | Coverage Area |
|-----------|---------------|
| `AcceptInvite.test.jsx` | Invite acceptance flow |
| `EmployerRegister.test.jsx` | Employer registration form |
| `JobSeekerRegister.test.jsx` | Seeker registration form |
| `Login.test.jsx` | Login form |
| `scrollToError.test.jsx` | Form error scrolling |
| `termsGate.test.jsx` | Terms acceptance gate |
| `Applicants.accepted.test.jsx` | Accept applicant flow |
| `Applicants.interview.test.jsx` | Interview scheduling |
| `Applicants.revert.test.jsx` | Revert application status |
| `CompanyProfile.address.test.jsx` | Address fields |
| `CompanyProfile.barangay.test.jsx` | Barangay selection |
| `Dashboard.test.jsx` | Employer dashboard |
| `JobPosts.*.test.jsx` | Job form fields (benefits, delete, discard, education, experience, search) |
| `Applications.test.jsx` | Seeker applications list |
| `HelpChat.test.jsx` | AI help chat |
| `JobDetail.deadline.test.jsx` | Deadline display |
| `Jobs.metrics.test.jsx` | Job metrics display |
| `Profile.address.test.jsx` | Seeker address fields |
| `Profile.barangay.test.jsx` | Seeker barangay selection |
| `ProfileResumeAutofill.test.jsx` | Resume autofill |
| `ProfileResumeDelete.test.jsx` | Resume deletion |
| `Broadcast.test.jsx` | Admin broadcast |
| `ReportsCsv.test.jsx` | CSV report generation |
| `UserManagement.invite.test.jsx` | User invite UI |
| `ErrorBoundary.test.jsx` | Error boundary |
| `NotificationBell.test.jsx` | Notification bell |
| `NotificationsPage.test.jsx` | Notifications page |
| `ProtectedRoute.test.jsx` | Route protection |
| `SeekerProfileCard.test.jsx` | Profile card |
| `AuthProvider.auth-events.test.jsx` | Auth state events |
| `AuthAfk.test.jsx` | AFK timer |
| `api.test.js` | HTTP client (401 retry, blob) |
| `resumeText.test.js` | Resume text extraction |
| `admin.test.js` | Admin service |
| `applications.test.js` | Applications service |
| `auth.test.js` | Auth service |
| `documents.test.js` | Documents service |
| `jobs.test.js` | Jobs service |
| `notifications.test.js` | Notifications service |
| `address.test.js` | Address utils |
| `phone.test.js` | Phone utils |
| `resumeAutofill.test.js` | Resume autofill utils |
| `titleCase.test.js` | Title case utils |

### 5.3 Untested Areas

| Area | Gap |
|------|-----|
| Server: notifications routes | No direct test for `GET /notifications/mine` |
| Server: file serving | No test for `GET /files/:bucket/*` |
| Server: retention purge | `runRetentionPurge()` untested |
| Server: role move | `POST /admin/users/:id/role` untested |
| Frontend: `useAFKTimer` | Tested only via `AuthAfk.test.jsx` |
| Frontend: `ChangePassword` | No test |
| Frontend: `SidebarAccount` | No test |
| Frontend: `TagInput` | No test |
| Frontend: `TermsModal` | No test |
| Frontend: `Toast` | No test |
| Frontend: `AiMatchModal` | No test |
| Frontend: `PortalSelect` | No test |
| Frontend: `EmployerStatus` | No test |
| Frontend: `AcceptInvite` | Only basic test |
| Frontend: `ForgotPassword`/`ResetPassword` | No test |
| Frontend: `AuthCallback` | No test |

---

## 6. Configuration Surface

### 6.1 Server (`server/.env`)

| Variable | Required | Default | Used In |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | — | `db.js`, `env.js` |
| `SUPABASE_URL` | Yes | — | `auth.js`, `env.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | `auth.js`, `env.js` |
| `PORT` | No | `4000` | `index.js` |
| `UPLOAD_DIR` | No | `uploads` | `upload.js` |
| `CORS_ORIGIN` | No | `http://localhost:5173` | `index.js`, `admin.js` (invite redirect) |
| `OPENROUTER_API_KEY` | No | — | `ai.js` (503 if missing) |
| `OPENROUTER_MODEL` | No | `openai/gpt-4o-mini` | `ai.js` |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | `ai.js` |
| `RETENTION_DISABLE` | No | — | `admin.js` (`'1'` disables purge interval) |

### 6.2 Frontend (`.env`)

| Variable | Required | Default | Used In |
|----------|----------|---------|---------|
| `VITE_API_URL` | Yes (prod) | `http://localhost:4000` (dev) | `api.js` |
| `VITE_SUPABASE_URL` | Yes | — | `supabase.js` |
| `VITE_SUPABASE_ANON_KEY` | Yes | — | `supabase.js` |

### 6.3 Vite Config

| Setting | Value |
|---------|-------|
| Dev server proxy | `/api` → `http://localhost:4000` |
| Build outDir | `dist/` |

---

## 7. Architecture Invariants

1. **Supabase is auth-only** — no browser-side DB, storage, or RPC calls
2. **Single HTTP client** — all data access flows through `src/shared/lib/api.js`
3. **Server owns identity** — `user_id` comes from the JWT token, never from client params
4. **Role resolution** — single query across 3 tables with explicit precedence
5. **Best-effort side effects** — audit logs and notifications never fail the primary action
6. **Transaction boundaries** — multi-row writes (job + history, application + history, resume activation) use explicit `BEGIN/COMMIT/ROLLBACK`
7. **Trust proxy = 1** — rate limiter keys on real client IP behind one proxy hop
8. **Fail closed** — missing CORS_ORIGIN defaults to localhost; missing AI key returns 503; super-admin role requires `app_metadata`

---

## 8. Key Database Tables

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `job_seekers` | Seeker profiles | PK = Supabase auth user id |
| `employers` | Employer profiles | PK = Supabase auth user id |
| `super_admins` | Admin profiles | PK = Supabase auth user id |
| `reference_data` | Lookup values + custom roles | `custom_role_id` FK on all 3 role tables |
| `employer_accreditations` | Accreditation applications | FK → employers (CASCADE) |
| `employer_documents` | Uploaded documents | FK → employers (CASCADE), employer_accreditations (SET NULL) |
| `job_vacancies` | Job postings | FK → employers (CASCADE) |
| `job_status_history` | Job status audit trail | FK → job_vacancies (CASCADE) |
| `resumes` | Seeker resume files | FK → job_seekers (CASCADE) |
| `job_applications` | Job applications | FK → job_vacancies (CASCADE), job_seekers (CASCADE), resumes (SET NULL) |
| `application_status_history` | Application status audit trail | FK → job_applications (CASCADE) |
| `education` | Seeker education | FK → job_seekers (CASCADE) |
| `work_experience` | Seeker work experience | FK → job_seekers (CASCADE) |
| `employment_history` | Auto-written employment records | FK → job_applications (SET NULL), job_seekers (CASCADE) |
| `notifications` | In-app notifications | No FK (fan-out to 3 tables) |
| `audit_logs` | Audit trail | No FK (user_id is loose uuid) |

---

## 9. Database Triggers

| Trigger | Table | Behavior |
|---------|-------|----------|
| `record_accepted_employment` | `job_applications` | Auto-writes `employment_history` on Accepted/Placed/Terminated |
| `trg_sync_accreditation_status` | `employer_accreditations` | Syncs `employers.accreditation_status` on status change |

---

## 10. Migration History

| Migration | Purpose |
|-----------|---------|
| `001_feature_fit_indexes` | Feature-fit indexes (skills GIN, etc.) |
| `002_acid_gaps` | Unique email indexes, FK constraints |
| `003_seeker_consents` | Seeker consent columns |
| `004_remove_shortlisted` | Remove shortlisted column |
| `005_custom_roles` | `reference_data` + `custom_role_id` columns |
| `006_job_arrangement` | `work_arrangement` column |
| `007_query_indexes` | Trigram GIN indexes for ILIKE search |
| `008_constraint_gaps` | Additional constraints |
