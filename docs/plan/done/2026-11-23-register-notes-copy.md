# Registration chooser note copy

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** on `/signup` (registration chooser), add “Requires Email Verification” to
  the job-seeker card's note slot and capitalize the A in the employer note:
  “Requires PESO Accreditation”.
- **How:** add `note: 'Requires Email Verification'` to the job-seeker journey entry and
  change the employer entry's note string. The shared note slot under each full-width
  button already exists, so alignment is preserved.
- **Done when:** each card shows its note under its button; tests/lint pass.
- **Out of scope:** styling/layout changes, other pages.

## Changes (`src/features/auth/Register.jsx`)

- Job-seeker journey: `note: 'Requires Email Verification'`.
- Employer journey: `note: 'Requires PESO Accreditation'`.
- No other changes.

## Tests (`src/features/auth/__tests__/Register.test.jsx`)

- Update the employer note assertions to the new capitalization.
- Replace the “seeker slot is empty” assertion with: the job-seeker card shows
  “Requires Email Verification” in its note slot, after its button.
- Keep the full-width button assertions.

## Acceptance

`npx vitest run src/features/auth/__tests__/Register.test.jsx`, then `npm test` and
`npm run lint`, all passing.
