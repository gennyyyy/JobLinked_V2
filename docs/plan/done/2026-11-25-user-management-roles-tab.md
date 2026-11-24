# User Management: Users + Roles Tabs — Implementation Plan

> **For agentic workers:** implement this task in one dispatch. Do not revert other agents' uncommitted work in the tree.

**Goal:** Give User Management two tabs — Users and Roles. The Roles tab holds the full Role Management content, and the standalone Role Management page, route, lazy loader, and nav item are removed.

**Architecture:** `UserManagement.jsx` keeps its user-directory logic and embeds `RoleManagement.jsx` in a `roles` `TabsContent`. A single `embedded` prop lets `RoleManagement` render without its own page heading. Tab visibility follows ADR-042 permissions; the nav item becomes any-of `users.manage` / `roles.manage`. No server, API, or schema change.

**Tech Stack:** React JSX, Radix tabs, Vitest + Testing Library.

**Confirmed brief:** 2026-11-25, user-approved. Tab order: Users, Roles. Remove the standalone Role Management page entirely (route, loader, nav item, legacy alias).

## Global Constraints

- No server, API, schema, role-permission-key, or matching changes.
- Preserve all existing user-management behavior: filters, pager, invite modal, manage-access dialog, seeker detail dialog, account actions.
- Preserve the role create/edit/delete behavior and its confirmation modal.
- The access-change history moves under the Roles tab and renders/fetches only when the admin holds `logs.view`.
- JavaScript/JSX only. Follow nearby code style.
- The worktree has other agents' uncommitted changes. Preserve them.

## Review Focus

- Full admin (`permissions == null`): both tabs, Users default, Add user visible.
- `users.manage` only: Users tab only; no roles fetch errors; Add user visible.
- `roles.manage` only: Roles tab only and active by default; no `/admin/users` request or error; Add user hidden.
- Neither key: no tabs, a clear no-access notice, no data fetches.
- Custom role created/deleted in Roles refreshes the Users tab's custom-role names and invite options.
- `/super-admin/roles` and `/admin/role-management` no longer resolve to a page; nav no longer lists Role Management.

---

## Task — Merge the pages

**Files:**
- Modify: `src/features/super-admin/UserManagement.jsx`
- Modify: `src/features/super-admin/RoleManagement.jsx`
- Modify: `src/shared/constants.js`
- Modify: `src/shared/components/TopNavLayout.jsx`
- Modify: `src/App.jsx`
- Modify: `src/shared/lib/routeLoaders.js`
- Modify tests: `src/features/super-admin/__tests__/RoleManagement.test.jsx`, `src/shared/components/__tests__/TopNavLayout.permissions.test.jsx`
- Add/modify: `src/features/super-admin/__tests__/UserManagement.tabs.test.jsx` (new) and update existing `UserManagement.*.test.jsx` mocks/assertions as needed.

**Interfaces:**
- Produces: `RoleManagement({ embedded = false, onRolesChanged })`. `embedded` hides the page heading and places "New Role" in the Custom roles panel action; `onRolesChanged` fires after a successful create/update/delete.
- Produces: nav items may declare `permissions: string[]` (any-of). Existing `permission: string` still works.
- Produces: User Management tab values `users | roles`.

- [ ] **Step 1: Nav any-of support**

In `src/shared/components/TopNavLayout.jsx`, replace the single-permission filter with an any-of filter:

```js
const canSeeItem = (item) => {
  const keys = item.permissions ?? (item.permission ? [item.permission] : [])
  return keys.length === 0 || keys.some((key) => hasPermission(user, key))
}
const navigation = (navItems || PORTAL_NAV[role] || []).filter(canSeeItem)
```

In `src/shared/constants.js`, remove the `Role Management` nav item and change User management to:

```js
{ label: 'User management', path: '/super-admin/users', icon: Users, permissions: ['users.manage', 'roles.manage'] },
```

- [ ] **Step 2: Remove the standalone page**

- `src/App.jsx`: remove the `RoleManagement` route const, the `<Route path="roles" ...>` line, and the legacy `/admin/role-management` redirect line.
- `src/shared/lib/routeLoaders.js`: remove the `/super-admin/roles` loader entry.
- Leave `RoleManagement.jsx` in place as an embedded component.

- [ ] **Step 3: Embedded RoleManagement**

In `src/features/super-admin/RoleManagement.jsx`:
- Signature: `function RoleManagement({ embedded = false, onRolesChanged })`.
- Extract the header "New Role" button into a local `newRoleButton` element.
- When `embedded`, do not render `<PageHeading>`; render `newRoleButton` as the `action` of the Custom roles `Panel` instead.
- When not embedded, keep the current `<PageHeading>` with that action (existing component tests render it directly).
- Call `onRolesChanged?.()` after successful `createRole` / `updateRole` / `deleteRole` calls.
- Update copy: "then assign it to users from the Users tab"; heading description should refer to the Users tab.
- Keep the loading skeleton, flash/error, custom-role modal, and delete confirmation unchanged.

- [ ] **Step 4: User Management tabs**

In `src/features/super-admin/UserManagement.jsx`:
- Import `hasPermission` from `@/shared/lib/permissions` and `RoleManagement` from `./RoleManagement`.
- Derive:
  - `canUsers = hasPermission(currentUser, 'users.manage')`
  - `canRoles = hasPermission(currentUser, 'roles.manage')`
  - `canHistory = hasPermission(currentUser, 'logs.view')`
- Initial tab: `users` when `canUsers`, otherwise `roles`.
- Build the visible tab list in that order; render only permitted `TabsContent`s.
- Move the six stat panels and the existing `success` / `actionError` lines into the Users tab, above the "System users" panel.
- Page heading description: mention users and role definitions. Render the "Add user" action only when `canUsers`.
- Users tab: existing search/filters/seeker filters/table/pager unchanged.
- Roles tab: `<RoleManagement embedded onRolesChanged={refreshCustomRoles} />` followed by the existing "Role and access change history" panel, rendered only when `canHistory`. The history condition is `customRoles`-independent; keep its current table/EmptyState.
- `refreshCustomRoles`: `listRoles().then(setCustomRoles).catch(() => {})`.
- Gate the data effects:
  - Users list effect (`loadUsers`) runs only when `canUsers`.
  - Initial `Promise.all` runs `loadAll` only when `canUsers`; fetch `listRoles` when `canUsers` or `canRoles` (rolesRead accepts either key); fetch `listAuditLogs` only when `canRoles && canHistory`; else resolve empty and set loading false.
  - Do not call any users endpoint for a roles-only admin.
- When neither key is held, render the heading plus a no-access notice (no tabs, no fetches).
- Keep `PageSkeleton` for the loading state of the data actually loaded. A roles-only admin should not wait on user requests.

- [ ] **Step 5: Update the RoleManagement tests**

`src/features/super-admin/__tests__/RoleManagement.test.jsx`:
- Existing standalone tests keep passing (default `embedded` false).
- Add one test: render `<RoleManagement embedded onRolesChanged={fn} />`; expect no "Role Management" page heading, a "New Role" button, and `onRolesChanged` called after a successful create/delete.

- [ ] **Step 6: Add the User Management tab tests**

Create `src/features/super-admin/__tests__/UserManagement.tabs.test.jsx` with:
- Full admin (`permissions: null` or omitted): Users and Roles tabs render; Users is active; `Add user` visible.
- Click Roles: system role cards, permission matrix, and custom roles render; user table is absent; access history panel visible when `logs.view` is held.
- `permissions: ['users.manage']`: Roles tab absent, Add user visible, `listUsers` called.
- `permissions: ['roles.manage']`: Users tab absent, Roles active, Add user absent, `listUsers` not called.
- `permissions: []`: no tablist, no-access notice, no `listUsers` call.
- Mock `listPermissions` and the other admin services in the test.

- [ ] **Step 7: Update the nav permission test**

`src/shared/components/__tests__/TopNavLayout.permissions.test.jsx`:
- Assert the "Role Management" link is gone.
- Assert "User management" is visible with `['users.manage']`, with `['roles.manage']`, and with `permissions == null`.
- Keep the existing version-skew and hidden-page assertions.

- [ ] **Step 8: Update existing UserManagement tests**

Add `listPermissions` to the admin-service mocks where the Roles tab is opened. Existing tests that stay on the Users tab should need no behavioral change; fix only what the tab wrapper or permission gating actually breaks. Do not rewrite unrelated tests.

- [ ] **Step 9: Run the tests**

Run:

`npx vitest run src/features/super-admin/__tests__/UserManagement.tabs.test.jsx src/features/super-admin/__tests__/RoleManagement.test.jsx src/features/super-admin/__tests__/UserManagement.a11y.test.jsx src/features/super-admin/__tests__/UserManagement.pagination.test.jsx src/features/super-admin/__tests__/UserManagement.invite.test.jsx src/features/super-admin/__tests__/UserManagement.accountActions.test.jsx src/features/super-admin/__tests__/UserManagement.seekerDetail.test.jsx src/shared/components/__tests__/TopNavLayout.permissions.test.jsx`

Expected: all pass.

- [ ] **Step 10: Lint and report**

Run: `npm run lint`
Expected: clean. Report changed files and exact test output.

**Acceptance:** Users and Roles tabs work with all four permission cases; Roles holds the full Role Management content plus gated history; custom-role changes refresh Users-tab role options; the standalone route/loader/nav/legacy alias are gone; listed tests and lint pass.
