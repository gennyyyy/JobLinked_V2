# Browse Jobs pager: "jobs" instead of "records"

Confirmed with user 2026-11-25.

## What

Browse Jobs footer text changes from `1–15 of 102 records` to `1–15 of 102 jobs` (and `No records` → `No jobs` in the empty case for that pager).

## How

- `src/shared/components/dashboard.jsx` — `Pager` gains `label = 'records'` prop; renders `${...} of ${total} ${label}` and `No ${label}`.
- `src/shared/components/JobsBrowser.jsx` — pass `label="jobs"` to its `Pager`.
- Default keeps every other Pager (super-admin, employer, job-seeker) and its existing test assertions unchanged.

## Done when

- `src/shared/components/JobsBrowser.jsx` pager reads "jobs"; other pagers still read "records".
- `npm test` and `npm run lint` pass.

## Out of scope

- The `N matching vacancies` count, admin/employer pagers, any other wording.
