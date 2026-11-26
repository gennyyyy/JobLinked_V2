# Employer applicants: fall back to the seeker's active resume

**Status:** approved by user 2026-11-26 (resume exists on the account but the Review candidate
modal shows no View resume).

## Cause

`server/src/routes/applications.js` `appSelect` embeds the resume only through the application
link:

```sql
(select json_build_object('id', r.id, 'file_name', r.file_name, 'file_path', r.file_path)
 from resumes r where r.id = a.resume_id) as resume
```

An application submitted before the seeker uploaded a resume (or whose linked resume row is gone)
has `resume_id = null` → `resume: null` → the modal hides View resume. The signed-file route
(`profiles.js:486-489`) already authorizes an employer for **any** resume of a seeker who applied
to one of their jobs, so the read policy already permits this; only the embed is missing.

## Change — `server/src/routes/applications.js`

Replace the resume subquery in `appSelect` with a coalesce:

```sql
coalesce(
  (select json_build_object('id', r.id, 'file_name', r.file_name, 'file_path', r.file_path)
     from resumes r where r.id = a.resume_id),
  (select json_build_object('id', r.id, 'file_name', r.file_name, 'file_path', r.file_path)
     from resumes r where r.seeker_id = a.seeker_id and r.is_active
     order by r.uploaded_at desc limit 1)
) as resume
```

- The linked resume still wins (the one the candidate applied with).
- The fallback is the seeker's current active resume, so old applications and replaced resumes
  show the current file.
- Applies to every `appSelect` caller (company list, job list, seeker list, loadApp) — consistent
  everywhere.

## Test — `server/src/__tests__/applications.crud.test.js`

Add one test for `GET /api/applications/company/:companyId` asserting the generated SQL contains
the fallback (`seeker_id = a.seeker_id`, `is_active`) alongside the linked-resume lookup, in the
same style as the existing SQL-shape assertions. No schema or migration change.

## Done when

- An applicant row whose `resume_id` is null but whose seeker has an active resume now returns a
  `resume` object, so the existing modal button renders.
- `npx vitest run server/src/__tests__/applications.crud.test.js` and `npm run lint` pass.
