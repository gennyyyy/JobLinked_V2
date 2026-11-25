# My Applications cleanup + status label parity

**Status:** approved by user 2026-11-26.

## A. Remove the "Find more opportunities" button

`src/features/job-seeker/Applications.jsx` renders a `PageHeading` action with
`<LinkButton href="/job-seeker/jobs"><BriefcaseBusiness />Find more opportunities</LinkButton>`
(lines ~110-115).

- Remove the `action` prop from `PageHeading`; keep title and description.
- Drop the now-unused `LinkButton` import from `@/shared/components/design` and
  `BriefcaseBusiness` from `lucide-react` (no other usage in the file).
- No test references the button; nothing else changes.

## B. "Pending review" → "Pending Review" label parity

`src/features/employer/jobPostFields.js` has `POSTING_LABELS.pending = 'Pending review'`.
`StatusBadge` now title-cases every word, so it renders "Pending Review" and
`JobPosts.feeFilter.test.jsx:130` fails looking for the old mixed-case string.

- Change `POSTING_LABELS.pending` to `'Pending Review'` (the portal's established vocabulary).
- Update that test's expectation (and its `it(...)` title) to `Pending Review`.
- This is the single posting label map; no other call sites assert the old string.

## Done when

- No "Find more opportunities" button/heading action on `/job-seeker/applications`, no unused
  imports.
- `npx vitest run src/features/job-seeker src/features/employer` and `npm run lint` pass.
