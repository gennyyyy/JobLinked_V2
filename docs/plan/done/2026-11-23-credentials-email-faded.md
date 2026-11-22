# Credentials login email: faded + “(read only)”

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** the Credentials login email keeps its disabled, non-clickable
  behaviour, but is slightly faded and its label reads
  **Login email (read only)**.
- **How:** `src/shared/components/ChangePassword.jsx`
  - label becomes a node: `Login email` + a muted `(read only)` hint span;
  - disabled styling becomes slightly faded instead of fully normal:
    `disabled:opacity-75 disabled:bg-input/30 disabled:cursor-default`.
- **Done when:** the hint is visible, the field is still disabled and shows the
  email, the password form is unchanged, tests/lint pass.
- **Out of scope:** editable email, email-change flow, other profile fields.

## Test

`src/shared/components/__tests__/ChangePassword.test.jsx` — match the label with
a case-insensitive regex (the accessible name now includes the hint), assert
`(read only)` is rendered, and keep the disabled/email assertions.

## Acceptance

`npx vitest run src/shared/components/__tests__/ChangePassword.test.jsx` then
`npm run lint`, both passing.
