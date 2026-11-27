# Resume Purge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the resume subsystem end-to-end — no resume can be uploaded, viewed, generated, or stored anywhere; the profile is the only candidate evidence.

**Architecture:** Four ordered tasks (server → frontend → database → docs/scripts sweep) so every commit leaves the full test suite green. Applications lose their optional attachment (`resume_id` was nullable and already optional, so no flow changes shape); employer document uploads and profile images are untouched.

**Tech Stack:** React/Vite (JSX), Express/pg, PostgreSQL, Vitest.

**Spec:** `docs/arch/adr-062-resume-purge.md` — read it first; user confirmed full purge (data deletion included) and builder removal on 2026-11-28.

## Global Constraints

- JavaScript/JSX only, no TypeScript.
- Employer accreditation documents (`/files/documents`, `UPLOAD_DIR/documents`) and profile images (`profile_images`) must keep working unchanged.
- `db/schema.sql` changes go through this plan (architect-approved) and ship with migration `023`.
- Supabase is auth-only; no new browser-side storage calls. `signedUrl('documents', …)` survives; the `resumes` bucket usages do not.
- Every commit must leave `npm --prefix server test`, `npm test`, and `npm run lint` green (except where a task explicitly runs only one of them mid-task).

## Review Focus

- **Employer document downloads** still stream after the `bucket === 'resumes'` branch is deleted from `GET /files/:bucket/*` — same route, same ownership check, only the resumes branch is gone.
- **Apply with zero resumes**: JobDetail apply flow must submit `applyToJob(job.id, user.id)` with no resume and succeed.
- **Applicant list without resume embed**: employer Applicants modal renders candidate details with no `application.resume` — no crash, no "View resume" affordance.
- **Account erasure & export**: erasure still unlinks employer documents and scrubs rows; export envelope no longer promises a `resumes` key.
- **Retention purge**: the purge transaction no longer names `resumes` but still purges its other data classes on schedule.

---

### Task 1: Server — remove resume routes, queries, and renderers

**Files:**
- Modify: `server/src/routes/profiles.js` (delete `POST /files/resumes` block ~338-385, `DELETE /files/resumes/:id` ~387-407, `GET /files/resumes/mine` ~409-412; in `GET /files/:bucket/*` change the bucket guard to `documents`-only and delete the `bucket === 'resumes'` branch ~496-508)
- Delete: `server/src/routes/resumes.js` (whole file — `POST /resumes/generate`)
- Delete: `server/src/resumeDoc.js` (whole file — PDF/DOCX renderers)
- Modify: `server/src/app.js:20,136` (drop the `resumesRoutes` import and from the mount list)
- Modify: `server/src/__tests__/helpers/app.js:12` (drop the import + mount)
- Modify: `server/src/routes/applications.js` (POST: drop `resume_id` destructuring ~51, uuid check ~56-58, ownership query ~59-61; INSERT loses `resume_id` ~71-78. List: drop the `resume` embedded subquery ~17-21)
- Modify: `server/src/routes/admin.js` (delete `GET /admin/seekers/:id/resumes` ~275-276)
- Modify: `server/src/routes/account.js` (erasure: drop the resumes select ~151, the `resume_id = null` scrub line ~171, `delete from public.resumes` + its unlink loop ~177-178. Export: drop the resumes query and the `documents.resumes` key ~289-299)
- Modify: `server/src/routes/admin.js` retention purge (~137-214): remove the `resumes` data class from the purge transaction and its audit summary
- Modify: `server/src/upload.js:81,123` (comments now say documents only)
- Modify: `server/src/ai/briefs.js` + `server/src/ai/briefs.test.js` — replace the three resume bullets and the apply line with:
  - Applying: `Applying to a job: open a posting and use the Apply button; your JobLinked profile goes with the application.`
  - Delete the resumes bullet and the autofill-from-resume bullet entirely.
- Tests:
  - Delete: `server/src/__tests__/b4-resume-upload.test.js`, `server/src/__tests__/upload.limits.test.js` (resume-only), `server/src/routes/resumes.generate.test.js`
  - Modify: `server/src/__tests__/s1-uuid-guards.test.js` (drop the resumes/activate/DELETE cases ~61-73, keep the applications case minus `resume_id`)
  - Modify: `server/src/__tests__/middleware-hardening.test.js` (~45-58: re-point the CSP streaming test from a resume to a `documents` file — same route, shared code path)
  - Modify: `server/src/__tests__/files.route-guard.test.js` (re-point the five traversal cases to `/api/files/documents/...`)
  - Modify: `server/src/__tests__/applications.crud.test.js` (drop `resume_id` from `appRow`/POST body ~24,36; delete the resume-embedding test ~156-170)
  - Modify: `server/src/routes/account.erase.test.js`, `server/src/routes/account.export.test.js` (drop resume expectations: unlink/`resume_id = null`/`delete from public.resumes`/`documents.resumes`)
  - Modify: `server/src/__tests__/retention-purge.test.js:104` (remove `resumes` from the expected delete regex)
  - Modify: `server/src/__tests__/admin.seekers.test.js` (delete the resumes describe block)

**Interfaces:**
- Produces: `applyToJob` POST body is `{ job_id }` only; applicants list rows carry no `resume` key; no route under `files/resumes` or `resumes/` exists.

- [ ] **Step 1:** Make all deletions/edits above; keep `applications.js` INSERT valid (`insert into job_applications (job_id, seeker_id) values ($1,$2)`).
- [ ] **Step 2:** Run `npm --prefix server test` — expect full pass, no references to `resumes` outside comments that mention history.
- [ ] **Step 3:** Commit — `feat(server): remove the resume subsystem (ADR-062)`

### Task 2: Frontend — remove resume UI, services, and copy

**Files:**
- Modify: `src/features/job-seeker/Profile.jsx` (delete the `resumes` tab from the tabs array ~60, `ResumeActions` ~100-140, resumes state/loader ~179,199-200, staged-upload save branch ~341-353, `applyAutofill` ~432-450, `pickResume`/`handleDeleteResume` ~476-491, `TabsContent value="resumes"` block ~778-826, the delete confirm dialog ~833, imports ~14,34)
- Delete: `src/features/job-seeker/ResumeAutofill.jsx`
- Delete: `src/features/auth/CreateResumeModal.jsx`
- Modify: `src/features/auth/JobSeekerRegister.jsx` (drop the CreateResumeModal import ~15, `resumeBuilderOpen`/`experience` state ~35-37, the `onOpenResumeBuilder` prop ~184, the modal JSX ~258-262)
- Modify: `src/features/auth/JobSeekerPersonalStep.jsx` (drop the `onOpenResumeBuilder` prop and the "Create a Resume" button/hint block ~11-27)
- Modify: `src/features/job-seeker/JobDetail.jsx` (drop `listResumes` import ~10, `resumes`/`selectedResume` state ~25-26, the parallel fetch ~37-45, `applyToJob(job.id, user.id)` ~61, and the "Resume to attach" select block ~210-221)
- Modify: `src/features/employer/Applicants.jsx` (drop `onViewResume`/`resumeError` props ~31,83-98,166,203-213,309-310 and the resume row in CandidateDetail)
- Modify: `src/shared/components/SeekerProfileCard.jsx` (drop `signedUrl` import ~5, `openResume`/`resumeError` ~34,45-53, the View Resume button ~87-93, `applicant.resume` references in the comment ~25-26)
- Modify: `src/features/super-admin/UserManagement.jsx` (drop resumes from the detail fetch ~274-275, `openResume`/`viewingResumeId` ~365-375, the resumes list block ~1027-1051 and its empty state, the copy at ~462)
- Modify: `src/shared/services/documents.js` (delete `uploadResume` ~17-23, `listResumes` ~35-38, `deleteResume` ~40-43, `generateResume` ~85-89)
- Modify: `src/shared/services/applications.js` (`applyToJob(jobId, seekerId)` — drop the `resumeId` param and the `resume_id` field ~5-7)
- Modify: `src/shared/services/admin.js:146` (delete `getSeekerResumes`)
- Modify: `src/shared/lib/api.js:201` (delete `postBlob` — its only consumer was `generateResume`)
- Delete: `src/shared/lib/resumeText.js`, `src/shared/lib/__tests__/resumeText.test.js`, `src/shared/utils/resumeAutofill.js`, `src/shared/utils/__tests__/resumeAutofill.test.js`
- Modify copy (exact new strings):
  - `src/shared/constants.js`: delete the "Can I apply without a resume?" FAQ entry (~263-265). Leave the job-fair answers (~294-308) — they describe offline PESO events, not app features.
  - `src/shared/content/matching.js:10` + `src/shared/content/__tests__/matching.copy.test.js:46` and `src/features/job-seeker/__tests__/PreferenceMatching.ai.test.jsx:5`: notice becomes `'Your request may be processed by an AI provider to re-rank vacancies. Never include personal details; nothing about your profile is sent.'`
  - `src/features/public-site/HowItWorks.jsx:24`: "Register with fictional information, add your barangay, education, and skills."; `:34`: "Pick a vacancy, add an optional note, and submit a demo application."
  - `src/features/super-admin/RoleManagement.jsx:34`: `'Profile & resume'` → `'Profile'`
- Tests:
  - Delete: `ProfileResumeUpload.test.jsx`, `ProfileResumeDelete.test.jsx`, `ProfileResumeAutofill.test.jsx`
  - Modify: remaining `Profile.*.test.jsx` (drop the `resumeText` mocks and any "my resumes"-tab interactions), `Profile.a11y.test.jsx` (tab list loses `/my resumes/i` ~43,70-93)
  - Modify: `JobSeekerRegister.test.jsx` (drop the builder mocks ~23,32 and the whole "Create a Resume" describe ~343-401; the mock at line 7 keeps `postBlob` removal in mind — delete the key)
  - Modify: `JobDetail.deadline.test.jsx:89-91` (the query assertion still passes trivially; simplify to assert apply submits without a resume field)
  - Modify: `Applicants.actionError.test.jsx` (drop the resume fixture ~29 and the 403-resume test ~59-70)
  - Modify: `UserManagement.seekerDetail.test.jsx` (~156-172: delete the two resume tests)
- [ ] **Step 1:** Apply all edits/deletions above.
- [ ] **Step 2:** Run `npm test` — full pass.
- [ ] **Step 3:** Run `npm run lint` — clean (no unused imports).
- [ ] **Step 4:** Commit — `feat(web): remove resume UI and services (ADR-062)`

### Task 3: Database — migration 023, schema, and integration tests

**Files:**
- Create: `db/migrations/023_resume_purge.sql` — follow the header/apply convention of `021_drop_referral_columns.sql`:
  ```sql
  -- 023_resume_purge.sql — purge the resume subsystem (ADR-062)
  -- Apply: psql -d joblinked -f db/migrations/023_resume_purge.sql
  alter table public.job_applications drop column if exists resume_id;
  drop table if exists public.resumes;            -- indexes drop with it
  -- Rollback: none (data is deleted, not archived).
  ```
- Modify: `db/schema.sql` (delete the `resumes` table block ~272-283, `resume_id` in `job_applications` ~285, the four resume indexes ~473-476; update the bucket comment ~410 to name only documents)
- Modify: `supabase/migration.sql` (delete the `resumes` table + RLS policies ~450-477, `resume_id` in `job_applications` ~480, and the `resumes` storage-bucket insert + its two policies ~901-915)
- Modify: `server/src/__tests__/integration/db.integration.test.js` (delete the ADR-049 one-resume test ~83-97)
- **File deletion (ops, post-deploy):** after the migration runs in an environment, remove `UPLOAD_DIR/resumes/` from disk. Documented in Task 4.

- [ ] **Step 1:** Write the migration and schema edits.
- [ ] **Step 2:** Apply to the local dev DB: `psql "$DATABASE_URL" -f db/migrations/023_resume_purge.sql` (or the project's established apply command) — expect clean apply, `\d resumes` → does not exist.
- [ ] **Step 3:** Run `npm --prefix server test` (integration suite included) — full pass.
- [ ] **Step 4:** Commit — `feat(db): drop resumes table and job_applications.resume_id (ADR-062)`

### Task 4: Scripts, docs, and final sweep

**Files:**
- Delete: `scripts/eval-autofill.mjs`
- Modify: `package.json` (delete the `eval:autofill` script)
- Modify: `docs/ops/deploy-runbook.md` (drop resume-specific lines: `resumes` in the backup/restore pairing ~266-267, the one-resume-index verification ~220-227, the resume download check ~305-310; `UPLOAD_DIR` note now covers documents only)
- Modify: `db/README.md:42,77` (PDFs on disk = employer documents only)
- Modify: `scripts/backup-uploads.mjs:2`, `scripts/backup.sh:5` (comments: documents, not resumes)
- Modify: `db/seed-dev.sql:76` (job description: "Apply through JobLinked." — drop "and attach your resume")
- Modify: `scripts/e2e-feature-probes.mjs:113` (drop `resume` from the applicant-detail regex)
- [ ] **Step 1:** Apply edits; run `npm test`, `npm --prefix server test`, `npm run lint` — all green.
- [ ] **Step 2:** Final grep — `grep -rin "resume" src/ server/src/ db/ scripts/` — expect only historical mentions in migration 014 and harmless prose (e.g., `sample_pdf` fixtures for the deleted renderers can be left; `resumeDoc.js` is gone so they are inert). No code reference may remain.
- [ ] **Step 3:** Commit — `chore: purge resume references from scripts and docs (ADR-062)`
- [ ] **Step 4:** Manual smoke (user or agent with a browser): register a seeker → profile tabs render without "My resumes"; apply to a job → succeeds with no resume select; employer opens the applicant modal → details render, no resume row; super-admin seeker detail renders without resumes; employer document upload/download still works.
