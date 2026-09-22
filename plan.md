# JobLinked Implementation Plan

## 1. Scope and baseline

- Keep the existing React/Vite portals and role-protected routes.
- Replace demo/static stores with an API and persistent database.
- Deliver the Employee/Job Seeker, Employer, and PESO Super Admin workflows from `to_do_list.pdf`.
- Treat Facebook auto-posting as a gated integration: only approved and published jobs may be posted.

## 2. Foundation

1. Define the API contract, environment configuration, error format, and loading/empty/error states.
2. Create the core entities: `users`, `employees`, `employers`, `employer_documents`, `employer_accreditations`, `job_vacancies`, `job_applications`, `resumes`, `skills`, `education`, `work_experience`, `notifications`, `reports`, `barangays`, `audit_logs`, `facebook_integrations`, and `facebook_posts`.
3. Add relationships, status enums, timestamps, indexes for search/filtering, migrations, seed data, and database/file backups.
4. Implement secure authentication: registration, login, logout, verification, forgot/reset password, password hashing, sessions, RBAC, HTTPS/TLS, access control, file type/size validation, and secure resume/document storage.
5. Add audit logging for authentication, admin activity, status changes, document actions, data deletion, and login history.

## 3. Employee / Job Seeker portal

- Complete registration, verification, login/logout, password recovery, dashboard overview, recommended jobs, application counters, notifications, and profile completion.
- Build editable personal/contact/address/barangay/employment information, education, experience, skills, preferred position/location, and resume upload, view, replace, download, and delete.
- Support job browsing and details: keyword/title/employer/skills/location/salary/employment-type filters, sorting, qualifications, benefits, vacancies, education/experience, deadline, and instructions.
- Support applying with an existing or new resume, confirmation, history, status timeline (`Applied`, `Under Review`, `Shortlisted`, `Interview`, `Accepted`, `Rejected`), interview details, and employer instructions.
- Send relevant job, application, interview, acceptance, rejection, and system notifications.

## 4. Employer portal

- Complete employer registration, verification, login/logout, password recovery, and accreditation status.
- Build company profile: business information, address, authorized/contact persons, email, phone, industry, description, and logo.
- Implement accreditation submission and history, document upload/view/status, PESO remarks, missing-document requests, and resubmission for the listed requirements: letter of intent, company profile, business permit, DTI, job orders, PhilJobNet, Pag-IBIG, PhilHealth, and fire-safety certificate.
- Build job lifecycle: create, draft, edit, submit, view, duplicate, close, reopen, archive, and view PESO remarks.
- Capture title, description, vacancies, salary/range, employment type, location, qualifications, education, experience, skills, benefits, deadline, and instructions.
- Build applicant search/filtering, profile and resume access, shortlist, reject, interview, accept, status updates, internal notes, interview instructions, and history.
- Show dashboard totals for jobs, applicants, accreditation, and notifications; send accreditation, document, job, and applicant updates.

## 5. PESO Super Admin portal

- Build dashboard metrics: job seekers, employers, accredited/pending employers, active/pending vacancies, applications, shortlisted/accepted/placed applicants, and employment statistics.
- Add employer management: all/pending/accredited/rejected employers, details, profile, activity, jobs, and applicants.
- Add accreditation queue: review/view/verify documents, approve/reject, request additional documents, add remarks, and view history.
- Add job management: all, pending, approved, rejected, published, closed, expired; review, edit, approve, reject, return for revision, publish, unpublish, and archive.
- Add applicant/application monitoring: search/filter job seekers, profiles, resumes, education, skills, experience, barangay, employment status, preferences, application/referral history, placement monitoring, and application views by employer/job/status.
- Add user management for employee, employer, and admin accounts: activate, deactivate, suspend, reset password, and manage roles.
- Add system settings for job categories, employment types, skills, barangays, education levels, application/accreditation/vacancy statuses, and notification settings.

## 6. Reports, analytics, and search

- Add applicant, vacancy, placement, employer, barangay employment, and monthly PESO reports.
- Add employment, applicant, vacancy, placement, employer-activity, and barangay statistics with charts/graphs.
- Add PDF/Excel export and print support.
- Provide shared search/filter APIs for applicants, employers, jobs, applications, and accreditation records.

## 7. Notifications and Facebook integration

- Implement persistent in-app notifications with read/unread state and role-specific triggers.
- Add PESO Facebook Page connection/settings, connection status, test, disconnect, and enable/disable controls.
- After PESO approval and JobLinked publication, generate a preview containing job title, employer, salary, location, vacancies, qualifications, deadline, and application link.
- Publish automatically when enabled; track pending/posting/posted/failed/retry states, post history, URL, Facebook post ID, date, and error message.
- Make retries idempotent so one approved job cannot create duplicate posts.

## 8. Frontend integration

1. Add a small API client and auth/session wiring in `src/context/AuthProvider.jsx`.
2. Replace `src/utils/*Store.js` and static data reads with API calls while preserving current page-level interfaces where practical.
3. Fill gaps in existing pages/layouts before adding new routes; keep `ProtectedRoute` as the client-side UX guard, with server-side authorization as the source of truth.
4. Add accessible forms, validation messages, keyboard support, responsive tables, confirmation dialogs for destructive actions, and upload progress/error feedback.

## 9. Delivery order

1. Database, API contract, authentication, RBAC, audit, and file storage.
2. Shared jobs, profiles, applications, statuses, and notifications.
3. Employee portal end-to-end.
4. Employer accreditation and job/applicant workflows.
5. PESO verification, publishing, user management, and settings.
6. Reports, analytics, exports, and advanced filters.
7. Facebook integration, retry handling, security review, backup/restore test, and deployment.

## 10. Definition of done

- Every PDF checklist item is mapped to an implemented route, API operation, or verified system setting.
- Each role can complete its primary workflow from registration through its terminal status.
- Unauthorized roles cannot read or mutate another portal's data.
- Files are validated, access-controlled, backed up, and deletable according to retention rules.
- A job is never posted to Facebook before PESO approval and JobLinked publication.
- Reports match filtered data and exports open correctly.
- Test the critical flows, run `npm run lint`, and run `npm run build` before release.
