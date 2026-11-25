# Employer accreditation status dedupe

**Status:** approved by user 2026-11-25 (option: "Delete both duplicate notices")
**Owner:** frontend

## Confirmed brief

On `/employer` the accreditation status renders three times; on `/employer/job-posts` twice.
Keep one global notice (layout banner) and one status card (dashboard panel). Delete the two
copy-pasted notices. Collapse the three accreditation label maps to the one already exported
from `src/features/employer/jobPostFields.js`.

## Scope

1. `src/features/employer/Dashboard.jsx`
   - Delete the `Notice` block (lines 53-58) and the now-unused `Notice` import.
   - "Your accreditation" panel: replace the inline status map with
     `ACCREDITATION_LABELS[accreditation]` imported from `./jobPostFields`.
   - Keep the panel, its copy and its link.

2. `src/features/employer/JobPosts.jsx`
   - Delete the `Notice` block (lines 421-426).
   - Remove `Notice` from the `shared/components/design` import and `ACCREDITATION_LABELS`
     from the `./jobPostFields` import (both become unused).
   - Do not touch the publish guard (`accreditationStatus !== "approved"`) or the loader
     behaviour.

3. `src/features/employer/EmployerAccreditation.jsx`
   - Delete the local `STATUS_LABELS` / `statusLabel` pair; import `ACCREDITATION_LABELS`
     from `./jobPostFields` and keep the same fallback (`ACCREDITATION_LABELS[v] || capitalize`).

4. `src/features/employer/jobPostFields.js`
   - Single source of truth. `revoked` stays `'Revoked'` (accreditation is revoked, not
     suspended). `none`/`pending` stay `'Pending Review'`.

5. `src/shared/components/design.jsx`
   - Add `'Revoked'` to `StatusBadge`'s `bad` list so a revoked accreditation keeps the
     danger tone (previously supplied by the label `'Suspended'`).

6. Tests
   - `src/features/employer/__tests__/JobPosts.empty.test.jsx`: test 1 no longer finds the
     notice. Keep the empty-state assertion and assert the accreditation warning is absent
     (it now lives once, in `EmployerLayout`).
   - `src/features/employer/__tests__/JobPosts.a11y.test.jsx:171`: drop the removed-notice
     assertion; keep the "row menu away from an unaccredited employer" assertion.

Out of scope: `EmployerLayout.jsx` banner behaviour, dashboard data fetching, server/API,
`schema.sql`, super-admin surfaces, refetch/staleness of `user.accreditation_status`.

## Done when

- `/employer` shows the status in the top banner (global, dismissible) and the "Your
  accreditation" panel only.
- `/employer/job-posts` shows no accreditation notice of its own.
- `revoked` reads "Revoked" everywhere in the employer feature and still renders danger tone.
- `npm test` passes and `npm run lint` is clean.
