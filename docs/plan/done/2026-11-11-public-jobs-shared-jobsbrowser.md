# Plan: Promote the jobseeker Browse Jobs page into a shared JobsBrowser

**Status:** DONE — implemented 2026-11-11, verified
**Owner:** Lead Architect → hand off to `frontend`

## Decision

The jobseeker Browse Jobs page (`OpportunityList`) was promoted into `src/shared/components/JobsBrowser.jsx`, parameterized by `jobHref`, `saved`, `title`, `description`, `initialQuery`, and `initialBarangay`. The jobseeker `Jobs`/`SavedJobs` routes and the public `/jobs` page all render the same component, so every component is present in both.

## Delivered

- `src/shared/components/JobsBrowser.jsx` — moved from `features/job-seeker/OpportunityList.jsx`; seeds query/barangay from props; passes `jobHref` to cards; keeps fetch, AI matching, 5 filters, reset, notice, match state, grid, pager, loading/error/empty.
- `src/shared/components/PreferenceMatching.jsx` — moved from the feature folder, unchanged.
- `src/features/job-seeker/Jobs.jsx` and `SavedJobs.jsx` — thin wrappers passing the seeker `jobHref`.
- `src/features/public-site/PublicJobs.jsx` — renders `JobsBrowser` with public `jobHref`, title/description, and URL-derived `initialQuery`/`initialBarangay`.
- Deleted `src/shared/components/BrowseJobs.jsx` and its test.
- Tests updated/moved: `OpportunityList.matching.test.jsx`, `PreferenceMatching.ai.test.jsx`, `SavedJobs.test.jsx`; added `src/shared/components/__tests__/JobsBrowser.test.jsx`.
- Match badges now render only when the user has skills (`showMatch={!saved && Boolean(user?.skills?.length)}`), so anonymous visitors don't see `0% skills overlap`.

## Verification

- `JobsBrowser` + matching + SavedJobs tests: 3 files / 13 tests passed.
- Full suite: 1085 passed, 6 skipped; the only failure (`ProfileResumeUpload` CheckCircle2 ReferenceError) passes in isolation and the file is untouched — stale-transform flake.
- `npm run lint`: clean.
- Browser `/jobs` at 1440 + 390: heading, search + AI button, 5 filters + reset, match notice, count line, card grid, pager; zero horizontal overflow.

## Rollback

Restore the moved files and wrappers; no data changes.
