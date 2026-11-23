# No Next button on the final registration step

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** the final step of both registration forms shows only Back plus the submit
  action — never Next.
- **Finding:** the employer form already renders Next only on step 0. The job-seeker
  form renders Next on every step, so on its final review step it shows both Next and
  Create Account.
- **How:** gate the job-seeker Next button on `step < TOTAL_STEPS - 1`; add a regression
  assertion to both forms' tests.
- **Done when:** the job-seeker final step has Back + Create Account only; the employer
  final step has Back + Submit Accreditation Application only; tests/lint pass.
- **Out of scope:** validation, step logic, copy, styling, submit handlers.

## Changes

### `src/features/auth/JobSeekerRegister.jsx`

Wrap the Next button in `{step < TOTAL_STEPS - 1 && ( ... )}`. Keep Back and Create
Account exactly as they are.

### `src/features/auth/EmployerRegister.jsx`

No production change — verify it still renders Next only on step 0.

## Tests

- `src/features/auth/__tests__/JobSeekerRegister.test.jsx`: new test — on step 1 Next is
  present; after `fillRequired()` (final step) Next is absent and Create Account is
  visible.
- `src/features/auth/__tests__/EmployerRegister.test.jsx`: new test — after
  `fillRequired()` (final step) Next is absent and Submit Accreditation Application is
  visible.
- Existing tests unchanged.

## Acceptance

Focused runs for both suites, then `npm test` and `npm run lint`, all passing.
