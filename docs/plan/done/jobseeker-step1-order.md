# Job-seeker Step 1 field order

Status: confirmed by user, ready for implementation
Owner: frontend

## Change

In `src/features/auth/JobSeekerPersonalStep.jsx`, swap the two blocks at the
end of Step 1:

- Move the Employment Status block (currently lines ~94-101) above the
  password grid.
- The password + confirm-password grid becomes the final block of Step 1.

Keep password and confirm together as the two-column grid; keep all ids,
names, labels, error handling, and the `PasswordRequirements` checklist as is.
No state, validator, or submit changes.

## Acceptance

- Employment Status renders immediately after the mobile/email row.
- Password + Confirm Password render last in Step 1.
- `npx vitest run src/features/auth/__tests__/JobSeekerRegister.test.jsx`
  passes; `npm run lint` clean.
- No other files touched.
