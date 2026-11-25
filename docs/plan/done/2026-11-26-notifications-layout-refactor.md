# Notifications page layout refactor

**Status:** approved by user 2026-11-26 (full layout spec in the request).
**File:** `src/shared/components/NotificationsPage.jsx` (+ its test).

## Locked assumptions

- **Client-side filtering.** Load all notifications once (`listNotifications(user.id)` with no
  `unreadOnly`). Tab counts need both numbers at once: `all = notifications.length`,
  `unread = notifications.filter(n => !n.is_read).length`. `view` state is `'all' | 'unread'`.
- **Select all** selects every notification matching the active tab + search (across pages), not
  only the current page. Selection is pruned when rows disappear (delete / fetch).
- **Card actions stay explicit** (`Mark read` + `View details`); the card itself is not clickable.

## 1. Container & header

- Wrap the page content (PageHeading, Flash, Panel) in `<div className="mx-auto w-full max-w-4xl">`.
- Panel `action` keeps **only** the global `Mark all as read` button (`CheckCheck`, outline,
  `disabled={unreadCount === 0}`). Title stays "Your notifications"; description keeps
  `${unreadCount} unread · ${notifications.length} total`.
- Remove `Select all` and `Delete selected` from the panel header.

## 2. Filter & search row

- Delete the `Notification view` label + `SelectField` and `VIEW_OPTIONS`.
- One row above the list: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`.
  - Left: segmented control, same visual language as `/how-it-works` tabs — outer
    `inline-flex rounded-lg border border-border bg-card p-1`, buttons `min-h-9 rounded-md px-3
    text-xs font-medium transition-colors`, active `bg-primary text-white`, inactive
    `text-muted-foreground hover:text-navy`; `aria-pressed`, `role="group"` with an aria-label.
    Labels: `All (${allCount})`, `Unread (${unreadCount})`.
  - Right: search input `relative sm:w-72` (full width on mobile), same `InputGroup`/`Search` icon.
- Switching view or typing resets `page` to 1. `filtered = notifications.filter(view + search)`.

## 3. Bulk selection toolbar

- Slim row directly above the list, only when the filtered list is non-empty:
  `flex flex-wrap items-center gap-2 px-3 pb-2` (matches the card `px-3` so the checkbox aligns
  with the row checkboxes).
- Contains the `Select all` checkbox + label (existing indeterminate wiring, now over `filtered`).
- When `selected.size > 0`, reveal to its right:
  - `Mark selected as read` — outline `size="sm"`.
  - `Delete selected` — outline `size="sm"` with `text-destructive`, opens the existing
    confirmation modal.
  Both hidden at 0 selected (no disabled ghost buttons).
- `Mark selected as read`: `Promise.allSettled([...selected].map(id => markRead(id)))`; mark the
  fulfilled rows read locally, clear their selection, and reuse the bulk-delete toast pattern on
  partial failure. No new service call.

## 4. Notification card

- Row: `flex items-center gap-3 rounded-lg px-3 py-3` (+ `bg-blue-soft/50` when unread),
  `flex-wrap` allowed on narrow screens. Remove `mt-1` offsets so checkbox, icon, text, and
  actions share one vertical center.
- Title line: unread dot (if unread) + title + inline timestamp —
  `<h2 class="text-sm font-medium text-navy">…</h2>` followed by
  `<time class="text-micro text-muted-foreground whitespace-nowrap">· Nov 23, 2026</time>`
  inside a `flex items-center gap-x-2` wrapper. Message stays below (`text-xs leading-6`).
- Read rows: title `text-navy/60`, message `text-muted-foreground`, dot absent, icon tile muted
  (keep the existing read treatment).
- Right actions group `ml-auto flex shrink-0 items-center gap-2`:
  - `Mark read` (unread only): ghost `size="sm"`, subtle label + `Check`/existing icon.
  - `View details`: existing `text-link` + `ArrowUpRight`, only when `link` resolves.
- Keep `resolveNotificationLink` behavior and the `onMarkRead` call on the details link.

## 5. Pagination

- Keep `PAGE_SIZE = 8` and the shared centered `Pager`; `total={filtered.length}`. Reset page on
  view/search change. Clamp `currentPage` as today.

## Tests

`src/shared/components/__tests__/NotificationsPage.test.jsx`:
- Rewrite the test that used `getByLabelText('Notification view')` to click the `Unread (n)`
  button instead.
- Add: bulk toolbar buttons are absent at 0 selected and appear after selecting one row.
- Add: `Mark selected as read` calls `markRead` for each selected id and clears selection.
- Existing select-all, delete, pagination, and link tests must stay green (update only what the
  spec genuinely changes).

## Amendment — remove Mark all as read (2026-11-26)

User reversed the header action: remove the "Mark all as read" button from the panel's top-right.
Bulk marking is still available via `Select all` → `Mark selected as read` in the contextual
toolbar.

- Remove the `action={...}` prop from the `Panel` (the whole `Mark all as read` Button).
- Delete `handleMarkAllRead` and drop the now-unused `markAllRead` service import and `CheckCheck`
  icon import. Leave the test mock's `markAllRead` entry alone.
- No other layout changes.

## Amendment 2 — revert the max-width (2026-11-26)

The centered `max-w-4xl` wrapper leaves too much empty space left and right. Remove the wrapper
entirely so the page returns to its previous full-width container width (PageHeading, Flash, and
Panel as direct siblings of the fragment again). No other spacing changes.

## Amendment 3 — swap tabs and search (2026-11-26)

Reverse the filter row order: search input on the left, All/Unread segmented control on the right.
Keep the same wrapper classes (`flex flex-col gap-3 sm:flex-row sm:items-center
sm:justify-between`) and the search's `w-full sm:w-72`. On mobile the search stacks first.

## Done when

- `/job-seeker`, `/employer`, `/super-admin` notification pages show: centered `max-w-4xl`
  layout; single `Mark all as read` in the header; All/Unread segmented tabs with counts; search
  right; toolbar with Select all + contextual bulk actions; compact rows with inline timestamps;
  centered row content; grouped right actions; clear read/unread contrast.
- `npx vitest run src/shared/components/__tests__/NotificationsPage.test.jsx` and `npm run lint`
  pass; report actual output.
