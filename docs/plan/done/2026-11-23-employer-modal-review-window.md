# Employer modal: 3-business-day accreditation review

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** the employer registration confirmation modal states the PESO review window.
- **Copy:** point 3 becomes “Once verified, PESO reviews your accreditation — usually
  within 3 business days. You can post jobs after approval.”
- **Done when:** the employer modal shows the new point, the seeker modal is untouched,
  and tests/lint pass.
- **Out of scope:** success screen, email copy, other points.

## Changes

- `src/features/auth/EmployerRegister.jsx` — replace the third `points` string passed to
  `RegistrationConfirmModal` with the copy above (em dash preserved).
- `src/features/auth/__tests__/EmployerRegister.test.jsx` — update the modal-content
  assertion to match “within 3 business days”.

## Acceptance

`npx vitest run src/features/auth/__tests__/EmployerRegister.test.jsx`, then `npm test`
and `npm run lint`, all passing.
