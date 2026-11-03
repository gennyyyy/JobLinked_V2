# ADR-032 — Portal header gains an avatar + Account menu (job-seeker & employer) [ACCEPTED 2026-10-18]

## Context
ADR-030 moved job-seeker and employer onto `TopNavLayout`. Its right slot
(`TopNavLayout.jsx:49-65`) is: bell → plain name text → role label → "Sign out" icon button.
The approved reference design shows: bell → avatar → `Account ⌄` dropdown.

`TopNavLayout` is shared by two portals, so this changes chrome others depend on.

`SidebarAccount.jsx:6-10` already owns display-name resolution and initials derivation
(`full_name` → `name` → `email` → `roleLabel`, first+last, else first+last word).
`PublicHeader.jsx:18-37` already owns the dropdown mechanics (outside `pointerdown` closes,
Escape closes and returns focus to the trigger).

## Decision
1. **Extract the existing derivation, do not reimplement it:** new
   `src/shared/utils/accountName.js` exporting `displayName(user, fallback)` and
   `initialsOf(user, fallback)`, moved verbatim out of `SidebarAccount.jsx:6-10`.
   `SidebarAccount` imports it; the new menu imports it. One place owns this.
2. **New `src/shared/components/AccountMenu.jsx`** (additive; `PortalLayout` untouched):
   - Trigger: `<button type="button">` = initials avatar (`rounded-full`, `bg-accent/20
     text-accent` per `SidebarAccount.jsx:20`) + the word `Account` + `ChevronDown`,
     with `aria-expanded` / `aria-controls` (controls emitted only while open — no dangling
     IDREF) and `aria-label` = the full display name. **No `aria-haspopup`**: the panel is a
     plain container, not a menu, so no menu semantics are claimed or owed (ADR-031 precedent).
   - Panel: the account summary (display name + role label) as a non-interactive header, then
     exactly two items — **Profile** (`profileTo`) and **Sign out**. These are the two
     affordances the current header right slot already provides; nothing new is invented.
   - Mechanics copied from `PublicHeader.jsx` (outside `pointerdown`, Escape → focus trigger).
3. **`TopNavLayout` right slot becomes** `NotificationBell` + `AccountMenu`. The standalone
   name text and the standalone role label leave the header bar; the name moves into the
   avatar's `aria-label` and the panel header, the role label into the panel header, so no
   information is lost. `TopNavLayout` keeps its `roleLabel`/`profileTo` props unchanged —
   its public signature does not change, so both layouts' call sites stay as they are.
4. **The portal nav stays in the header.** The reference design's header shows only
   "How It Works ⌄" and omits Dashboard / Browse Jobs / My Applications / Employment. That
   designer's mock appears to reuse the logged-out public header; removing the portal nav
   would strand users with no route between pages. Nav is kept as-is (it already wraps).
5. **Super-admin is unaffected.** It keeps `PortalLayout` + `SidebarAccount` (ADR-030 §4).
6. Public site has no account menu and is unchanged.

## Consequences
- Seeker and employer headers look like the reference design and gain a real avatar; the
  sign-out affordance moves from a visible icon button into the dropdown.
- No API, service, schema, or dependency change. `db/schema.sql` untouched.
- **Avatar is initials, not a photo.** There is no `avatar`/`photo`/`image` column in
  `db/schema.sql`, and browser-side file storage is prohibited by repo policy. A real photo
  needs a users column plus an upload path and its own ADR — explicitly out of scope here.
- `TopNavLayout` has no dedicated test file today, so no existing test pins the name/role
  markup; a new `AccountMenu.test.jsx` covers the behaviour instead (see Hand-off).

## Hand-off
Implementation: **frontend** (`accountName.js`, `AccountMenu.jsx`, `TopNavLayout.jsx`,
`SidebarAccount.jsx` import swap). Tests: **frontend** adds `AccountMenu.test.jsx` +
`accountName.test.js`; `SidebarAccount.test.jsx` must still pass (its "Sign out" assertion
still passes — behaviour unchanged). Review: **review**.
