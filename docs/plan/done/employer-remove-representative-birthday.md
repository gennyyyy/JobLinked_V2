# Remove representative birthday from employer registration

Status: confirmed by user, ready for implementation
Owner: frontend

## Scope (verified)

The server ignores an employer `birthdate`: the employer branch of
`POST /auth/provision` (`server/src/routes/auth.js:151-165`) inserts no
birthdate column, and `employers` has no representative birthdate in
`db/schema.sql`. No server or schema change is needed.

1. `src/features/auth/EmployerRepresentativeStep.jsx`
   - Remove the representative Birthday `<div>` (label, date input
     `repBirthdate`, error paragraph). Leave the surrounding two-column grid
     with Suffix and Designation/Position.
2. `src/features/auth/employerRegistration.js`
   - Remove `if (!values.repBirthdate) e.repBirthdate = "Birthday is required";`
   - Remove `birthdate: values.repBirthdate,` from `buildEmployerSignUpPayload`
     `extra` (dead field; the employer insert never reads it).
3. `src/features/auth/__tests__/EmployerRegister.test.jsx`
   - Remove the `fireEvent.change(... /birthday/i ...)` line from
     `fillRequired()`. No assertion references birthdate.

Do not touch the job-seeker birthday, the representative suffix/position/
mobile/email fields, server routes, schema, or migrations.

## Acceptance

- Employer registration renders no Birthday field, and submitting succeeds
  without one.
- `npx vitest run src/features/auth/__tests__/EmployerRegister.test.jsx` — the
  5 known TermsModal failures remain; all other cases pass, including the
  existing submit tests (which no longer fill a birthday).
- `npm run lint` clean.
