# Navbar: remove account dropdown, promote Sign out to a button

Approved: 2026-11-28 (bounded change, user confirmed the design in chat).

## What

In the portal top bar, the account indicator no longer opens a dropdown. Sign out
becomes a visible button next to the account indicator. The dropdown's other two
items (Account settings, Public website) are dropped as redundant: account settings
are reachable from each portal's profile/settings sidebar entry, and the logo
already links to `/`.

## How

File: `src/shared/components/TopNavLayout.jsx`

- Replace the `DropdownMenu` block (trigger + content around lines 277-312) with:
  - a non-interactive account indicator: `Avatar` + the existing name/role/permission
    text block, no `ChevronDown`, no trigger button;
  - a ghost `Button` to its right: `LogOut` icon + `Sign out` label, label
    `hidden sm:inline` (icon-only on mobile), `aria-label="Sign out"`,
    `onClick={handleLogout}`.
- Remove now-unused imports: `ChevronDown`, `Settings`, and all `DropdownMenu*`
  imports. Keep `ArrowUpRight` (still used by search results) and `Button`/`Avatar`.
- Remove the now-unused `profileTo` prop from `TopNavLayout` and from its three
  call sites (`JobSeekerLayout.jsx`, `EmployerLayout.jsx`, `SuperAdminLayout.jsx`).
  Keep `homeTo` (still used by the breadcrumb).

File: `src/shared/components/__tests__/PortalLayout.test.jsx`

- The AFK-modal test matches `/sign out/i` and would now find two buttons. Scope
  that lookup to the dialog (`within(screen.getByRole('dialog'))`).
- Add one test: the header renders exactly one Sign out button and clicking it
  calls `logout` (mock resolved), with no modal open.

## Done when

- `npx vitest run src/shared/components/__tests__/PortalLayout.test.jsx` passes.
- `npm test` passes.
- `npm run lint` passes.
- Manual: header shows avatar + name and a Sign out button; no chevron; clicking
  sign out ends the session (same `handleLogout` path as before).

## Out of scope

- No change to AFK modal, auth, routes, sidebar, or any other component.
- No new dependencies.
