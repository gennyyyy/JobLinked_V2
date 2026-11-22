# Password policy

Status: confirmed brief, ready for implementation
Owner: frontend
Confirmed by user: yes (8–72 chars, at least one letter and one number; all password surfaces)

## What

One password rule for the whole app:

- 8–72 characters
- at least one letter (a–z, A–Z)
- at least one number (0–9)
- symbols allowed, not required

## How

New `src/shared/utils/password.js`:

- `PASSWORD_MIN_LENGTH = 8`, `PASSWORD_MAX_LENGTH = 72`
- `PASSWORD_HINT` — one sentence for field hints ("At least 8 characters, including one letter and one number.")
- `passwordError(value)` → `''` when valid, else the first failing message:
  - required → "Password is required"
  - too short → "Password must be at least 8 characters"
  - too long → "Password must be at most 72 characters"
  - composition → "Password must include at least one letter and one number"

Replace the five duplicated `length < 8` checks (keep each surface's existing
"passwords do not match" check *after* the policy check):

1. `src/features/auth/jobSeekerRegistration.js` (`validateSignUp` password branch)
2. `src/features/auth/employerRegistration.js` (same)
3. `src/features/auth/AcceptInvite.jsx` (`handleSubmit`)
4. `src/features/auth/ResetPassword.jsx` (`handleSubmit`)
5. `src/shared/components/ChangePassword.jsx` (`handleSubmit`, Panel description)

Update hint/placeholder copy to use `PASSWORD_HINT` or equivalent text in:
`EmployerCompanyStep.jsx`, `JobSeekerPersonalStep.jsx`, `AcceptInvite.jsx`,
`ResetPassword.jsx`, `ChangePassword.jsx`.

No server route, database, or schema change: authentication is Supabase-only
(AGENTS.md). Client validation is the UX gate; the real hard limit is the
Supabase Auth project minimum-length setting and GoTrue's 72-byte bcrypt cap.

## Acceptance

- New `src/shared/utils/__tests__/password.test.js`: table test for valid,
  too short, too long, letters-only, numbers-only, missing both, empty.
- One existing registration suite gets a case: weak password (e.g. `password`)
  shows the shared message and does not submit.
- Existing tests keep passing (their fixtures like `password123` satisfy the
  rule).
- `npm test` and `npm run lint` pass.

## Out of scope

- Strength meter, password history, breach-list (k-anonymity) check.
- Supabase dashboard configuration; note the 8+ minimum as a manual step.
- Masterlist/seed passwords, which are not user-facing form input.

## Known edge

The 72 limit is checked in characters. GoTrue hashes with bcrypt (72 *bytes*),
so a password made entirely of multi-byte characters at exactly 72 chars could
still be rejected by Supabase. Its error surfaces through the existing catch.
