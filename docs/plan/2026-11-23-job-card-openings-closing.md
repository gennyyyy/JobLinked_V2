# Job cards: openings, closing date, hide expired

Status: approved 2026-11-23 — implement via `fullstack-developer`.

## Confirmed brief

- **What:** job cards show the number of openings and the closing date; closed or expired
  jobs no longer appear in public/seeker job listings.
- **How:** add the two fields to `JobCard`; enforce expiry in the public list APIs
  (`deadline is null or deadline >= current_date`) for non-admin/non-owner callers; keep
  employer management and super-admin views complete.
- **Done when:** cards show “N openings” and “Closes <date>”, expired/closed posts are
  absent from public lists (and from public employer profiles), and tests/lint pass.
- **Out of scope:** hiding expired posts in employer management/admin tables, the detail
  page (still explains a closed listing), schema changes.

## Server (`server/src/routes/jobs.js`)

- `GET /jobs`: when the caller is not a super-admin, append
  `(j.deadline is null or j.deadline >= current_date)` to the shared `where` list (so the
  count and page agree). Super-admin queries stay unfiltered.
- `GET /employers/:employerId/jobs`: in the non-owner/non-admin branch, extend the status
  clause with `and (j.deadline is null or j.deadline >= current_date)`. The owner/admin
  branch stays unchanged.

## Frontend

- `src/shared/utils/jobDisplay.js`: add
  `closingDateLabel(job)` → `null` without a deadline; otherwise format the date-only value
  as `Mar 15, 2026` using `Asia/Manila` (parse `${slice(0,10)}T00:00:00+08:00`).
- `src/shared/components/JobCard.jsx`:
  - Description row: when `job.vacancies` is set, show `N opening` / `N openings` with the
    `Users` icon.
  - Footer: keep the posted time / “Applications closed” on the left; add on the right
    `Closes <date>` when open, `Closed <date>` when past deadline, or `No closing date`
    when none.
- `src/shared/components/JobsBrowser.jsx`: saved-jobs description loses the now-inaccurate
  “Closed roles may no longer accept applications.” sentence (expired saved posts are
  filtered out); keep the rest.

## Tests

- `src/shared/components/__tests__/JobCard.test.jsx`: card with `vacancies: 2` and a
  deadline renders “2 openings” and “Closes …”; no deadline renders “No closing date”;
  an expired job renders “Closed …”/“Applications closed”.
- `server/src/routes/jobs.expired.test.js` (new): anonymous `GET /jobs` includes the expiry
  clause in both count and page queries; super-admin `?status=published` does not;
  `GET /employers/:id/jobs` anonymous includes it while the owner request does not.
- Update any SQL-regex mocks that break; keep existing suites green.

## Acceptance

Focused server + JobCard suites, then `npm test` and `npm run lint`, all passing.
