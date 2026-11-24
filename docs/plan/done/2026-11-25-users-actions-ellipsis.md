# Users Actions: Centered Ellipsis — Implementation Plan

> **For agentic workers:** implement this task in one dispatch. Do not revert other agents' uncommitted work in the tree.

**Goal:** Replace the “Manage access” button in the Users table Actions column with a compact centered `…` button for every row, and center the column.

**Architecture:** Pure presentation change in `UserManagement.jsx`. The button keeps the same `openAccess` handler, self-disable rule, and an accessible name containing “Manage access”.

**Confirmed brief:** 2026-11-25, user-approved. Keep the existing View button where it already appears (job-seeker rows).

## Global Constraints

- No data, permission, dialog, or filter changes.
- Keep the self-row disable and the existing Manage access dialog.
- Keep the View button unchanged.
- Preserve other agents' uncommitted work.

## Review Focus

- Actions header and cell content are centered.
- Every row has a `…` button that opens the same Manage access dialog.
- The button’s accessible name still contains “Manage access”.
- Job-seeker rows keep View + `…`; other rows have `…` only.
- A disabled self-row still cannot open its own Manage access dialog.

---

## Task — Ellipsis action

**Files:**
- Modify: `src/features/super-admin/UserManagement.jsx`

- [ ] **Step 1: Center the column**

- Actions header: `className="text-center"` (was `text-right`).
- Actions cell: `className="text-center"`.
- Inner wrapper: `flex items-center justify-center gap-1.5` (drop wrapping/end alignment).

- [ ] **Step 2: Replace the button**

Replace the existing “Manage access” `Button` with:

```jsx
<Button
  type="button"
  variant="outline"
  size="icon"
  onClick={() => openAccess(user)}
  disabled={currentUser && user.id === currentUser.id}
  aria-label={`Manage access for ${titleCase(user.full_name) || user.email}`}
  title="Manage access"
>
  …
</Button>
```

Keep the existing View button and its `aria-label` exactly as they are.

- [ ] **Step 3: Run the tests**

Run:

`npx vitest run src/features/super-admin/__tests__/UserManagement.tabs.test.jsx src/features/super-admin/__tests__/UserManagement.a11y.test.jsx src/features/super-admin/__tests__/UserManagement.pagination.test.jsx src/features/super-admin/__tests__/UserManagement.invite.test.jsx src/features/super-admin/__tests__/UserManagement.accountActions.test.jsx src/features/super-admin/__tests__/UserManagement.seekerDetail.test.jsx`

Expected: all pass. The accessible name keeps the existing `/manage access/i` queries working.

- [ ] **Step 4: Lint and report**

Run: `npm run lint`
Expected: clean. Report changed files and exact test output.

**Acceptance:** every row shows a centered `…` action that opens the Manage access dialog; seeker rows keep View; accessible labeling, self-disable, tests, and lint all pass.
