# Remove Step 2 empty cell (employer registration)

Status: confirmed by user, ready for implementation
Owner: frontend

## Problem

`EmployerRepresentativeStep.jsx` renders First Name, Middle Name and Last Name
in one `sm:grid-cols-2` grid. The third field lands alone on the second row,
leaving a blank cell beside Last Name.

## Change (one file)

`src/features/auth/EmployerRepresentativeStep.jsx` — reflow the fields so every
row is full; all ids, names, labels, placeholders, errors and `reqMark` stay
identical:

- Row 1: First Name | Middle Name
- Row 2: Last Name | Suffix
- Row 3: Designation / Position — full width (`sm:col-span-2`)
- Row 4: Representative Mobile | Representative Email

Keep the existing `space-y-4` container and field markup. No validation, state,
payload, or other-file changes.

## Acceptance

- No empty grid cell in Step 2; the four rows above in that order.
- `npx vitest run src/features/auth/__tests__/EmployerRegister.test.jsx` keeps
  the 5 documented TermsModal failures only; the rest pass.
- `npm run lint` clean.
