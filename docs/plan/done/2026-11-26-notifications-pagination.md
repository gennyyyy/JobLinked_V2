# Notifications page pagination

**Status:** approved by user 2026-11-26 ("add pagination to the notification page as well").

## Context

`src/shared/components/NotificationsPage.jsx` backs all three notification routes
(`/job-seeker/notifications`, `/employer/notifications`, `/super-admin/notifications`). It loads
every row and renders `filtered.map(...)` in one list, so the page grows without a pager.

All list pages use the shared `Pager` from `src/shared/components/dashboard.jsx`, default
`PAGE_SIZE` 8, and the client-side pattern already used in `job-seeker/Applications.jsx`:
`pages`, clamped `currentPage`, `visible = records.slice(...)`.

## Scope — one file

`src/shared/components/NotificationsPage.jsx`:

- Add `PAGE_SIZE = 8` and `const [page, setPage] = useState(1)`.
- Derive `pages`, `currentPage = Math.min(page, pages)`, and
  `visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)`.
- Render `visible` rows instead of `filtered` (keep `key`, selection, and handlers unchanged).
- Import `Pager` from `./dashboard` and render it after the list, inside the non-empty branch:
  `<Pager page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} label="notifications" />`
  (it now defaults to centered).
- Reset to page 1 on search change (`onChange` of the search input) and on view change
  (`setPage(1)` next to `setUnreadOnly(...)`).
- Do not change selection semantics: "Select all" keeps operating on every loaded notification
  as it does today.

## Test

`src/shared/components/__tests__/NotificationsPage.test.jsx` — add one test with 10 rows:
page 1 renders 8 rows, pager reads `1–8 of 10 notifications`; click "Next page" and the last 2
render. Existing tests use 2 rows, so they stay unaffected.

## Out of scope

- Server-side pagination (`listNotifications` keeps returning all rows; filtering stays client-side).
- NotificationBell dropdown, bulk-delete behaviour, unread-only fetch semantics.

## Amendment — drop the redundant super-admin wrapper (2026-11-26)

`features/super-admin/Notifications.jsx` only re-exports the shared `NotificationsPage` with no
props. Point the loader straight at the shared module and delete the wrapper, matching the
employer and job-seeker loaders:

- `src/shared/lib/routeLoaders.js:42` →
  `'/super-admin/notifications': () => import('../../shared/components/NotificationsPage'),`
- Delete `src/features/super-admin/Notifications.jsx` (only the loader referenced it).

## Amendment 2 — Mark all as read inside the panel (2026-11-26)

Move the button from `PageHeading` into the "Your notifications" panel action row.

- Remove the whole `action={<Button …Mark all as read…>}` prop from `PageHeading`.
- Inside the panel's existing `action` div (`flex items-center gap-3`), place the same button
  between the "Select all" label and the "Delete selected" button, so the destructive action
  stays rightmost: `Select all → Mark all as read → Delete selected`. Same props:
  `variant="outline" onClick={handleMarkAllRead} disabled={unreadCount === 0}` and the
  `CheckCheck` icon.
- `CheckCheck` stays imported (still used). No test asserts the button today.

## Done when

- All three notification routes paginate 8 per page, centered pager at the bottom.
- `npx vitest run src/shared/components/__tests__/NotificationsPage.test.jsx` and `npm run lint` pass.
