# Password symbol requirement

Status: confirmed brief, ready for implementation
Owner: frontend
Confirmed by user: yes (any non-alphanumeric, non-whitespace character counts as a symbol)
Amends: `docs/plan/done/password-policy.md`

## Change

Composition rule becomes: at least one letter, one number, and one symbol.
A symbol is any character that is not a letter, digit, or whitespace.
Bounds stay 8–72 characters; symbols were already permitted.

- `PASSWORD_HINT` → "At least 8 characters, including one letter, one number, and one symbol."
- `passwordError` failure message → "Password must include at least one letter, one number, and one symbol." (one combined message; check order stays required → min → max → composition)

All five surfaces already call `passwordError` and `PASSWORD_HINT`, so no
component logic changes — only the shared module and its test.

## Test fixture updates

Any test that submits through the validators and uses a letter+number-only
password must add a symbol (`password123` → `password123!`):

- `src/features/auth/__tests__/JobSeekerRegister.test.jsx`
- `src/features/auth/__tests__/EmployerRegister.test.jsx`
- `src/features/auth/__tests__/AcceptInvite.test.jsx`
- `src/features/auth/__tests__/ResetPassword.test.jsx`
- `src/shared/components/__tests__/ChangePassword.test.jsx`
- `src/features/auth/__tests__/scrollToError.test.jsx`
- `src/features/auth/__tests__/termsGate.test.jsx`
- `src/shared/utils/__tests__/password.test.js`

Do not change login fixtures or `src/shared/services/__tests__/auth.test.js`
(they bypass validators). Existing account passwords stay valid: the rule
applies only when a password is set.

## Acceptance

- `password.test.js` covers: valid with symbol; letter+number only rejected;
  symbol+number but no letter rejected; symbol+letter but no number rejected;
  whitespace does not satisfy the symbol rule; hint string updated.
- The listed suites pass and `npm run lint` is clean.
- Unrelated pre-existing `EmployerRegister` failures caused by another agent's
  uncommitted `TermsModal` work stay untouched (documented in
  `docs/plan/2026-11-20-peso-revision-verification.md:3`).

## Out of scope

Server, database, Supabase configuration, strength meter. Supabase's own
project policy cannot enforce composition, so this remains the UX gate.
