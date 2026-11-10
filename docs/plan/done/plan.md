# Plan: Clone the jobseeker Browse Jobs layout onto the public jobs page

**Status:** DONE — implemented 2026-11-11, verified
**Owner:** Lead Architect → hand off to `frontend`

## Verification results

- `npx vitest run src/shared/components/__tests__/BrowseJobs.test.jsx`: 5 passed.
- `npm test`: 1086 passed, 6 skipped; two unrelated issues — a stale/deleted `tmpdebug.test.jsx` reference and the known `super-admin/Dashboard` 5s flake; both pass when their directories/file are run alone.
- `npm run lint`: clean.
- Browser (1440 + 390): sidebar-first layout with search at the top of the sticky panel, "Narrow your search" divider, card grid on the right, single column on mobile, zero horizontal overflow.

## Decision

Make `BrowseJobs` (public `/jobs` only) structurally identical to `OpportunityList` (jobseeker Browse Jobs): search lives in the sticky left sidebar, results in the right column, same widths/spacing/grid. No data, routing, API, or behavior changes.

## Layout to clone (from `src/features/job-seeker/OpportunityList.jsx`)

```
<div className="flex flex-col gap-7 lg:flex-row">
  <aside className="surface h-fit w-full shrink-0 p-5 lg:sticky lg:top-[90px] lg:z-10 lg:w-[235px] lg:self-start">
    <search block (keyword + location + Search button)>
    <div className="flex items-center gap-2 border-t pt-4">
      <SlidersHorizontal /> <h2>Narrow your search</h2>
    </div>
    <skills + employment type + Refine>
  </aside>
  <div className="min-w-0 flex-1">
    <p>Displaying X out of Y jobs:</p>
    <JobCard grid />
  </div>
</div>
```

## Changes

- `src/shared/components/BrowseJobs.jsx`
  - Delete the top search `surface` block.
  - Move the keyword `SearchInput`, location `SearchInput`, and `Search` submit button into the sidebar inside the existing `handleSearch` form.
  - Add the `SlidersHorizontal` + "Narrow your search" divider header.
  - Change the wrapper from `grid ... lg:grid-cols-[260px_1fr]` to `flex flex-col gap-7 lg:flex-row`.
  - Aside: `surface h-fit w-full shrink-0 space-y-5 p-5 lg:sticky lg:top-[90px] lg:z-10 lg:w-[235px] lg:self-start`.
  - Results: wrap in `min-w-0 flex-1`; keep the `Displaying …` line, `JobCard` grid (`gap-5 md:grid-cols-2 2xl:grid-cols-3`), empty/loading/error states, and pager.
  - Keep the existing "Filter by Skills"/skills cap copy or fold it into the sidebar; do not change `TagInput` label/id or the 3-chip cap.
  - Remove unused imports (e.g. anything only used by the old top bar).
- No changes to `OpportunityList`, `JobCard`, `PublicJobs`, services, or routes.

## Tests

No expected test changes: placeholders, `Search` / `Refine Search Results` / `Clear all filters` names, `Skills` label, and the `Displaying …` text stay. Run the existing `BrowseJobs` test.

## Verification

- `npx vitest run src/shared/components/__tests__/BrowseJobs.test.jsx`, `npm test`, `npm run lint`.
- Browser `/jobs` at 1440 and 390: sidebar-first layout, sticky filter panel, card grid, no overflow.

## Rollback

Revert `BrowseJobs.jsx`; no data changes.
