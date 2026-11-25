# Super-admin profile: split name fields

- **Status:** Brief approved 2026-11-26. Ready for dispatch: `fullstack-developer`.
- **Owner of contract:** architect. No schema change. The architect updates `docs/arch/rework/02-api-contract.md` at kickoff.

## Confirmed brief

- **What:** In the super-admin Profile → Account tab, replace the single "Full Name" input with First name (required), Middle name, Last name (required), and Suffix (optional). Email Address stays read-only.
- **How:** The page sends the four components; the server derives `full_name` from them, matching `/seekers/me` and `/employers/me` (ADR-046). No browser-composed `full_name`.
- **Done when:** the super-admin can save name components, `full_name` is rebuilt server-side, the focused server + frontend tests pass, and scoped ESLint is clean.
- **Out of scope:** schema migration, splitting legacy rows that only have `full_name`, other profile pages, forcing lowercase, invite-flow changes, permission changes, renaming the test file.

## Verified contract and code facts

- `db/schema.sql` `super_admins` already has `first_name, middle_name, last_name, suffix, full_name`, all `not null default ''` (lines 107–115). No DDL.
- `GET /api/auth/me` returns `{ ...to_jsonb(s), role, permissions, custom_role_id, aal }` (`server/src/routes/auth.js:385`), so the client `user` already carries the four components.
- `PATCH /api/admin/users/:id` (`server/src/routes/admin-users.js:146-210`):
  - `EDITABLE` already includes `first_name`, `middle_name`, `last_name`, `suffix`, `full_name`.
  - `findUserTable(id)` returns `{ table, profile }`; `profile` is the role row with the components — no extra SELECT is needed.
  - It does **not** derive `full_name` today. That is the only server gap.
- Reference implementation: `server/src/routes/profiles.js:72-83` (the `NAME_FIELDS` block that rebuilds `full_name`). `buildFullName` lives in `server/src/util.js:40` and is already imported by `admin-users.js`.
- Client helpers already exist: `titleCase` (`src/shared/utils/titleCase.js`) and `buildFullName` (`src/shared/utils/names.js`, not needed by this change).
- `updateProfile(userId, patch)` (`src/shared/services/auth.js:87`) routes a super-admin to `PATCH admin/users/:id`; no service change.

## Behavior to build

### Server — derive `full_name` in `PATCH /api/admin/users/:id`

Place `const NAME_FIELDS = ['first_name', 'middle_name', 'last_name', 'suffix'];` beside `EDITABLE`. After the patch is built and validated (after the last-admin check), before `const keys = Object.keys(patch);`:

```js
if (NAME_FIELDS.some((c) => patch[c] !== undefined)) {
  patch.full_name = buildFullName(
    ...NAME_FIELDS.map((c) => (patch[c] !== undefined ? patch[c] : profile[c])),
  );
}
```

Rules:
- Any name component in the patch triggers derivation; components not sent use the stored `profile` values.
- A patch sending only `full_name` keeps the legacy verbatim behavior (no derivation).
- `buildFullName` trims and drops empty parts; no casing change in this route.
- The audit `fields` list will include `full_name`; that is correct.
- No new query, no transaction, no schema change.

### Client — `src/features/super-admin/Profile.jsx`

- Replace the single `name` state with `form = { firstName, middleName, lastName, suffix }` and `errors = { firstName, lastName }`.
- Initialize from `user.first_name`, `user.middle_name`, `user.last_name`, `user.suffix`, rendered through `titleCase` so the stored lowercase reads naturally.
- Four `TextField`s in the existing `grid gap-4 sm:grid-cols-2`:
  - First name — label "First name", required, placeholder "e.g. Juan", `autoComplete="given-name"`.
  - Middle name — label "Middle name", placeholder "e.g. Santos (optional)", `autoComplete="additional-name"`.
  - Last name — label "Last name", required, placeholder "e.g. Dela Cruz", `autoComplete="family-name"`.
  - Suffix — label "Suffix", placeholder "e.g. Jr., III (optional)", `autoComplete="honorific-suffix"`.
- Email Address keeps `type="email"`, `readOnly`, and spans the grid (`sm:col-span-2`).
- Validation on submit: first and last non-empty after trim → "Enter your first name." / "Enter your last name."; per-field errors clear on change.
- Payload: `{ first_name, middle_name, last_name, suffix }`, each trimmed. No `full_name`, no `email`, no `name`.
- Keep `updateProfile`, `refreshUser`, `saved`, `error`, and `saving` plumbing unchanged.

## Files

- Modify: `server/src/routes/admin-users.js`
- Modify: `server/src/__tests__/admin-delegation.test.js`
- Modify: `src/features/super-admin/Profile.jsx`
- Modify: `src/features/super-admin/__tests__/Profile.email.test.jsx`
- Architect: `docs/arch/rework/02-api-contract.md` (line 173; also correct the stale "allow-list from `information_schema.columns`" phrase to the explicit `EDITABLE` set).

## Tasks

### Task 1 — Server derivation + route test

**Interfaces:**
- Consumes: `findUserTable(id)` → `{ table, profile }`, `buildFullName(first, middle, last, suffix)`, the existing `EDITABLE` patch map.
- Produces: `patch.full_name` whenever a name component is patched; the response row includes the rebuilt name.

- [ ] **Step 1: Write the failing tests** in `server/src/__tests__/admin-delegation.test.js`, new describe `name components derive full_name`:
  - `it('rebuilds full_name from patched and stored components')`:
    - `sqlDb([FIND_USER, () => ({ rows: [{ tbl: 'super_admins', profile: { id: T, role: 'super-admin', status: 'active', email: 't@x.com', first_name: 'ana', middle_name: 'santos', last_name: 'cruz', suffix: 'jr.' } }] })], [UPDATE_USER, () => ({ rows: [{ id: T }] })])`
    - `const r = await patchUser(T, { first_name: 'Ana', last_name: 'Reyes' })`; expect 200.
    - Find the `UPDATE_USER` call; expect its params to be `[T, 'Ana', 'Reyes', 'Ana Santos Reyes jr.']`.
  - `it('uses stored components a patch does not send')`: patch only `{ middle_name: 'Bautista' }`; expect params `[T, 'Bautista', 'ana Bautista cruz jr.']`.
  - `it('keeps full_name verbatim when no component is patched')`: patch only `{ full_name: 'Legacy Name' }`; expect params `[T, 'Legacy Name']` and no component keys.
- [ ] **Step 2: Run and see them fail.**
  Run: `npx vitest run server/src/__tests__/admin-delegation.test.js`
- [ ] **Step 3: Implement the `NAME_FIELDS` block** in `server/src/routes/admin-users.js` exactly as specified above.
- [ ] **Step 4: Run the server test file.** Expected: green, including the existing G-02/G-05/G-07 tests.
- [ ] **Step 5: Commit** `feat(admin): derive full_name from name components on user patch`.

### Task 2 — Profile form + frontend tests

**Interfaces:**
- Consumes: `user.first_name/middle_name/last_name/suffix`, `titleCase`, `updateProfile`.
- Produces: the four-field Account form that PATCHes `{ first_name, middle_name, last_name, suffix }`.

- [ ] **Step 1: Update the failing tests** in `src/features/super-admin/__tests__/Profile.email.test.jsx`:
  - `beforeEach` user: `{ id: 'a1', first_name: 'admin', middle_name: 'santos', last_name: 'user', suffix: 'jr.', full_name: 'admin santos user jr.', email: 'admin@example.com' }`.
  - `it('renders the name components and read-only email')`: First/Middle/Last/Suffix inputs have "Admin", "Santos", "User", "Jr."; email is read-only.
  - `it('submits the four name components without full_name or email')`: set First `New`, Middle ``, Last `Name`, Suffix ``; click Save; expect `updateProfile('a1', { first_name: 'New', middle_name: '', last_name: 'Name', suffix: '' })`; assert the payload has no `full_name`, `email`, or `name`.
  - `it('requires first and last name')`: clear First → "Enter your first name." and no call; clear Last (First valid) → "Enter your last name." and no call.
  - Keep the read-only-email, security-tab, and ChangePassword tests green.
- [ ] **Step 2: Run and see them fail.**
  Run: `npx vitest run src/features/super-admin/__tests__/Profile.email.test.jsx`
- [ ] **Step 3: Implement the form** in `src/features/super-admin/Profile.jsx` per the behavior section.
- [ ] **Step 4: Run the frontend test file.** Expected: green.
- [ ] **Step 5: Commit** `feat(admin): split super-admin full name into components`.

### Task 3 — Verification

- [ ] **Step 1:** `npx vitest run server/src/__tests__/admin-delegation.test.js src/features/super-admin/__tests__/Profile.email.test.jsx` — green.
- [ ] **Step 2:** `npx eslint server/src/routes/admin-users.js server/src/__tests__/admin-delegation.test.js src/features/super-admin/Profile.jsx src/features/super-admin/__tests__/Profile.email.test.jsx` — clean.
- [ ] **Step 3:** `npm test` — no new failures. The tree currently has unrelated 5 s-timeout flakiness from another agent's in-flight work; report it, do not fix it.
- [ ] **Step 4:** `npm run lint` and `npm run build` — report results.

## Edge cases pinned by tests

- A patch touching one component keeps the stored values for the other three.
- A `full_name`-only patch (invite/legacy contract) is not rewritten.
- Empty middle/suffix save as `''`, satisfying the NOT NULL columns.
- Empty first/last never reaches the API.

## Worktree note

The tree contains another agent's uncommitted design-system edits. Build on the current content; never revert, restash, reset, or reformat unrelated changes. Committing is optional if the shared worktree would capture another agent's unfinished work — report it instead.
