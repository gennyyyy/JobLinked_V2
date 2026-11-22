# Profile Credentials section: login email + password

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** every profile page's "Password settings" section is renamed
  **Credentials** and contains:
  - **Login email** — read-only, taken from the authenticated user.
  - **Password** — the existing current/new/confirm fields and update flow.
- **Where:** `src/shared/components/ChangePassword.jsx` is rendered by the job
  seeker Profile, employer CompanyProfile, and super-admin Profile, so changing
  the shared component covers all three pages at once.
- **Done when:** all three profiles show a "Credentials" panel with the
  read-only login email and the working password form; tests and lint pass.
- **Out of scope:** making the email editable, adding an email-change flow,
  changing the password API or rules, renaming the `password-settings` anchor
  id (kept for existing links), removing the email from the Account overview.

## Implementation

`src/shared/components/ChangePassword.jsx`:

- Import `useAuth` and read `const { user } = useAuth() || {}`.
- `Panel` title → `"Credentials"`, description → `"Your login email and password."`.
- Add a read-only `TextField` as the first field:
  - label `"Login email"`, `value={user?.email || ""}`, `readOnly`,
    `autoComplete="email"`, `name="loginEmail"`.
- Move `PASSWORD_HINT` from the panel description to the New password field's
  `help` prop, so the password rule remains visible.
- Keep the existing current/new/confirm fields, button, submit behavior, and
  the `id="password-settings"` anchor.

## Tests

- `src/shared/components/__tests__/ChangePassword.test.jsx`:
  - update the title assertion to "Credentials";
  - render with an `AuthContext.Provider` user and assert the "Login email"
    field shows the email and is read-only (no editing);
  - keep all password validation/update tests passing.
- Confirm the profile suites still pass (they render the shared component).

## Acceptance

`npx vitest run src/shared/components/__tests__/ChangePassword.test.jsx` plus the
three profile suites, then `npm test` and `npm run lint`, all passing. Report
commands and counts.
