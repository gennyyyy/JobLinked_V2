# Credentials login email: looks like a field, cannot be clicked

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** the read-only Login email in the Credentials panel stays visually a
  normal text field but is fully non-interactive: no click, focus, caret, or
  selection. It remains the authenticated user's email.
- **How:** render the existing `TextField` as `disabled` and override the
  disabled styling so it keeps the normal input look
  (`disabled:opacity-100 disabled:bg-transparent disabled:cursor-default`).
  Remove the now-redundant `readOnly`.
- **Done when:** the field shows the email, is disabled/non-focusable, looks like
  the other inputs, and tests/lint pass.
- **Out of scope:** making it editable, an email-change flow, the Account
  overview email.

## Change

`src/shared/components/ChangePassword.jsx` — Login email `TextField`:
`disabled`, `className="disabled:opacity-100 disabled:bg-transparent disabled:cursor-default"`,
keep label/name/type/value/autoComplete; drop `readOnly`.

`src/shared/components/__tests__/ChangePassword.test.jsx` — assert the field is
disabled (`toBeDisabled`) and still shows the email; remove the `readonly`
attribute assertion.

## Acceptance

`npx vitest run src/shared/components/__tests__/ChangePassword.test.jsx` then
`npm run lint`, both passing.
