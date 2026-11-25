# Tabs list: match the card/container grey border

**Status:** approved by user 2026-11-26 (request: the super-admin User Management tab strip
should have a grey border like the other containers and cards).

## Problem

`TabsList` (`src/components/ui/tabs.jsx`) renders the default variant with `bg-muted` but no
border. Every card/container in the portal (`.surface`) uses `border` (mapped to the grey
`--border` token globally). The segmented tab control therefore reads as a floating pill.

## Scope

- `src/components/ui/tabs.jsx`, `tabsListVariants` default variant: add `border border-border`
  alongside `bg-muted`. One line, no new variant.
- This fixes the User Management tab strips (users/roles and the inner list) and the shared
  `TabbedProfileLayout` tabs at the same time — the responsible layer owns the style.
- Leave the `line` variant untouched (transparent, borderless by design, currently unused).

No changes to `UserManagement.jsx`, tests, or other components. The `* { @apply border-border }`
rule in `index.css` already colors a bare `border`, but keep `border-border` explicit like
`.modal-panel` so the intent survives theme changes.

## Amendment — account status badge tones (same request)

`StatusBadge` (`src/shared/components/design.jsx`) matches exact Title Case strings against its
tone lists. Account rows carry lowercase values (`user.status === 'active'`), so both **active**
and **suspended** currently fall through to the blue `bg-blue-soft` badge.

- Normalize for matching: trim, lowercase, collapse `_`/`-` to spaces.
  `good = approved, published, hired, active, accepted, placed`;
  `pending = pending review, under review, resubmission requested, draft, pending`;
  `bad = rejected, removed, flagged, suspended, revoked`.
- Display the normalized value title-cased ("active" → "Active", "under_review" → "Under Review").
  Existing Title Case call sites render identically.
- This fixes User Management and any other raw-status caller (applications, employment) in the
  same place; no call-site edits.
- Add `src/shared/components/__tests__/StatusBadge.test.jsx` with one focused test: `active` →
  success tone and text "Active", `suspended` → danger tone, `Pending Review` → warning tone.

## Amendment 2 — lock the Manage access "User ID" field

`UserManagement.jsx:750` renders `<TextField label="User ID" readOnly … />`. A readOnly input is
still focusable and clickable — the cursor lands in it. The ID is reference data, not an input.

- Render it `disabled` instead of `readOnly`: `<TextField label="User ID" value={accessTarget?.id || ''} disabled />`.
  The shared `Input` already styles `disabled:pointer-events-none disabled:cursor-not-allowed
  disabled:bg-input/50 disabled:opacity-50`, so it cannot be clicked or focused.
- Add one assertion to `UserManagement.accountActions.test.jsx`: after `openActions()`,
  `expect(screen.getByLabelText('User ID')).toBeDisabled()`.

## Amendment 3 — move "Add user" into the System users panel

The invite button currently sits in the `PageHeading` action, above the tabs. Move it into the
"System users" `Panel`, which already renders `action` in its top-right `CardAction` slot.

- `UserManagement.jsx`: delete the `action` prop from the page-level `PageHeading`; add
  `action={<Button type="button" onClick={() => { setActionError(''); setShowInvite(true) }}>Add user</Button>}`
  to the `Panel title="System users"` element (inside the `canUsers` block, so no extra guard).
- The button therefore appears only on the Users tab, top-right of that container. Roles tab
  keeps no Add user button (confirmed intent: it belongs to the users container).
- Existing `UserManagement.invite.test.jsx` queries by button name and must keep passing.

## Amendment 4 — Add user into the filter row (supersedes Amendment 3 placement)

User wants the button next to the filters, not in the Panel header.

- `UserManagement.jsx`: remove the `action` prop from the `Panel title="System users"`.
- Shorten the search: pass `className="sm:max-w-sm"` to `<SearchInput …>` (its root is
  `min-w-0 flex-1`, so the cap frees the horizontal space).
- In the same `mb-5 flex … sm:flex-row sm:items-end` row, after the `sm:w-44` "Account status"
  block, append:
  `<Button type="button" className="sm:shrink-0" onClick={() => { setActionError(''); setShowInvite(true) }}>Add user</Button>`
  The row's `sm:items-end` plus the button's `h-11` default aligns it with the fields.
- Below `sm` the row stacks; the button stretches full width like the selects.

Existing invite/tabs tests query by name and must keep passing.

## Amendment 5 — full-width filter row (supersedes the search cap)

The `sm:max-w-sm` cap left dead space after the button. Remove it: `SearchInput`'s existing
`flex-1` then absorbs all leftover width, so the row always spans the container while the button
stays immediately right of the Account status select. No other change.

## Done when

- The default `TabsList` computes `border` + `border-border` classes in every usage.
- `StatusBadge` renders `active` green, `suspended` red, `Pending Review` amber, and any raw
  snake_case value title-cased.
- `npx vitest run src/components/ui src/shared/components/__tests__/StatusBadge.test.jsx` and
  `npm run lint` pass.
