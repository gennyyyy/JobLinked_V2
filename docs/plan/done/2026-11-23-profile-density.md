# Densify the profile pages (remove visual whitespace)

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** tighten the visual layout of all three profile pages — job seeker
  Profile, employer Company Profile, and super-admin Profile — by reducing
  vertical gaps, panel padding, heading margins, and blank grid cells. No field,
  label, option, behavior, or saved-data changes.
- **Scope:** the shared `TabbedProfileLayout` (used only by these three pages),
  its `PageHeading`/`Panel` rendering, and the page-specific content spacing.
- **Done when:** both profile tabs and the super-admin profile render with the
  reduced spacing, no blank half-row remains in the employer address grid, and
  existing tests/lint pass.
- **Out of scope:** global page shells, navigation, other pages, field styling,
  font sizes, or any data/validation change.

## Changes

Shared:

- `src/shared/components/TabbedProfileLayout.jsx`
  - outer grid `gap-6` → `gap-4`
  - form `gap-6` → `gap-4`
  - `TabsList` `mb-5` → `mb-3`
  - save row `gap-3` → `gap-2`
  - sidebar `gap-5` → `gap-4`
  - pass `compact` to `PageHeading` and `size="sm"` to `Panel`.
- `src/shared/components/design.jsx` — `PageHeading` gains an optional
  `compact` prop (default false). Compact uses `mb-4` instead of `mb-7`,
  description `mt-1.5 leading-5` instead of `mt-2 leading-6`. All existing
  callers keep the current rendering.

Job seeker Profile (`src/features/job-seeker/Profile.jsx`):

- Content wrappers/grids `gap-5` → `gap-4`.
- Photo block `gap-4 p-4` → `gap-3 p-3`.
- Education/resume section spacing: `pt-5` → `pt-4`, `mt-5` → `mt-4`,
  `mb-5` → `mb-4`, `mb-4` → `mb-3`, `mt-4` → `mt-3`.
- Leave `gap-3`/`gap-2` and small text margins alone.

Employer Company Profile (`src/features/employer/CompanyProfile.jsx`):

- Logo block `mb-5 gap-4 p-4` → `mb-4 gap-3 p-3`.
- All form grids `gap-5` → `gap-4`; `mt-5` → `mt-4`.
- Remove the blank half-row in the address grid: render
  `subdivision_building` in a wrapper with `sm:col-span-2` so the grid holds
  house | street, then a full-width subdivision, then barangay | city, then
  province | postal.

Super-admin Profile (`src/features/super-admin/Profile.jsx`):

- `gap-5` → `gap-4`, security grid `gap-6` → `gap-4`, `mt-4` → `mt-3`.
- Nested "Administrator access" `Panel` gets `size="sm"`; access list `gap-4` →
  `gap-3`.

## Acceptance

Focused profile suites, then `npm test` and `npm run lint`, all passing. Report
commands and counts.
