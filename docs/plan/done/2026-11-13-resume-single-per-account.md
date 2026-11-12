# Resume rework — one resume per job-seeker account

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Each job-seeker account may hold at most one resume. Uploading a new resume replaces the existing one (same row id, new file; old file deleted — past applications resolve to the new resume automatically). Resumes are managed only on the profile page.

**Architecture:** Enforce uniqueness at the DB level (`resumes(seeker_id)` unique). Replace = in-place: the row keeps its id, only `file_path`/`file_name`/`uploaded_at` change — `job_applications.resume_id` points at that id, so past applications resolve to the new file with no repoint query and no insert/delete ordering hazard. Collapse the multi-resume UI into a single-resume card. Remove resume upload from the job detail page. Keep `resume_id` optional on applications (applying without a resume stays allowed).

**Tech Stack:** Express + pg (server), React + Vite + Tailwind (client), PostgreSQL schema + migration.

**Spec:** docs/arch/adr-049-one-resume-per-account.md — this plan implements it.

## Global Constraints
- No resume quota beyond 1 (`MAX_RESUMES_PER_SEEKER` removed or set to 1).
- `resume_id` on `job_applications` stays nullable (applying without a resume is allowed).
- Registration is unchanged; skills stay optional.
- Past applications that referenced a replaced resume resolve to the new resume (row id kept; FK never breaks). Profile copy is updated to match — today it promises applications "keep the resume that was attached at the time", which becomes false.
- Old resume files are deleted from disk on replace/delete (no orphan pile-up).
- `is_active` column retained for backward compat but always `true` for the single row.
- Keep API error shape `{ error: { code, message } }`.

## Review Focus
- DB migration must not strand multi-resume accounts: keep most recently uploaded, repoint applications to it, delete the rest.
- Replace must be transactional (advisory lock) to avoid races.
- Frontend must not reference `setActiveResume` or multi-resume list rendering; the Replace button must target a real input (today it clicks `getElementById('resume-upload')`, which matches nothing — a silent no-op).
- Job detail must no longer offer upload; resume dropdown shows 0 or 1 option.
- Super-admin UserManagement resume list still works (now at most one row).

## Directory Structure Blueprint
- Modify: `db/schema.sql` (unique constraint on `resumes(seeker_id)`)
- Create: `db/migrations/014_one_resume_per_seeker.sql` (011–013 already exist; 014 is next; register via `db/apply-migrations.sh` → `schema_migrations` ledger)
- Create: `docs/arch/adr-049-one-resume-per-account.md`
- Modify: `server/src/routes/profiles.js` (replace semantics in POST, simplify DELETE, drop setActiveResume)
- Modify: `server/src/routes/applications.js` — no change needed (resume_id validation already correct)
- Modify: `src/features/job-seeker/ResumeAutofill.jsx` (accept an `inputId` prop, forwarded to ResumePicker's `id`, so Profile's Replace button has a real target)
- Modify: `src/features/job-seeker/Profile.jsx` (single-resume card UI + corrected delete/replace copy)
- Modify: `src/features/job-seeker/JobDetail.jsx` (remove upload button/input)
- Remove/deprecate: `setActiveResume` usage in `src/shared/services/documents.js` (keep function but unused, or remove)
- Modify tests: `ProfileResumeUpload`, `ProfileResumeDelete`, `ProfileResumeAutofill`, `JobDetail` tests if any.

## Tasks

### Task 1: DB schema + migration
**Files:** Modify `db/schema.sql`; Create `db/migrations/014_one_resume_per_seeker.sql`
- Add `create unique index if not exists resumes_one_per_seeker_uidx on public.resumes(seeker_id);`
- Migration steps:
  1. For each seeker with multiple resumes, pick keeper = row with max `uploaded_at` (tie-break `id desc`).
  2. `update job_applications set resume_id = <keeper> where resume_id in (<other rows>)` — must precede step 3 (FK is `on delete set null`).
  3. Delete non-keeper rows with `returning file_path`.
  4. Postgres cannot unlink files from SQL: emit the returned `file_path` list (psql output) and delete those files in a follow-up shell step / runbook note. Best-effort; never fail the migration over a missing file.
  5. Create unique index last — it fails if any duplicate survived.
- Register the file in `schema_migrations` via `db/apply-migrations.sh` (ledger convention since migration 011).
- Note: `resumes_one_active_uidx` stays; harmless once redundant.

### Task 2: Server — replace semantics on upload
**Files:** Modify `server/src/routes/profiles.js`
- Remove `MAX_RESUMES_PER_SEEKER` (currently 20) and the quota check + its `QUOTA_EXCEEDED` error branch.
- The plan's original insert→repoint→delete order cannot work: with unique `(seeker_id)` the insert of a second row violates the index while the old row still exists. Fix: replace in place.
- Inside the advisory-lock transaction:
  - If an existing resume row exists for the seeker, capture its `file_path`, then
    `update resumes set file_path = $new, file_name = $originalname, uploaded_at = now(), is_active = true where seeker_id = $1 returning *`.
    No new row, no delete, no `update job_applications` — applications pointing at the row id now resolve to the new file by construction.
  - Else: insert as before.
  - Delete the deactivate step (`update resumes set is_active = false`) — always true now.
- After commit: unlink the captured old file (best-effort, try/catch), then audit + return `{ path, resume }` as before.
- Rejected alternative: a `deferrable initially deferred` unique constraint to allow the insert/delete dance — more moving parts for the same observable result.

### Task 3: Server — simplify delete
**Files:** Modify `server/src/routes/profiles.js` (DELETE handler)
- Delete row; keep the existing unlink and per-user `rmdir` cleanup. Remove the "promote newest active" block (no other rows to promote). Keep the advisory lock — it also serializes delete vs. concurrent replace.
- Keep ownership check + existing `on delete set null` behavior (applications survive with `resume_id = NULL`).

### Task 4: Server — remove setActiveResume (optional)
**Files:** Modify `server/src/routes/profiles.js`
- Keep endpoint for backward compat but make it a no-op returning the single row, OR remove route + client call. Prefer remove route and client call to avoid dead code. Check for callers: `grep setActiveResume`.

### Task 5: Frontend Profile — single-resume card
**Files:** Modify `src/features/job-seeker/Profile.jsx`; Modify `src/features/job-seeker/ResumeAutofill.jsx`
- Replace resume list (`resumes.map`) with: if `resumes[0]` exists, render one card (View/Download/Replace/Delete); else EmptyState. Keep the `resumes` array state, render `resumes[0]`.
- Replace button targets a real input: `ResumeAutofill` gets an `inputId` prop forwarded to `ResumePicker`'s `id`; Profile passes `inputId="resume-upload"`. (Today `document.getElementById('resume-upload')` matches nothing — silent no-op bug.)
- Remove "Set active" button + `handleSetActiveResume`.
- Keep the autofill checkbox gating for upload.
- Update copy to match the new semantics (exact strings):
  - Delete modal: "Are you sure you want to delete this resume? Applications you already sent stay, but they no longer show this resume."
  - Note under the upload panel: "Replacing your resume updates what employers see for applications attached to it."
  - (Old strings promised applications "keep the resume that was attached at the time" — false under replace-in-place and delete-null.)

### Task 6: Frontend JobDetail — remove upload
**Files:** Modify `src/features/job-seeker/JobDetail.jsx`
- Remove file input + "Upload new resume" label + upload handlers/state.
- Keep resume dropdown (now 0 or 1 option) for attaching; if one resume exists, auto-select it.
- Remove `uploadError`/`uploading` state if unused.

### Task 7: Client service cleanup
**Files:** Modify `src/shared/services/documents.js`
- Remove `setActiveResume` (or leave deprecated). Remove from imports in Profile.

### Task 8: Tests
**Files:** Modify `src/features/job-seeker/__tests__/*`
- `ProfileResumeUpload`: selecting + checking + Add resume lists the single card (passes unchanged).
- `ProfileResumeDelete`: deleting removes the card (passes unchanged).
- `ProfileResumeAutofill`, `Profile.barangay`, `Profile.address`, `Profile.a11y`: drop the dead `setActiveResume` mock entries while touching; no assertions to change (verified: none assert "Set active" or multi-resume rendering).
- Add one server test: upload twice → single row, same id, `file_path` updated, first file unlinked (pins Task 2's replace).
- Add one assertion that the upload input/label is absent from JobDetail (pins Task 6 — `JobDetail.deadline.test.jsx` has no upload assertions to remove; it only mocks `uploadResume`).

### Task 9: Verification
- Run `npm test` and `npm run lint`.
- Manual: upload two resumes → only one remains; past application resume_id repointed; delete leaves none; apply without resume works.

## Open questions resolved
- Replace (not block) on second upload. ✓
- Old file deleted. ✓
- Past applications repointed to new resume. ✓
- Upload only on profile page. ✓
- Delete allowed leaving zero. ✓
- Migration keeps most recently uploaded. ✓
- Apply without resume allowed. ✓
- Skills not required. ✓
