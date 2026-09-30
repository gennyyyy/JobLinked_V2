# Implementation Plan

## Phase 1 — Quick Wins (no schema changes)

| Feature | Location | Approach |
|---------|----------|----------|
| Duplicate Job | `JobPosts.jsx` + `jobs.js` | Add `duplicateJob(id)` — fetch job, strip `id`/`status`/`created_at`, insert as draft |
| Reopen Job | `JobPosts.jsx` + `jobs.js` | Add `changeJobStatus(id, 'published')` — reuse existing status flow |
| Status-based application cards | `job-seeker/Dashboard.jsx` | Query `listBySeeker`, group by status, render 4 summary cards |
| Profile Completion | `job-seeker/Profile.jsx` | Compute % from required fields (personal, contact, address, education, skills, resume) |

## Phase 2 — Job Seeker Experience

| Feature | Location | Approach |
|---------|----------|----------|
| Search by Skills | `jobs.js:listJobs` + `Jobs.jsx` | Add `skills` param; filter client-side via `job_vacancies.skills` array overlap |
| Recommended Jobs | `job-seeker/Dashboard.jsx` | Field-match algorithm: query seeker profile → match `preferred_position`/`preferred_location`/`skills` against published jobs, rank by overlap count. AI integration planned as future upgrade path |

## Phase 3 — Super Admin

| Feature | Location | Approach |
|---------|----------|----------|
| Referral History | `superadmin/Employees.jsx` | **Schema migration:** add `referred_by` column to `job_applications`. New tab/section — query applications where `referred_by` is not null |
| Placement Monitoring | `superadmin/Employees.jsx` | Query applications with status `Placed`/`Accepted`, group by employer, show placement rate |

## Phase 4 — Reports & Export

| Feature | Location | Approach |
|---------|----------|----------|
| Export CSV | `superadmin/Reports.jsx` | Client-side CSV generation, no new dependency |
| Export PDF | `superadmin/Reports.jsx` | `window.print()` with `@media print` stylesheet |
| Print Reports | `superadmin/Reports.jsx` | `window.print()` with print CSS |

## Phase 5 — Data Lifecycle

| Feature | Location | Approach |
|---------|----------|----------|
| Data Deletion | `superadmin/Settings.jsx` + Supabase | Admin-triggered purge with confirmation modal, cascading deletes |
| ~~Data Retention~~ | — | **Skipped** — deferred indefinitely |

## Dependency Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

## Schema Migration Needed

```sql
alter table job_applications add column referred_by uuid references job_seekers(id);
```
