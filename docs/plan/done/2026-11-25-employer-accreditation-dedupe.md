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

## Amendment 2 — 2026-11-25 (supersedes the banner decision)

User reviewed the result and reversed the banner choice: the global banner is the duplicate to
remove; the dashboard notice is the one to keep.

- `src/features/employer/EmployerLayout.jsx`: delete the whole `ACCREDITATION_NOTICE` map and
  banner block, plus the `dismissedFor` state and every import only the banner used
  (`useState`, `Link`, `AlertTriangle`, `X`, `Button`, `useAuth`). Keep `TopNavLayout`.
- `src/features/employer/Dashboard.jsx`: restore the notice above `<StatCards>`, with the exact
  copy the user quoted — title `Accreditation: ${accreditation}` (raw status), body "You can
  prepare drafts, but publishing is unavailable until PESO approves your accreditation." with
  the "Review requirements and feedback." link to `/employer/accreditation`. Re-add the
  `Notice` import.
- Job posts keeps no accreditation warning (confirmed with user).

## Done when

- `/employer` shows the restored "Accreditation: …" notice and the "Your accreditation" panel.
- No global employer banner; `/employer/job-posts` shows no accreditation notice.
- `revoked` reads "Revoked" everywhere in the employer feature and still renders danger tone.
- `npx vitest run src/features/employer` and `npm run lint` pass. Full `npm test` is currently
  red from an unrelated in-flight auth change (TermsModal "Close & Accept" call sites), so it
  is not the gate for this amendment.
