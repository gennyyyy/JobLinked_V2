# Employer job-posting row actions: single overflow menu

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** replace the three row action buttons (Edit, Close/Publish/Reopen, View eye)
  in employer Job Management with one `⋯` overflow menu that executes every action.
- **How:** keep the vacancy title as the view trigger (it already opens the in-portal
  `JobPostDetailDialog`); the menu holds Edit posting, the status action, and Delete
  posting. Uses the existing `@/components/ui/dropdown-menu`.
- **Done when:** each row shows a single actions control; Edit, Publish/Close/Reopen,
  and Delete are all reachable and behave as before; no row action links to a public
  route (ADR-021); focused tests, full suite, and lint pass.
- **Out of scope:** the detail dialog's own buttons, the applicants link, the page-level
  "Post a Job" button, the Delete confirmation copy, any server/API change.

## Changes (`src/features/employer/JobPosts.jsx`)

- Remove the Edit `<Button>`, the Close/Publish/Reopen `<Button>`, and the Eye link from
  the Actions cell.
- Add a single trigger: ghost icon `Button` with `MoreHorizontal` (lucide) and
  `aria-label={`Actions for ${titleCase(post.title)}`}`.
- `DropdownMenuContent` items:
  1. **Edit posting** → `handleOpenEdit(post)`.
  2. Status item, label by status: `published` → "Close posting" (`handleToggleClose`),
     `closed` → "Reopen posting", otherwise "Publish posting". The publish variant keeps
     the existing guard: disabled when `saving || accreditationStatus !== 'approved'`.
  3. `DropdownMenuSeparator`, then **Delete posting** → `setConfirmDeleteJob(post)`,
     styled destructive.
- Remove now-unused imports (`Edit3`, `Eye`) and remove the dead archive flow:
  `confirmArchiveId` state, `confirmArchiveJob`, and the archive `ConfirmationModal`
  block (`setConfirmArchiveId` is never called anywhere).
- Keep the title button, applicants link, status badge, and all existing handlers.

## Tests (`src/features/employer/__tests__/JobPosts.a11y.test.jsx`)

- Existing action-error test: open the row menu, then click "Close posting".
- New/updated coverage:
  - one actions trigger per row (`Actions for Warehouse Associate`) and no Edit/Eye/Close
    row buttons beside it;
  - menu exposes Edit posting, Close posting (published row), Delete posting;
  - Edit posting opens the form dialog; Delete posting opens the confirmation;
  - a draft row from an unaccredited employer shows "Publish posting" disabled;
  - keep the assertion that no `/jobs/job-1` link exists.
- Other behavior and mocks unchanged.

## Acceptance

`npx vitest run src/features/employer/__tests__/JobPosts.a11y.test.jsx`, then
`npm test` and `npm run lint`, all passing. Report commands and counts.
