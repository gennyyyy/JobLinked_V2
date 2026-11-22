# Remove the matching notice from JobsBrowser

Status: confirmed brief, ready for implementation
Owner: frontend
Confirmed by user: yes (remove from both pages that share the browser)

## What

Delete the "A match you can understand" `Notice` block from `JobsBrowser`.
It disappears from both the public bulletin (`/jobs`) and the job-seeker
Browse Jobs (`/job-seeker/jobs`). The AI matching prompt, ranking, mode label,
and match-unavailable message stay unchanged.

## How

`src/shared/components/JobsBrowser.jsx`:

- Remove lines ~302-308 (the `!saved` wrapper + `Notice` block).
- Drop `Notice` from the `@/shared/components/design` import (unused after removal).
- Drop `MATCHING_NOTICE` from the `@/shared/content/matching` import (still used by
  the homepage; keep the constant and `matching.copy.test.js` untouched).
- Keep `MATCH_UNAVAILABLE`, `matchModeLabel`, `matchNotice`, `PreferenceMatching`.

## Tests

- `src/features/job-seeker/__tests__/Jobs.a11y.test.jsx` (~line 58): change the
  case to assert the notice is absent (`queryByText('A match you can understand')`
  is null) and the vacancy count still renders.
- Remove any other assertion of the notice if found; do not touch homepage
  pillar tests or `matching.copy.test.js`.

## Acceptance

- `npx vitest run` over `Jobs.a11y`, `JobsBrowser`, `JobsBrowser.layout`,
  `OpportunityList.matching`, `PublicJobs`, and `matching.copy` passes.
- `npm run lint` clean.
- Unrelated pre-existing `EmployerRegister`/`TermsModal` failures stay untouched.

## Out of scope

Homepage pillar copy (`CommunitySections.jsx`), the `MATCHING_NOTICE` constant,
the matching feature itself, server, database.
