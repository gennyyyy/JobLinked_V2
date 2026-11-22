# Credentials login-email label spacing + capitalization

Status: approved 2026-11-23 — queued behind the in-flight password-checklist change.

## Confirmed brief

- **What:** the `(read only)` hint sits too far from the label, and the label
  should read **Login Email** (capital E).
- **Why it is far:** `FieldLabel` is a flex row with `gap-2`; the fragment label
  made the text and hint separate flex items, plus the hint had `ml-1`.
- **How:** `src/shared/components/ChangePassword.jsx`
  - make the label one wrapper span:
    `<span>Login Email <span className="text-xs font-normal text-muted-foreground">(read only)</span></span>`
  - remove the fragment layout and `ml-1`, so the only space is the normal text
    space before the hint.
- **Done when:** the hint is visually tight against the label, capitalization is
  `Login Email`, and tests/lint pass.
- **Out of scope:** the disabled field, helper line, password checklist.

## Test

`src/shared/components/__tests__/ChangePassword.test.jsx` already matches the
label with `/login email/i` and asserts `(read only)`; no assertion change is
needed unless the accessible name changes unexpectedly.

## Acceptance

`npx vitest run src/shared/components/__tests__/ChangePassword.test.jsx` then
`npm run lint`, both passing.
