# Browse Jobs — Restore Side Filter Card with Integrated Matching — Confirmed Brief

**Status:** Approved 2026-11-21. Owner: frontend agent.
**Type:** Bounded layout change. No API, server, schema, or data change.

## Goal

Browse Jobs returns to a sticky **left filter card**: search, the skills-based matching
control, and all filters in one sidebar. Results sit in the right column. The matching
dialog is triggered from the compact control inside that card; the standalone full-width
matching panel above the list is removed.

This reverses the layout chosen in commit `c0b5192` while keeping every behavior added
since (Field filter, ranking, saved jobs, empty states).

## Files

- `src/shared/components/JobsBrowser.jsx`
- `src/shared/components/__tests__/JobsBrowser.layout.test.jsx`
- `src/shared/components/__tests__/JobsBrowser.test.jsx`
- `src/features/job-seeker/__tests__/Jobs.a11y.test.jsx`
- `src/features/job-seeker/__tests__/Jobs.loading.test.jsx`

Do not change `PreferenceMatching.jsx` (compact mode already exists), `JobCard`, server
code, or `db/schema.sql`.

## Layout

Use the pre-`c0b5192` markup as reference:
`git show c0b5192^:src/shared/components/JobsBrowser.jsx` (return block).

- After `PageHeading`, wrap in `<div className="flex flex-col gap-7 lg:flex-row">`.
- `!saved`: render
  `<aside className="surface h-fit w-full shrink-0 lg:sticky lg:top-[90px] lg:z-10 lg:max-h-[calc(100vh-110px)] lg:w-[235px] lg:self-start lg:overflow-y-auto">`
  containing, in order:
  1. a row with `SearchInput` (label "Search your recommendations", placeholder
     "Search jobs…") and `<PreferenceMatching compact … />`;
  2. a bordered row with `SlidersHorizontal` and `<h2 className="text-sm font-semibold">Narrow your search</h2>`;
  3. `filterFields('sidebar')`.
- Results column `<div className="min-w-0 flex-1">`: saved search (saved only), count
  line, matching-mode status, match notice, the "A match you can understand" `Notice`
  (non-saved only), skeleton/error/empty/cards, grid `md:grid-cols-2 2xl:grid-cols-3`.
- Pager stays outside the flex row, unchanged.
- Remove: `refineOpen`, `refineId`, the `Refine results` button/region, the top-level
  `<PreferenceMatching>` non-compact render, and now-unused `useId`/`ChevronDown` imports.
  Keep `SlidersHorizontal`.

Mobile: `flex-col` stacks the card above the results. No collapse toggle, no matchMedia
state.

## Tests

- Layout test: assert `getByRole('complementary')` sidebar contains the search field, the
  "Skills-based matching" button, the "Narrow your search" heading, all five filter
  labels, and "Reset all filters"; results are outside it. Keep a Field-filter narrowing
  test. Remove matchMedia/collapse/toggle tests. Saved variant: no sidebar, no matching
  button, search-only.
- `JobsBrowser.test.jsx`: delete the `openRefine` helper and its calls; controls are
  always rendered. Everything else unchanged.
- `Jobs.a11y.test.jsx`: remove refine-toggle clicks; filter and reset controls are
  directly available. Keep all assertions.
- `Jobs.loading.test.jsx`: replace the matching-region/refine-toggle expectations with
  sidebar expectations (search + matching button + filters mounted while loading).

## Acceptance

- `npx vitest run src/shared/components/__tests__/JobsBrowser.layout.test.jsx src/shared/components/__tests__/JobsBrowser.test.jsx src/features/job-seeker/__tests__/Jobs.a11y.test.jsx src/features/job-seeker/__tests__/Jobs.loading.test.jsx src/features/job-seeker/__tests__/OpportunityList.matching.test.jsx src/features/job-seeker/__tests__/PreferenceMatching.ai.test.jsx src/features/public-site/__tests__/PublicJobs.test.jsx` passes.
- `npm run lint` clean.
- Report actual output and any risk noticed.
