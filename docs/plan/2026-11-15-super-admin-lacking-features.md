# Super Admin Lacking Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the nine agreed super-admin gaps without adding individual-application visibility.

**Architecture:** Extend the existing Express admin routers and `src/features/super-admin/` pages. No schema changes: `reference_data`, `job_seekers`, and the existing Supabase admin API cover every task. All admin routes keep the established shape: `auth`, `requireRole('super-admin')`, `requirePermission(...)`, `audit(...)`, JSON `{ data, total, page, pageSize }` for lists, `{ error: { code, message } }` for failures.

**Tech Stack:** Node 24, Express 4, pg 8, Supabase JS 2, React 19, Vite 8, Vitest 4, RTL, jsdom.

**Spec:** this document (no separate spec file).

## Global Constraints

- **Individual application viewing is in scope.** The existing `/super-admin/applications` page and `GET /admin/applications` route stay; no restriction work is done. New features may use aggregate counts, and named application rows are permitted where they already exist.
- **No new dependencies.** Use existing libraries and browser capabilities.
- **No schema changes.** `reference_data`, `job_seekers.skills`, `education_summary`, `experience_summary` already exist.
- **Every new server route:** `auth` + `requireRole('super-admin')` + the matching `requirePermission` key + `audit(...)`; UUID/numeric guards as the sibling routes do.
- **Every new UI action:** loading/disabled state, inline error, and an accessible label (existing design components).
- **Tests:** server route tests in `server/src/routes/*.test.js` or `server/src/__tests__/`; frontend tests in `src/features/super-admin/__tests__/`. Run `npm test`, `npm --prefix server test`, `npm run lint`.
- **Existing individual-application surfaces stay:** `Applications.jsx`, `Employment.jsx`, `listAllApplications`, `listEmployees`. Do not restrict them in this plan.

## Review Focus

- Seeker filters must return the **same paginated contract** as the unfiltered list; a filter must never bypass the `status`/`search` terms.
- Employer job counts must include every status and not silently include other companies' jobs.
- Reset-password and force-sign-out must not reveal whether an email exists, must be audit-logged, and must not let a tagged admin act beyond its permission bundle.
- Reference-data mutations must refuse `custom_role` and must not break `Employment Types`/`Education Levels` consumers.
- Missing-document notification must fire only on the `missing` transition, not on every document update.

---

## Task 1: Admin seeker list columns

**Files:**
- Modify: `src/features/super-admin/UserManagement.jsx`
- Test: `src/features/super-admin/__tests__/UserManagement.seekerDetail.test.jsx` (extend)

**Interfaces:**
- Consumes: `GET /admin/users` already returns the full `job_seekers` row via `to_jsonb(x)` (`admin-users.js:42`), including `barangay_district`, `employment_status`, `preferred_position`.
- Produces: no API change.

- [ ] **Step 1: Write the failing test** — render a job-seeker row with `barangay_district`, `employment_status`, and `preferred_position`; assert the table shows those three values for the seeker row and does not show them for employer/admin rows.
- [ ] **Step 2: Run it** — `npm test -- src/features/super-admin/__tests__/UserManagement.seekerDetail.test.jsx`; expect failure (columns absent).
- [ ] **Step 3: Implement** — add the three columns to the seeker branch of the user table; render `—` when null. Do not add applicant/application columns.
- [ ] **Step 4: Run the test** — expect pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(super-admin): show seeker barangay, employment status, and preferred position"`.

---

## Task 2: Seeker search filters

**Files:**
- Modify: `server/src/routes/admin-users.js`
- Modify: `src/shared/services/admin.js`
- Modify: `src/features/super-admin/UserManagement.jsx`
- Test: `server/src/routes/admin.users.filters.test.js` (new), `src/features/super-admin/__tests__/UserManagement.pagination.test.jsx` (extend)

**Interfaces:**
- Consumes: `job_seekers.skills text[]`, `education_summary text`, `experience_summary text`.
- Produces: `GET /admin/users?skills=<term>&education=<term>&experience=<term>`.
  - All three are optional strings, trimmed, max 80 chars; blank is ignored.
  - `skills` matches `array_to_string(j.skills, ' ') ilike '%term%'`; `education`/`experience` match the summary columns. Applied only when the resolved table is `job_seekers`; ignored otherwise.
  - Response shape unchanged: `{ data, total, page, pageSize }`.

- [ ] **Step 1: Write the failing server test** — a mocked pool asserts the generated params include the three terms and that a non-seeker `role` filter ignores them.
- [ ] **Step 2: Run it** — expect failure (params absent).
- [ ] **Step 3: Implement** — extend the `where` builder in `GET /admin/users`; validate lengths; keep the existing `status`/`search` terms before the new ones. Add `skills`, `education`, `experience` to `listUsers()`.
- [ ] **Step 4: Implement the UI** — three debounced inputs shown only when the role filter is `job-seeker`; pass them to `listUsers`.
- [ ] **Step 5: Run server + frontend tests** — expect pass.
- [ ] **Step 6: Commit** — `git commit -m "feat(super-admin): filter seekers by skills, education, and experience"`.

---

## Task 3: Employer drill-down (job counts only)

**Files:**
- Modify: `server/src/routes/admin-jobs.js`
- Modify: `src/shared/services/admin.js`
- Modify: `src/features/super-admin/Accreditation.jsx`
- Test: `server/src/routes/admin.jobs.company-filter.test.js` (new), `src/features/super-admin/__tests__/Accreditation.test.jsx` (extend)

**Interfaces:**
- Consumes: `job_vacancies.company_id`.
- Produces: `GET /admin/jobs?company_id=<uuid>&status=<status>`; `company_id` is optional, UUID-validated (400 on malformed), and narrows the existing query. Response shape unchanged.
- Produces: `listAllJobs({ companyId, status, page, pageSize })`.
- UI: the accreditation detail modal gets a **Vacancies** panel: total jobs and counts per status for that employer. No applicant rows, no seeker names.

- [ ] **Step 1: Write the failing server test** — `company_id` is added to the `where` clause and an invalid UUID returns 400; no `company_id` keeps the current behaviour.
- [ ] **Step 2: Run it** — expect failure.
- [ ] **Step 3: Implement the filter** — add `company_id` to `admin-jobs.js`; keep the existing status allow-list.
- [ ] **Step 4: Implement the detail panel** — on modal open, fetch `listAllJobs({ companyId, pageSize: 500 })`, compute counts by status, render the panel with an empty state.
- [ ] **Step 5: Run both test suites** — expect pass.
- [ ] **Step 6: Commit** — `git commit -m "feat(super-admin): show per-employer vacancy counts"`.

---

## Task 4: Reference-data management page

**Files:**
- Create: `src/features/super-admin/Settings.jsx`
- Modify: `src/shared/lib/routeLoaders.js` (`/super-admin/settings` → new module)
- Test: `src/features/super-admin/__tests__/Settings.test.jsx` (new)

**Interfaces:**
- Consumes: `GET /admin/reference/:category`, `POST /admin/reference/:category { value }`, `DELETE /admin/reference/:id` (already shipped in `admin-reference.js`).
- Produces: a Settings page with two sections:
  - Account/notification preferences (reuse `<AccountSettings />`).
  - Reference data for `employment_type` and `education_level`: list, add, remove; duplicate → 409 message; remove → confirm.
- **Scope decision:** only these two categories are editable. `custom_role` stays on the Roles page. Skills/barangays/application statuses are code constants, not reference rows; they are not added.
- No schema or API change.

- [ ] **Step 1: Write the failing test** — renders both categories, adds a value (mock 201), removes a value (mock 200), and shows the 409 message on duplicate.
- [ ] **Step 2: Run it** — expect failure (page does not exist).
- [ ] **Step 3: Implement** — build the page from existing `Panel`, `TextField`, `Button`, `EmptyState` components; reuse `listReferenceData`, `addReferenceData`, `removeReferenceData`.
- [ ] **Step 4: Wire the route** — point `/super-admin/settings` at the new page; keep `AccountSettings` embedded.
- [ ] **Step 5: Run tests + lint** — expect pass.
- [ ] **Step 6: Commit** — `git commit -m "feat(super-admin): manage employment types and education levels"`.

---

## Task 5: Admin-initiated password reset

**Files:**
- Modify: `server/src/routes/admin-users.js`
- Modify: `src/shared/services/admin.js`
- Modify: `src/features/super-admin/UserManagement.jsx`
- Test: `server/src/routes/admin.users.reset-password.test.js` (new), `src/features/super-admin/__tests__/UserManagement.invite.test.jsx` (extend or sibling)

**Interfaces:**
- Produces: `POST /admin/users/:id/reset-password`
  - `auth`, `requireRole('super-admin')`, `requirePermission('users.manage')`.
  - Resolves the user row with `findUserTable`; 404 when absent.
  - Sends a Supabase recovery email via `supa().auth.resetPasswordForEmail(email, { redirectTo: <CORS_ORIGIN>/reset-password })`.
  - Always returns `{ sent: true }` on success; maps Supabase rate limit to `429 RATE_LIMITED` and upstream failure to `502 UPSTREAM_ERROR`; never echoes the email or whether the address exists.
  - `audit(req.user.id, 'user.password.reset', table, id)`.
- Produces: `resetUserPassword(id)` in `src/shared/services/admin.js`.
- UI: a **Send password reset** action in the user row/detail with confirmation; disabled while sending; inline success/error.

- [ ] **Step 1: Write the failing server test** — success calls `resetPasswordForEmail` with the stored email and writes one audit entry; a Supabase rate-limit error returns 429; a missing user returns 404.
- [ ] **Step 2: Run it** — expect failure (route absent).
- [ ] **Step 3: Implement the route** — follow the invite route's error mapping; do not log the email.
- [ ] **Step 4: Implement the UI + service** — add the action and wire the states.
- [ ] **Step 5: Run server + frontend tests** — expect pass.
- [ ] **Step 6: Commit** — `git commit -m "feat(super-admin): send user password reset emails"`.

---

## Task 6: Session management (force sign-out), no impersonation

**Files:**
- Modify: `server/src/routes/admin-users.js`
- Modify: `src/shared/services/admin.js`
- Modify: `src/features/super-admin/UserManagement.jsx`
- Test: `server/src/routes/admin.users.sessions.test.js` (new)

**Interfaces:**
- Produces: `POST /admin/users/:id/sign-out`
  - `auth`, `requireRole('super-admin')`, `requirePermission('users.manage')`.
  - Calls the GoTrue admin endpoint `POST {SUPABASE_URL}/auth/v1/admin/users/{id}/logout` with the service-role key and `apikey` header; 404 when the user row is absent.
  - Returns `{ signedOut: true }`; upstream failure → `502 UPSTREAM_ERROR`.
  - `audit(req.user.id, 'user.sessions.revoke', table, id)`.
- Produces: `forceSignOut(id)` in the admin service.
- UI: **Sign out all sessions** action with confirmation; inline success/error.
- **Decision:** impersonation is explicitly rejected. No impersonation route, UI, or token exchange is added. Record the reason in the ADR backlog: an admin acting as a user defeats the audit trail and conflicts with the privacy rule.

- [ ] **Step 1: Write the failing server test** — success calls the logout endpoint; upstream failure → 502; audit entry written; no impersonation route exists (404 on `POST /admin/users/:id/impersonate`).
- [ ] **Step 2: Run it** — expect failure.
- [ ] **Step 3: Implement the route** — reuse the existing service-role client/env; never return the service key.
- [ ] **Step 4: Implement the UI + service** — add the action with confirmation.
- [ ] **Step 5: Run tests** — expect pass.
- [ ] **Step 6: Commit** — `git commit -m "feat(super-admin): force sign-out and explicitly reject impersonation"`.

---

## Task 7: Missing-document notification

**Files:**
- Modify: `server/src/routes/profiles.js:294`
- Test: `server/src/routes/profiles.documents.test.js` (extend) or `server/src/__tests__/notifications.routes.test.js`

**Interfaces:**
- Consumes: `PATCH /documents/:id { status: 'missing', remarks }` already accepts `missing` (`profiles.js:286`) but only notifies on `verified`/`rejected`.
- Produces: the same route now sends one `document` notification titled `Document missing` when the transition is to `missing`, with the PESO remarks and `/employer/accreditation` link.

- [ ] **Step 1: Write the failing test** — PATCH to `missing` calls `notifyUser` once; PATCH to `verified` still does; no double notification.
- [ ] **Step 2: Run it** — expect failure.
- [ ] **Step 3: Implement** — include `missing` in the notify condition; keep the single message shape.
- [ ] **Step 4: Run the server tests** — expect pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(accreditation): notify employers when a document is missing"`.

---

## Task 8: Excel-friendly exports

**Files:**
- Modify: `src/features/super-admin/Reports.jsx` (`exportReport`)
- Modify: `src/features/super-admin/Applications.jsx` (`exportCsv`) — CSV encoding only; do not change what it lists.
- Test: `src/features/super-admin/__tests__/ReportsCsv.test.jsx` (extend)

**Interfaces:**
- Consumes: existing CSV strings.
- Produces: CSV downloads prefixed with UTF-8 BOM (`\uFEFF`) so Excel opens accents correctly; keep `.csv`. PDF remains browser print-to-PDF (already present). No xlsx dependency.

- [ ] **Step 1: Write the failing test** — the Blob/text starts with `\uFEFF`; the header row is unchanged.
- [ ] **Step 2: Run it** — expect failure.
- [ ] **Step 3: Implement** — prepend the BOM in both helpers.
- [ ] **Step 4: Run tests** — expect pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(super-admin): make CSV exports Excel-friendly"`.

---

## Task 9: Monthly PESO statutory report — blocked

**Files:** none (blocked on an external input).

**Interfaces:** none until the official template is supplied.

- [ ] **Step 1:** Obtain the official Monthly PESO Report template (field list, headings, signatories) from PESO/LGU.
- [ ] **Step 2:** Only then write a spec: input mapping to `job_seekers`, `job_vacancies`, `job_applications`, `employment_history`; output format (print/CSV); approval path.
- [ ] **Step 3:** Add the implementation plan after the spec is signed off.

**Do not** invent a template or use the aggregate Reports page as a substitute.

---

## Decisions to confirm before execution

1. **Reference data scope** — edit only `employment_type` and `education_level`? (Recommended. Skills/barangays/statuses are code constants; adding them to `reference_data` would require app changes for no benefit.)
2. **Export format** — Excel-friendly CSV + print-to-PDF, no xlsx dependency? (Recommended. Reopens ADR-009 only in the CSV-encoding sense.)
3. **Session management** — force sign-out only; impersonation rejected? (Recommended for audit/privacy.)
4. **Individual application viewing** — stays in scope and already exists (`/super-admin/applications`, `GET /admin/applications`). No task; no restriction. Confirmed by the owner on 2026-11-15.
5. **Monthly PESO report** — remains blocked until the template is supplied. Confirm.
