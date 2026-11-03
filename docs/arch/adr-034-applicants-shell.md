# ADR-034 — `ApplicantsShell`: reusable applicants-list chrome [ACCEPTED 2026-10-18]

## Context
`src/features/employer/Applicants.jsx` (~440 lines) mixes two concerns:

- **Domain logic** (page-owned): fetching via `listByCompany`, `setStatus`, interview scheduling
  (`handleInterview`/`confirmInterview`), profile expansion, `actionErrors`, the interview form.
- **List chrome** (generic): the page header, the `lg:grid-cols-[1fr_200px]` two-column
  layout, the search + sort bar card, the empty state, the applicant-card grid container,
  and the sticky sidebar of summary/filter cards.

Reusing this layout for another applicants-like page (e.g. a super-admin all-applicants view
or a candidate pipeline) currently means copy-pasting all of it, including the domain logic
that does not apply. The four existing tests in
`src/features/employer/__tests__/Applicants.*.test.jsx` pin the chrome's labels and selectors
("Applicant Tracking", "Search applicant", "Clear all filters", "No applicants yet", etc.).

## Decision
1. **New `src/shared/components/ApplicantsShell.jsx`** — presentational only. The page keeps
   state and domain logic; the shell owns the chrome. Props:

   | Prop | Type | Default | Notes |
   |---|---|---|---|
   | `title` | string | `"Applicant Tracking"` | header h1 |
   | `subtitle` | node | — | italic gray line under the title |
   | `search` | string | `""` | controlled |
   | `onSearchChange` | fn | — | |
   | `searchPlaceholder` | string | `"Search applicant"` | |
   | `sort` | string | `"newest"` | |
   | `onSortChange` | fn | — | |
   | `sortOptions` | `{value,label}[]` | newest/oldest | |
   | `isEmpty` | boolean | `false` | when true, renders the empty state instead of `children` |
   | `emptyTitle` | string | `"No applicants yet"` | |
   | `emptyBody` | string | — | |
   | `emptyIcon` | node | `<Users />` | |
   | `onClearFilters` | fn | — | when provided, renders "Clear all filters" |
   | `filters` | `{value,label,count,className}[]` | `[]` | sidebar filter cards |
   | `activeFilter` | string | — | |
   | `onFilterChange` | fn | — | |
   | `children` | node | — | the list body (card grid), rendered only when `!isEmpty` |
   | `aside` | node | rendered filter cards | override the whole sidebar |

   Layout is byte-for-byte the current one: outer `space-y-6 pb-12`, header, then
   `grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-5` with the left column holding the
   search/sort bar card plus the empty-state-or-children, and the right column the sticky
   aside of filter cards (`aria-pressed={activeFilter === c.value}`).
2. **`Applicants.jsx` is refactored to use `ApplicantsShell`**, passing the same labels,
   placeholders, and class strings it uses today, and rendering its applicant cards (with all
   the interview/status/profile logic) as `children`. Every existing label and selector is
   preserved so the four Applicants tests keep passing untouched.
3. **The applicant card internals are deliberately NOT extracted.** They carry
   employer-specific actions (interview scheduling, accept/reject, profile expansion) that
   do not generalise; only the shell is shared. A future page composes its own cards as
   `children`. (Ponytail: one abstraction with one consumer today is fine because the
   consumer is the page itself and the abstraction removes ~120 lines of duplicated chrome;
   do not add a card component, a filter-state hook, or a generic "Applicant" type now.)
4. No API, service, schema, or dependency change. `db/schema.sql` untouched.

## Consequences
- `Applicants.jsx` shrinks to domain logic + card rendering; the chrome lives once.
- The four `Applicants.*.test.jsx` files are the guard: they must keep passing with **no
  edits**. If a selector breaks, the shell's labels/classes drifted — fix the shell, not
  the tests.
- A new `ApplicantsShell.test.jsx` covers the shell in isolation (empty state, clear-filters
  button, filter-card aria-pressed, search/sort controlled inputs) so future reusers have a
  contract to rely on.

## Hand-off
Implementation: **frontend** (`ApplicantsShell.jsx` + `Applicants.jsx` refactor).
Tests: **frontend** adds `ApplicantsShell.test.jsx` and runs the four existing Applicants
tests as the guard (untouched). Review: **review**. No database agent.
