# Profile — system-acquired employment container

Status: approved by architect, ready for implementation
Date: 2026-11-25

## Confirmed brief

- **What:** On the job-seeker **Profile → Skills** tab, add a distinct read-only
  **"Employment through JobLinked"** container below the existing Work Experience
  tag field. It lists current and past employment acquired through the system
  (`employment_history`), with employer, position, start date, and end date or
  "Present".
- **Why:** Placements are recorded and shown on Employment Tracking but are
  invisible on the Profile, while the Profile's Work Experience field is only
  free text (`job_seekers.experience_summary`). The two stores are intentionally
  separate; the Profile must surface the system record without merging it.
- **How:** Reuse the existing `GET /api/seekers/me/employment` endpoint through
  `listEmployment()` in `src/shared/services/seekers.js`. Fetch on Profile mount
  alongside the existing education fetch. No schema, API, or service-signature
  changes.
- **Done:** `npm test` and `npm run lint` pass; a focused test proves records
  render in the new container and existing Profile tests still pass.
- **Out of scope:** editing/deleting employment rows, writing into
  `work_experience` or `experience_summary`, employer/admin views, new tabs.
- **Assumptions:** read-only (the table is trigger-written); current record
  first, then most recent start date; en-PH short date format matching
  Employment Tracking.

## Existing contract (do not change)

`GET /api/seekers/me/employment` — authenticated job-seeker only.
Read-only; rows are written only by the `record_accepted_employment()` DB
trigger on application status changes.

Response: array of `employment_history` rows, ordered `created_at desc`:

```json
[
  {
    "id": "uuid",
    "application_id": "uuid|null",
    "seeker_id": "uuid",
    "employer_name": "Acme",
    "position": "Cashier",
    "start_date": "2026-01-01",
    "end_date": null,
    "is_current": true,
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

Errors: existing API envelope (`401 UNAUTHENTICATED`, `403 FORBIDDEN`).

Client: `listEmployment()` already exists in
`src/shared/services/seekers.js:33`. Do not add a new service.

## UI specification

File: `src/features/job-seeker/Profile.jsx`

Placement: inside `<TabsContent value="skills">`, after the Work Experience
`<TagField>` (`Profile.jsx:661`), inside the same vertical stack.

Container:
- Title: **"Employment through JobLinked"** — `<h3>`.
- Description: "Positions confirmed through the system. Read-only."
- Card styling consistent with the Education tab (`rounded-lg border p-4`).
- Accessible: `<section aria-labelledby="employment-through-joblinked">` or an
  equivalent heading association. Do not use a `<table>`; a `<ul>` of records
  is enough at this width.

Each record:
- Position as the primary line.
- Employer name as the secondary line.
- Dates: `formatDate(start_date) – Present` when current (per the existing
  `isCurrent` rule: `Boolean(record.is_current) || !record.end_date`), otherwise
  `formatDate(start_date) – formatDate(end_date)`.
- A `StatusBadge` with `status="Active"` for current, `"Separated"` for past —
  same vocabulary as Employment Tracking.

States:
- Loading: one line, `role="status"` — "Loading employment records…".
- Error: one line, `role="alert"`, plus a Retry action only if trivial; a plain
  message is acceptable.
- Empty: reuse `EmptyState` with title "No system-recorded employment yet." and
  description "When an employer confirms your hire through JobLinked, the role
  appears here."

Data handling:
- Add `employmentList`, `employmentLoading`, `employmentLoadError` state.
- Extend the existing `useEffect` (`Profile.jsx:190-202`) with
  `listEmployment()`, using the same `live` cleanup flag.
- Sort client-side: current first, then `start_date` descending. Do not rely on
  server order.
- Do not mutate the fetched array in place.
- Date helper: a small local `formatDate` mirroring
  `src/features/job-seeker/Employment.jsx:11-13`. Do not add a shared util.

Do not touch the create/update payload, the tab list, or the Work Experience
tag field.

## Tests

1. New: `src/features/job-seeker/__tests__/Profile.employment.test.jsx`
   - Mock `shared/services/seekers` with `listEducation`, `addEducation`,
     `removeEducation`, `listEmployment`.
   - `listEmployment` resolves one current and one past record.
   - Open Profile, click the Skills tab, assert both employer/position pairs and
     the Present/Separated distinction are visible.
   - Second case: `listEmployment` resolves `[]`; assert the empty state text.
2. Update existing seeker mocks that replace the whole seekers module, adding
   `listEmployment: vi.fn()` and a `mockResolvedValue([])`:
   - `Profile.skills.test.jsx`
   - `Profile.address.test.jsx`
   - `ProfileResumeUpload.test.jsx`
   Check any other test that mounts `Profile` for the same module mock.
3. Run `npm test` and `npm run lint` from the repo root.

## Acceptance

- Skills tab shows the new container with current and past system employment.
- The panel is absent/empty-state when the seeker has no placements.
- No writes to `employment_history` from the client, and no page save triggered
  by viewing it.
- Existing Profile tests and the full suite pass.

## Handoff

Dispatch to `frontend`. Scope: `Profile.jsx` plus the listed tests and the new
test file. No backend, database, or contract work.
