# ADR-031 — Notification bell becomes a dropdown preview panel [AMENDED 2026-11-04]

## Amendment (2026-11-04)

- The panel shows the **four** newest rows (`slice(0, 4)`), not five.
- `SEE ALL →` moved out of the header pill and became a full-width footer link
  **"Show all notifications →"** below the list, in sentence case with the rest of
  the chrome. The header is just the title + unread count.
- `TopNavLayout` (employer / job-seeker / super-admin top nav) now mounts the bell
  too, replacing its plain history link. It already fetches the rows for the sidebar
  badge, so it passes them in as the new optional `rows` prop; a controlled bell
  does not fetch or subscribe (the shell owns the `NOTIFICATIONS_CHANGED` refresh),
  keeping the page at one request.
- Trigger is `variant="ghost"` unless `dark`, so it reads as an icon button in the
  top nav instead of a solid primary pill.

## Context
`NotificationBell` (`src/shared/components/NotificationBell.jsx`) is the only notification
surface in the chrome: `TopNavLayout` mounts it once (employer, job-seeker),
`PortalLayout` mounts it twice (super-admin: sidebar header + mobile header). Today it is
a plain `<Link>` to `/{role}/notifications`; the history page owns list/filter/mark-read.

The desired UX is a click-to-open dropdown on the bell showing the newest notifications,
matching the site's existing dropdown chrome (`PublicHeader.jsx`) and the notification
item chrome already used by `NotificationsPage.jsx`.

No new data is needed: `GET /api/notifications/mine` already returns the caller's rows
`order by created_at desc limit 50`, scoped to the session token (`server/src/routes/admin.js:536`).

## Decision
1. **Trigger changes role: `<Link>` → `<button>`** with `aria-expanded` and `aria-controls`
   (emitted only while the panel is open, so the IDREF never dangles). **No `aria-haspopup`** —
   `aria-haspopup="true"` is equivalent to `"menu"`, and this panel implements no menu keys,
   so the disclosure pattern (expanded + controls) is the honest one. The `aria-label`
   contract is preserved verbatim:
   `"Notifications (N unread)"` or `"Notifications"`. The history page stays reachable
   from the panel's **SEE ALL →** link, so the four existing link-based assertions in
   `NotificationBell.test.jsx` are updated (label + href move to the SEE ALL link).
2. **Panel contents:** heading `Notification`, sub-label `Latest`, `SEE ALL →` pill linking
   to `/{role}/notifications`, then the **newest 5 rows** (`rows.slice(0, 5)` of the
   server order — no client re-sort, no unread-first promotion, no pagination in the panel).
   Each row shows the title and a trailing dot when `!is_read`; clicking a row calls
   `markRead(id)` when unread and then navigates `resolveNotificationLink(n, role)`.
   `markRead` is fire-and-forget but **must not float**: its rejection is swallowed
   (`.catch(() => {})`), matching the bell's existing soft-failure convention, so a failing
   mark-read never surfaces an unhandled rejection.
   Empty list → `No notifications yet.` (reuses the page's copy).
   Panel width is `w-72 sm:w-80` — a flat `w-80` clips ~18px past the left edge on the
   360px-wide mobile header, where the bell sits ~58px from the right.
3. **No new fetch, no new endpoint.** The existing single-flight module cache in
   `NotificationBell.jsx` (which lets the two co-mounted bells share one request) changes
   shape from `{ userId, unread, promise }` to `{ userId, rows, promise }`; `unread` is
   derived as `rows.filter((n) => !n.is_read).length`. Opening the panel costs zero requests,
   and the existing `NOTIFICATIONS_CHANGED` dispatch inside `markRead` refreshes both bells.
   The existing soft-failure path (`.catch → []`, no badge) and `!user → null` are unchanged.
4. **Anchor side is a prop, not a guess.** `align` defaults to `"right"` (header slot);
   `PortalLayout` passes `align="left"` for the sidebar instance, because a `w-80` panel
   anchored `right-0` inside the 256px sidebar would hang ~64px off the left viewport edge
   on super-admin desktop.
5. **Styling reuses existing chrome, not new tokens:** panel `rounded-xl border-2 border-dark-blue`
   on `bg-white shadow-lg`; rows reuse `NotificationsPage.jsx:107` item classes
   (`rounded-lg border border-dark-blue bg-white`, `text-sm font-bold text-dark-blue`);
   the unread dot is `bg-primary`. The SEE ALL pill uses the repo's primary token,
   `bg-primary/10 text-primary` (no green: the repo has no green theme token, and the
   pill is chrome, not an "approved" status).
6. **Open animation is CSS-only:** one `@keyframes dropdown-in` (opacity +
   `translateY(-4px) scale(0.97)` → none) added to `src/index.css`, applied as
   `animate-[dropdown-in_150ms_ease-out]` with `origin-top-*` matching `align`.
   Reduced motion is already handled globally (the `prefers-reduced-motion` block near the
   end of `src/index.css` clamps all animation and transition durations), so no
   per-component motion work is required.

## Consequences
- The bell no longer navigates on click; notification history is reached via SEE ALL.
  `NotificationBell.test.jsx` must be updated, not deleted — the `aria-label` contract,
  badge cap (`9+`), logged-out null render, and `NOTIFICATIONS_CHANGED` refresh tests all
  still hold and must keep passing.
- `aria-haspopup`/`aria-expanded` are honest: the panel is a plain container, not
  `role="menu"` — no arrow-key menu semantics are claimed, so none are owed.
- Escape closes the panel and returns focus to the trigger; outside `pointerdown` closes it
  (same rules as `PublicHeader.jsx`).
- Zero DB/schema change; `db/schema.sql` untouched. Zero API change. Zero new dependencies.
- Closing animates instantly (no exit transition) — deliberate; `ponytail:` comment noting
  the upgrade path if an exit animation is ever wanted.

## Hand-off
Implementation: **frontend** (`NotificationBell.jsx` + `src/index.css` keyframe +
`NotificationBell.test.jsx`). Tests: **frontend** extends the existing Vitest file;
verification on `npm test` + `npm run lint`. Review: **review**. No database agent — no DDL.
