# Show/hide password toggles on the Reset Password screen

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** the Reset Password screen (the page reached from "Forgot password?")
  gets the same show/hide password control as the login form, one toggle per field:
  New Password and Confirm Password.
- **How:** mirror Login's `InputGroup` + `InputGroupAddon` + `InputGroupButton`
  Eye/EyeOff pattern in `src/features/auth/ResetPassword.jsx`, with separate
  `showPassword` / `showConfirm` state.
- **Done when:** each toggle changes only its own input between `password` and `text`,
  the buttons have distinct accessible names, and tests/lint pass.
- **Out of scope:** the Forgot Password email form (no password box), Login,
  ChangePassword, shared-component extraction.

## Changes (`src/features/auth/ResetPassword.jsx`)

- Import `Eye`/`EyeOff` from lucide and `InputGroupAddon`/`InputGroupButton` from
  `@/components/ui/input-group`.
- Add `const [showPassword, setShowPassword] = useState(false)` and
  `const [showConfirm, setShowConfirm] = useState(false)`.
- New Password input: `type={showPassword ? 'text' : 'password'}` plus an
  `InputGroupAddon align="inline-end"` button:
  `type="button"`, `size="icon-sm"`,
  `aria-label={showPassword ? 'Hide new password' : 'Show new password'}`.
- Confirm Password input: same with `showConfirm` and
  `aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}`.
- Nothing else changes (validation, layout, copy, submit flow).

## Tests (`src/features/auth/__tests__/ResetPassword.test.jsx`)

- New test: both inputs start `type="password"`; clicking "Show new password"
  switches only the New Password input to `text` (confirm stays `password`) and the
  button label becomes "Hide new password"; clicking again restores `password`.
- New test (or same): the Confirm toggle does the same for its own field.
- Existing tests stay as they are and must keep passing.

## Acceptance

`npx vitest run src/features/auth/__tests__/ResetPassword.test.jsx`, then
`npm test` and `npm run lint`, all passing. Report commands and counts.
