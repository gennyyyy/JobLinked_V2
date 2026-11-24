# Users Table Fit + Pagination Match — Implementation Plan

> **For agentic workers:** implement this task in one dispatch. Do not revert other agents' uncommitted work in the tree.

**Goal:** On the User Management Users tab, fit all 11 table columns without horizontal scrolling at laptop/desktop widths, and use the same centered `Pager` design as Browse Jobs.

**Architecture:** Pure presentation change in `UserManagement.jsx`: fixed-layout table with percentage column widths, wrapping cells, compact action buttons, and `Pager align="center"`. No data, permission, or behavior change.

**Tech Stack:** React JSX, shadcn `Table`, shared `Pager`, Tailwind classes.

**Confirmed brief:** 2026-11-25, user-approved. Laptop/desktop (~960px content and up) shows every column; below that the table keeps horizontal scrolling.

## Global Constraints

- Keep all 11 columns and all existing cells/actions.
- No server, API, permission, data-fetching, or pagination-behavior changes.
- Preserve other agents' uncommitted work.
- JavaScript/JSX only.

## Review Focus

- Every column header remains visible and wraps instead of forcing width.
- UUIDs and emails wrap inside their cells; rows may grow taller.
- Action buttons stay usable in the narrow Actions column (compact, wrap/stack).
- Pager matches Browse Jobs: centered range plus previous/next controls.
- Below ~960px the table scrolls horizontally rather than squashing.

---

## Task — Fit the table and center the pager

**Files:**
- Modify: `src/features/super-admin/UserManagement.jsx`

- [ ] **Step 1: Fixed-layout table**

In the Users tab, replace the outer `<div className="overflow-x-auto">` with a plain `<div>` (the `Table` component already provides its own scroll container). Change the table opening to:

```jsx
<Table className="min-w-[960px] table-fixed">
  <colgroup>
    <col className="w-[8%]" />   {/* User ID */}
    <col className="w-[8%]" />   {/* Full name */}
    <col className="w-[11%]" />  {/* Email address */}
    <col className="w-[8%]" />   {/* Assigned role */}
    <col className="w-[9%]" />   {/* Account status */}
    <col className="w-[8%]" />   {/* Barangay / district */}
    <col className="w-[8%]" />   {/* Employment status */}
    <col className="w-[9%]" />   {/* Preferred position */}
    <col className="w-[8%]" />   {/* Registered */}
    <col className="w-[8%]" />   {/* Last updated */}
    <col className="w-[15%]" />  {/* Actions */}
  </colgroup>
  <TableHeader className="[&_th]:whitespace-normal">
    …
  </TableHeader>
  …
</Table>
```

- [ ] **Step 2: Let cells wrap**

- User ID cell: add `break-all` alongside the existing `whitespace-normal text-[10px]`.
- Full name: add `break-words`.
- Email keeps `whitespace-normal break-all`.
- The three seeker columns: add `break-words` alongside `whitespace-normal`.
- Registered / Last updated cells: add `whitespace-normal`.
- Everything else stays the same.

- [ ] **Step 3: Compact actions**

In the Actions cell:
- Change the inner wrapper to `flex flex-wrap justify-end gap-1.5`.
- Add `size="sm"` to both `View` and `Manage access` buttons.
- Keep the existing `aria-label` on View and the self-disable on Manage access.

- [ ] **Step 4: Center the pager**

Change the Users-tab pager to match Browse Jobs:

```jsx
<Pager page={page} pageSize={pageSize} total={total} onChange={setPage} align="center" />
```

- [ ] **Step 5: Run the tests**

Run:

`npx vitest run src/features/super-admin/__tests__/UserManagement.tabs.test.jsx src/features/super-admin/__tests__/UserManagement.a11y.test.jsx src/features/super-admin/__tests__/UserManagement.pagination.test.jsx src/features/super-admin/__tests__/UserManagement.invite.test.jsx src/features/super-admin/__tests__/UserManagement.accountActions.test.jsx src/features/super-admin/__tests__/UserManagement.seekerDetail.test.jsx`

Expected: all pass. No test edits should be required; adjust only assertions that the presentation change actually breaks.

- [ ] **Step 6: Lint and report**

Run: `npm run lint`
Expected: clean. Report changed files and exact test output.

**Acceptance:** at laptop/desktop width all 11 columns are visible without horizontal scrolling; long values wrap; action buttons remain usable; the pager is centered like Browse Jobs; listed tests and lint pass.
