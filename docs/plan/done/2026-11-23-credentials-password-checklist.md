# Credentials: use the registration password checklist

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** remove the static sentence
  `At least 8 characters, including one letter, one number, and one symbol.`
  from the Credentials New password field and show the same live checklist used
  on the registration forms (`PasswordRequirements`).
- **Where:** the shared `ChangePassword` component, so job seeker, employer, and
  super-admin profiles all get it.
- **Done when:** the checklist renders under New password, updates as the user
  types, the old sentence is gone, validation/update behavior is unchanged, and
  tests/lint pass.
- **Out of scope:** password rules, the login email block, registration pages.

## Change

`src/shared/components/ChangePassword.jsx`:

- import `PasswordRequirements` from `./PasswordRequirements`;
- drop `PASSWORD_HINT` from the password-utils import (keep `passwordError`);
- New password field:
  - remove `help={PASSWORD_HINT}`;
  - wrap the field and `<PasswordRequirements value={form.next} />` in a
    fragment/div so the checklist sits directly under the input, as on
    registration.
- Keep the current/confirm fields, button, and id unchanged.

`src/shared/components/__tests__/ChangePassword.test.jsx`:

- assert the "Password requirements" list and its four labels render;
- assert the removed sentence is not rendered;
- keep the existing validation/update tests passing.

## Acceptance

`npx vitest run src/shared/components/__tests__/ChangePassword.test.jsx` then
`npm run lint`, both passing.
