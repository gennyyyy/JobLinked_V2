# Demo data reset for presentation day — WIP (parked)

**Status:** Parked 2026-11-28. Team is deciding whether to drop the résumé feature; that decision gates final plan sign-off. Brief below is confirmed except for the open decision.

## Confirmed decisions

- **One script:** `server/scripts/seed-demo.mjs` — purge then seed in one run, idempotent (re-run = purge + fresh seed).
- **Keep-set (purge survivors):**
  1. Super-admin accounts (rows in `public.super_admins` + their `auth.user`).
  2. Verified real accounts: `auth."user".emailVerified = true` with an email **not** on the demo domain `@demo.joblinked.test`.
  3. `jarvit@email.com` — special test account, never delete.
- **Purge clears:** employers, job_seekers, job_vacancies (+ status history, prohibited flags), applications (+ history, employment_history), résumé rows, notifications, audit logs, profile_images, user_preferences, sessions/credentials of deleted users (Better Auth cascade), `pending_signups`, `admin_invites`. Upload files on disk stay (orphaned, invisible).
- **Scale (half):** per barangay (24 total): 5 employers × 10 job posts = 50 published posts/barangay → **120 employers, 1,200 posts**; 50 jobseekers → **1,200 seekers at 100% profile completion**.
- **Credentials:** shared password `Demo1234!`; predictable emails `employer.<barangay-slug>.NN@demo.joblinked.test`, `seeker.<barangay-slug>.NN@...`. Demo domain doubles as the purge marker.
- **Realism:** employers accredited (approved `employer_accreditations`, trigger syncs `employers.accreditation_status`); jobs follow draft→pending→approved→published with `job_status_history` rows and future deadlines; fields/skills from the `job_field` (15) and `skill` (60) vocabularies in `db/seed.sql`; seekers fill every `profileCompletion()` check (Dashboard.jsx) plus education + work-experience rows.
- **Extras (all accepted):** application status-mix spread (Applied/Under Review/Interview/Accepted/Rejected — `resume_id` stays null, it's optional), sample notifications, live moderation set (1 pending job + 1 pending accreditation + 1 pending document), a handful of closed/expired jobs for admin counters.

## Open decision — résumé feature

Team is deciding whether to drop résumés. Impact on this plan:

- **If dropped:** seeder unaffected (we never seed résumé rows/files). Note: dropping résumés likely touches the schema (e.g., `resumes` table, `resume_id` column) — that needs a separate architect-approved migration, not part of this script.
- **If kept as-is:** nothing changes; applications seeded with `resume_id = null` are valid today.
- **If kept and made required:** seeder must additionally create resume rows with real files on disk for the seekers that have applications.

## Next step when resumed

Finish the plan file (tasks, keep-set SQL, verification steps), get sign-off, dispatch implementation to `backend`.
