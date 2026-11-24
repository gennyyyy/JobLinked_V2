# Users Actions Menu + All-Role Detail View — Implementation Plan

> **For agentic workers:** implement this task in one dispatch. Do not revert other agents' uncommitted work in the tree.

**Goal:** Replace the Users table View + `…` buttons with one centered `…` dropdown per row containing View details and Manage access, and make View details work for employer, super-admin, and job-seeker rows.

**Architecture:** Presentation and read-only UI in `UserManagement.jsx`. The dropdown reuses the existing `openDetail`/`openAccess` handlers. The detail dialog branches by `detailUser.role`; only job seekers trigger the four child record fetches. Employer/admin details come from the row the list already loaded.

**Confirmed brief:** 2026-11-25, user-approved. No server, API, or schema changes.

## Global Constraints

- Keep the Manage access dialog, account actions, and all permissions/behavior unchanged.
- Do not remove any existing seeker detail content.
- Keep the Actions column centered.
- Preserve other agents' uncommitted work.
- JavaScript/JSX only.

## Review Focus

- One centered `…` trigger per row; no separate View button.
- Menu items: View details, separator, Manage access; Manage access disabled on the current admin’s own row; View still available there.
- Employer View shows company/representative/address/accreditation fields from the row and makes no seeker child calls.
- Super-admin View shows account/custom-role details and makes no seeker child calls.
- Seeker View keeps the existing tabs/resumes and still loads them.
- Existing access/account-action flows still open from the menu.

---

## Task — Ellipsis menu and role-aware details

**Files:**
- Modify: `src/features/super-admin/UserManagement.jsx`
- Modify tests: `UserManagement.accountActions.test.jsx`, `UserManagement.a11y.test.jsx`, `UserManagement.pagination.test.jsx`, `UserManagement.seekerDetail.test.jsx`

- [ ] **Step 1: Import the menu**

Add to the existing `@/components/ui` imports:

```js
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
```

- [ ] **Step 2: Replace the Actions cell content**

In the Actions `TableCell` (already `text-center`), remove the View button and the current `…` button. Render:

```jsx
<div className="flex justify-center">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Actions for ${titleCase(user.full_name) || user.email}`}
        title="Actions"
      >
        …
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="center">
      <DropdownMenuItem onSelect={() => openDetail(user)}>View details</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => openAccess(user)}
        disabled={currentUser && user.id === currentUser.id}
      >
        Manage access
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

- [ ] **Step 3: Gate the seeker child fetches**

In the `detailUser` effect, return early unless `detailUser.role === 'job-seeker'`:

```js
if (!detailUser || detailUser.role !== 'job-seeker') return undefined
```

No other effect change.

- [ ] **Step 4: Make the detail dialog role-aware**

Inside the details `Dialog`:
- Compute `isSeeker = detailUser?.role === 'job-seeker'`.
- Title:
  - seeker: `Job seeker profile — {name}`
  - employer: `Employer profile — {name}`
  - super-admin: `Administrator profile — {name}`
- Description:
  - seeker: current education/experience/employment/resume copy.
  - employer: `Company, representative, address, and accreditation details.`
  - super-admin: `Account details and assigned custom role.`
- Content:
  - Seeker: keep the current `detailError` / loading / tabs / resumes block unchanged.
  - Non-seeker: no loading state. Render a `<ul className="flex flex-col gap-3">` of `DetailRecord` cards built from `detailUser`:
    - Account: Full name, Email, System role (`SYSTEM_ROLE_LABELS`), Custom role (`customRoles.find(...)?.name || 'None'`), Account status, Registered, Last updated.
    - Employer only, second card: Company name, Industry, Company email, Website, Representative (`full_name`), Representative position, Representative email, Representative phone, Address (join `house_number_unit`, `street_address`, `subdivision_building`, `barangay_district`, `city_municipality`, `province_state`, `postal_code` with `, `), Accreditation status (`titleCase(...) || 'Not submitted'`), Description.
    - Super-admin shows the Account card only.
  - Use `titleCase` for names/company/industry/address values where the row is stored lowercased; use `formatDetailDate` for dates.

- [ ] **Step 5: Update the tests**

- `UserManagement.accountActions.test.jsx` and `UserManagement.a11y.test.jsx`: open `Actions for <name>`, then click the `Manage access` menu item.
- `UserManagement.pagination.test.jsx`: open the first row’s `Actions for …` menu, then `Manage access`.
- `UserManagement.seekerDetail.test.jsx`: open `Actions for Ben Cruz`, then `View details` for the seeker flow.
- Add to `UserManagement.seekerDetail.test.jsx`:
  - An employer row with `company_name`, `industry`, `representative_position`, `accreditation_status`; open its Actions → View details; assert the company/accreditation text is shown and `listSeekerResumes` was not called.
  - A super-admin row with a `custom_role_id` matching a mocked custom role; open Actions → View details; assert the custom role name is shown.
- Keep all other assertions unchanged.

- [ ] **Step 6: Run the tests**

Run:

`npx vitest run src/features/super-admin/__tests__/UserManagement.tabs.test.jsx src/features/super-admin/__tests__/UserManagement.a11y.test.jsx src/features/super-admin/__tests__/UserManagement.pagination.test.jsx src/features/super-admin/__tests__/UserManagement.invite.test.jsx src/features/super-admin/__tests__/UserManagement.accountActions.test.jsx src/features/super-admin/__tests__/UserManagement.seekerDetail.test.jsx`

Expected: all pass.

- [ ] **Step 7: Lint and report**

Run: `npm run lint`
Expected: clean. Report changed files and exact test output.

**Acceptance:** each row has one centered `…` menu with View details and Manage access; View works for every role; non-seeker views make no seeker child calls; seeker views are unchanged; tests and lint pass.
