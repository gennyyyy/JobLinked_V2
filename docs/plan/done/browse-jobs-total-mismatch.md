# Browse Jobs total mismatch (101 vs 100)

Status: confirmed brief, ready for implementation
Owner: frontend
Confirmed by user: yes

## Symptom

Landing "Open jobs" shows 101; Browse Jobs shows "1–15 of 100 records".

## Root cause (verified)

- `server/src/routes/jobs.js` `GET /public/stats` counts `status = 'published' and (deadline is null or deadline >= current_date)` → 101.
- `src/shared/components/JobsBrowser.jsx:69` loads the whole list in one request:
  `listJobs({ pageSize: 200, order: 'created_at.desc' })`.
- `pageParams` (`server/src/util.js:52-58`) clamps `pageSize` to `maxSize = 100`. The page therefore
  receives 100 of 101 rows.
- The pager prints `records.length` (the loaded slice), so it can never exceed 100.

Client-side search, barangay/field/type/salary/experience filters, AI ranking and saved-jobs
filtering all operate on the in-memory list, so the page genuinely needs the full published set.

## Fix (approved scope)

`JobsBrowser.jsx` only:

1. Keep the first request `listJobs({ page: 1, pageSize: 100, order: 'created_at.desc' })`.
2. While `loaded.length < result.total` and the last page returned rows, request the next page
   with the same `pageSize` and append. Stop on `total` reached, a short page, or a hard
   iteration guard (server clamps `page` at 1,000,000).
3. Behaviour on error stays as today (whole load fails into `InlineError`).
4. Do not change the API, the server route, or what "open jobs" means.

Guard required: a mocked/stubbed API that repeats the same page must not loop forever.
Loop only while `accumulated < total` and the last page yielded new rows, with a bounded
page count.

## Acceptance

- `src/shared/components/__tests__/JobsBrowser.test.jsx` existing tests still pass
  (their mocks set `total = jobs.length`, so no second request is issued).
- New test: first response `{ jobs: 100 fixtures, total: 101 }`, second response
  `{ jobs: [1 fixture], total: 101 }` → the browser reports 101 matching vacancies and the
  pager totals 101; `listJobs` called with `page: 1` then `page: 2`.
- `npm test` and `npm run lint` pass.

## Out of scope

- Server-side filtering/pagination refactor.
- Changing the landing stat definition (accreditation filtering is a separate question; the
  public list endpoint does not return `accreditation_status`, so `isBrowsable` accreditation
  check is a no-op today — do not act on it here).
