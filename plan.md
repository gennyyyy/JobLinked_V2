# JobLinked Implementation Plan

## 0. Establish the foundation

- Preserve current uncommitted work.
- Run `npm run lint` and `npm run build` for a baseline.
- Select the production backend/API and database stack.
- Replace the browser-only `sql.js` and `localStorage` database with a server database.
- Keep the React/Vite frontend and existing portal structure.
- Define shared enums for roles, application statuses, accreditation statuses, job statuses, notification types, and document types.
- Add API modules for authentication, users, jobs, applications, documents, reports, notifications, and Facebook posts.

The current client-side database cannot safely support password hashing, secure files, multi-user data, backups, audit logs, or Facebook credentials.

## 1. Database and API model

Implement these core entities:

- `users`
- `employees`
- `employers`
- `employer_documents`
- `employer_accreditations`
- `job_vacancies`
- `job_applications`
- `resumes`
- `skills`
- `education`
- `work_experience`
- `notifications`
- `reports`
- `barangays`
- `audit_logs`
- `facebook_integrations`
- `facebook_posts`

Add relationships and fields for account verification, password reset tokens, sessions, profiles, interviews, notes, remarks, document history, application history, job approval history, placements, soft deletion, and timestamps.

Seed barangays, employment types, education levels, skills, statuses, notification settings, and an initial admin account.

## 2. Authentication and security

Replace local-storage authentication with API-backed authentication:

- Employee registration
- Employer registration
- Login and logout
- Forgot/reset password
- Email/account verification
- Secure password hashing
- Session expiration and renewal
- Server-side role-based access control
- Account activation, deactivation, and suspension
- Admin password reset
- Secure file upload validation
- HTTPS/TLS deployment

Update `AuthProvider` and `ProtectedRoute` to consume the authenticated API session. Client-side checks remain for UX only and must not be the security boundary.

## 3. Employee/job-seeker module

Extend the existing job-seeker routes and pages with:

- Dashboard overview, recommendations, application counts, notifications, and profile completion.
- Personal, contact, address, barangay, employment, education, experience, skills, preferred position, and preferred location data.
- Resume upload, view, download, replace, delete, and management.
- Job browsing, keyword/title/employer/skill search, location/salary/type/employer filters, and sorting.
- Full job details, qualifications, benefits, vacancies, requirements, deadlines, and instructions.
- Application submission with resume selection or upload.
- Confirmation, history, status tracking, interview details, and employer instructions.
- Statuses: Applied, Under Review, Shortlisted, Interview, Accepted, and Rejected.
- Relevant-job, application, interview, acceptance, rejection, and system notifications.

## 4. Employer module

### Company profile

Implement company name, business information, address, authorized/contact persons, email, phone, industry classification, description, and logo.

### Accreditation

Implement accreditation applications, document upload/view/status, PESO remarks, missing documents, resubmission, and accreditation history for:

- Letter of intent
- Company profile
- Business permit
- DTI certificate
- Job orders
- PhilJobNet accreditation
- Pag-IBIG registration
- PhilHealth registration
- Fire safety inspection certificate

### Job management

Implement create, draft, edit, submit, view, duplicate, close, reopen, archive, and PESO remarks. Include all job details, requirements, deadline, and application instructions.

### Applicant management

Implement applicant lists, search/filtering, profiles, resume view/download, shortlist, reject, interview, accept, status history, internal notes, and interview instructions.

Add employer notifications for accreditation, documents, jobs, and applicants.

## 5. PESO super-admin module

### Dashboard

Add metrics for job seekers, employers, accreditation, vacancies, approvals, applications, shortlisted/accepted/placed applicants, and employment statistics.

### Employer management

Implement all, pending, accredited, and rejected employer lists, employer details, company profiles, activity, job posts, and applicants.

### Employer verification

Implement accreditation queues, document review, document verification, approve/reject, requests for additional documents, remarks, and accreditation history.

### Vacancy management

Implement all, pending, approved, rejected, published, closed, and expired job views, plus review, edit, approve, reject, return for revision, publish, unpublish, and archive actions.

### Applicant and application monitoring

Implement applicant search/filtering, profiles, resumes, education, skills, experience, barangay, employment status, preferences, application history, referral history, placement monitoring, and application views by employer/job/status.

### User management and settings

Implement employee, employer, and admin accounts; activation, deactivation, suspension, password reset, role management, job categories, employment types, skills, barangays, education levels, application statuses, accreditation statuses, vacancy statuses, and notification settings.

## 6. Notification system

Create one database-backed notification service for all portals.

Support:

- Employee application updates and relevant jobs.
- Employer accreditation updates, missing documents, job approvals, and new applicants.
- Admin new employers, accreditation requests, new documents, pending job approvals, and system alerts.

Add read/unread state, timestamps, preferences, and optional email delivery. Keep notification creation out of individual page components.

## 7. Search, filtering, and pagination

Create shared server-side query parameters for keywords, titles, employers, skills, locations, salaries, employment types, applicant names, education, barangays, experience, statuses, and date ranges.

Use server-side filtering and pagination once real data is available. Reuse filter controls between portals where practical.

## 8. Reports and analytics

Build report endpoints and admin pages for:

- Applicant reports
- Vacancy reports
- Placement reports
- Employer reports
- Barangay employment reports
- Monthly PESO reports

Add employment, applicant, vacancy, placement, employer activity, and barangay analytics. Add PDF export, Excel export, and print-friendly reports after the underlying queries are verified.

## 9. Facebook auto-posting

Implement after job approval and publishing are stable.

### Integration

- Connect the PESO Facebook page.
- Store connection status and page settings.
- Test and disconnect the page.

### Posting

- Enable/disable auto-posting.
- Generate and preview posts.
- Publish approved jobs.
- Include the JobLinked application link.

### Tracking

Store Facebook post URL, post ID, status, posting date, errors, retry count, and history.

Support Pending, Posting, Posted, Failed, and Retry statuses.

Enforce this workflow:

```text
Employer submits job
        ↓
PESO approves job
        ↓
Job is published on JobLinked
        ↓
Facebook post is generated and published
```

Keep Facebook tokens server-side; never store them in browser storage.

## 10. Audit, backup, and retention

Audit login/logout, failed logins, account changes, accreditation decisions, document changes, job approvals, application status changes, user/role changes, Facebook actions, and exports.

Add login history, admin activity logs, database backups, file backups, retention policies, and account/data deletion workflows. Use soft deletion where historical records must remain.

## 11. Frontend integration cleanup

- Replace direct `src/data/db.js` calls with API services.
- Add loading, empty, error, and retry states.
- Refresh data after mutations.
- Add route-level access checks.
- Add missing navigation links.
- Confirm destructive actions.
- Validate forms in both UI and API layers.
- Add accessible labels, keyboard support, focus states, and useful errors.
- Keep the existing layouts and Tailwind styling unless a page lacks required usability.

## 12. Verification strategy

After each module:

- Run `npm run lint`.
- Run `npm run build`.
- Test the relevant role manually.
- Test unauthorized route access.
- Test validation and error states.
- Test file upload restrictions.
- Test status transitions.
- Test notification creation.
- Test audit-log creation.

Final acceptance must cover:

1. Employee registration → profile → resume → search → application.
2. Employer registration → accreditation → job approval → applicant handling.
3. Admin accreditation → job approval → reports → user management.
4. Notification delivery.
5. Facebook posting workflow.
6. Backup and audit behavior.
7. Security checks against client-side-only authorization.

## Recommended delivery order

1. Backend/API and database foundation.
2. Authentication and security.
3. Employee profiles, resumes, job search, and applications.
4. Employer profiles, accreditation, jobs, and applicants.
5. PESO administration and approval workflows.
6. Notifications.
7. Search, filtering, and pagination improvements.
8. Reports and analytics.
9. Audit, backups, and retention.
10. Facebook auto-posting.
11. Final frontend cleanup and end-to-end verification.

The current browser-only database is suitable for a prototype but not for the complete production checklist. Backend/API work is the first required implementation step.
