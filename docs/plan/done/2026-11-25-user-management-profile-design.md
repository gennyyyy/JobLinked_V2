# User Management: Profile-Style Tabs — Implementation Plan

> **For agentic workers:** implement this task in one dispatch. Do not revert other agents' uncommitted work in the tree.

**Goal:** Make the User Management Users/Roles tabs use the same visual treatment as My Profile: a compact page heading and one `Panel size="sm"` card whose title and description follow the active tab, with the tab list inside it.

**Architecture:** Pure presentation change in `UserManagement.jsx` (plus the embedded `RoleManagement` wrapper spacing). Permission gating, data fetching, modals, and behavior stay exactly as they are.

**Tech Stack:** React JSX, Radix tabs, `Panel`/`PageHeading` design components, Vitest.

**Confirmed brief:** 2026-11-25, user-approved. No save button or sidebar — those are profile-page-only.

## Global Constraints

- No server, API, schema, permission, or data-fetching changes.
- Keep the existing Users/Roles permission rules and tab defaults.
- Keep nested section Panels (the admin Profile page also nests Panels inside its tab panel).
- JavaScript/JSX only. Preserve other agents' uncommitted work.

## Review Focus

- The page heading uses the profile's `compact` spacing.
- One outer Panel card holds the tab list; its title/description change with the active tab.
- Users → "User accounts"; Roles → "Roles & permissions".
- The no-access branch stays a standalone Panel with no tablist.
- All existing tab, permission, and role-CRUD tests still pass.

---

## Task — Apply the profile tab chrome

**Files:**
- Modify: `src/features/super-admin/UserManagement.jsx`
- Modify: `src/features/super-admin/RoleManagement.jsx`
- Modify: `src/features/super-admin/__tests__/UserManagement.tabs.test.jsx`

- [ ] **Step 1: Tab metadata**

Add a module-level array near `SYSTEM_ROLE_LABELS`:

```js
const MANAGEMENT_TABS = [
  { value: 'users', label: 'Users', title: 'User accounts', description: 'Find registered users and manage their role and account access.' },
  { value: 'roles', label: 'Roles', title: 'Roles & permissions', description: 'Define role bundles and review role and access changes.' },
]
```

In the component, derive:

```js
const visibleTabs = MANAGEMENT_TABS.filter((t) => (t.value === 'users' ? canUsers : canRoles))
const activeSection = visibleTabs.find((t) => t.value === tab) || visibleTabs[0]
```

- [ ] **Step 2: Wrap the tabs in the profile-style Panel**

Replace the bare `<Tabs>`/`<TabsList>` block with:

```jsx
<Tabs value={activeSection.value} onValueChange={setTab}>
  <Panel title={activeSection.title} description={activeSection.description} size="sm">
    <TabsList className="mb-3 h-auto w-full flex-wrap group-data-horizontal/tabs:h-auto">
      {visibleTabs.map((t) => (
        <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
      ))}
    </TabsList>
    {canUsers && <TabsContent value="users" className="space-y-6">…existing users content…</TabsContent>}
    {canRoles && <TabsContent value="roles" className="space-y-6">…existing roles content…</TabsContent>}
  </Panel>
</Tabs>
```

Drop the `mt-2` class from both `TabsContent` elements (the Panel and `TabsList` margins now provide the spacing).

- [ ] **Step 3: Match the page heading**

Add `compact` to the existing `<PageHeading … />` so it uses the profile page's heading spacing.

- [ ] **Step 4: Embedded RoleManagement spacing**

In `RoleManagement.jsx`, change the outer wrapper from `className="space-y-6 pb-12"` to `className={embedded ? 'space-y-6' : 'space-y-6 pb-12'}` so the embedded role content does not add page-bottom padding inside the tab panel.

- [ ] **Step 5: Update the tab test**

In `src/features/super-admin/__tests__/UserManagement.tabs.test.jsx`:
- Full-admin case: assert the panel title `User accounts` is visible on the default tab.
- Roles case: after clicking Roles, assert `Roles & permissions` is visible alongside the existing role content.
- No other assertions change.

- [ ] **Step 6: Run the tests**

Run:

`npx vitest run src/features/super-admin/__tests__/UserManagement.tabs.test.jsx src/features/super-admin/__tests__/RoleManagement.test.jsx src/features/super-admin/__tests__/UserManagement.a11y.test.jsx src/features/super-admin/__tests__/UserManagement.pagination.test.jsx src/features/super-admin/__tests__/UserManagement.invite.test.jsx src/features/super-admin/__tests__/UserManagement.accountActions.test.jsx src/features/super-admin/__tests__/UserManagement.seekerDetail.test.jsx src/shared/components/__tests__/TopNavLayout.permissions.test.jsx`

Expected: all pass.

- [ ] **Step 7: Lint and report**

Run: `npm run lint`
Expected: clean. Report changed files and exact test output.

**Acceptance:** User Management shows the profile-style compact heading and one panel card whose title/description follow the active tab; all listed tests and lint pass.
