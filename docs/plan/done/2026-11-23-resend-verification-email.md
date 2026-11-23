# Resend verification email on the registration success screen

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** offer a **Resend verification email** button in two places:
  1. the "Check your email. / One more step to activate your account." registration
     success screen, for both job-seeker and employer registration;
  2. the login form after a sign-in attempt fails because the account's email is not
     verified (`EMAIL_NOT_VERIFIED`), resending to the attempted email address.
- **How:** call Better Auth's `POST /send-verification-email` through the auth client;
  one shared small component for both screens; 60 s cooldown after a successful send.
  No server or schema change, no captcha (BA's captcha covers sign-up/sign-in/reset;
  this endpoint is rate-limited server-side to 3 per minute).
- **Done when:** resend sends to the address that just registered (or the attempted
  login address after an unverified sign-in), success and failure are visible/announced,
  the button cannot be spammed (sending + 60 s countdown), and focused tests, full
  suite, and lint pass.
- **Out of scope:** editing the email on the success screen or login form, resend from
  profile, server changes, resend when confirmation is not required.

## Changes

### `src/shared/services/auth.js`

Add `resendVerificationEmail(email)`:

```js
export async function resendVerificationEmail(email) {
  let result;
  try {
    result = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/auth/callback`,
    });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
}
```

Also preserve the error code for the login branch: in `friendlyAuthError`, the
`EMAIL_NOT_VERIFIED` case must return the friendly `Error` with `err.code =
'EMAIL_NOT_VERIFIED'` attached (same message as today). No other error mapping changes.

### `src/test/authClientMock.js`

Add `sendVerificationEmail: vi.fn()` to the mock, reset it in `resetAuthClient`, and
default it to `{ data: { status: true }, error: null }`.

### `src/features/auth/VerificationResend.jsx` (new)

- Props: `email`.
- Renders nothing when `email` is empty.
- Idle button: `Resend verification email` (`Button variant="outline" size="sm"` or
  equivalent); label `Sending…` while in flight; after success `Resend in Ns`, disabled
  until a 60 s countdown ends.
- On success: status line, `role="status"`, "Verification email sent. Check your inbox."
- On failure: `role="alert"` with the message from the service (429 already maps to the
  friendly "wait a moment" text) and the button re-enabled.
- Cleanup the interval on unmount; guard against double-clicks.

### Screens

- `src/features/auth/JobSeekerRegisterSuccess.jsx`: when `needsConfirmation`, render
  `<VerificationResend email={submittedEmail} />` after the Notice, before Sign In.
- `src/features/auth/EmployerRegister.jsx`: store `setSubmittedEmail(account.email)` on
  success and pass it through.
- `src/features/auth/EmployerRegisterSuccess.jsx`: accept `submittedEmail`, render the
  same component when `needsConfirmation`. Leave the existing copy otherwise.
- `src/features/auth/Login.jsx`: add an `unverifiedEmail` state; clear it at the start
  of each submit. In the submit catch, after the existing `needsProvision` branch, set
  it to `email.trim()` when `err.code === 'EMAIL_NOT_VERIFIED'`. Render
  `<VerificationResend email={unverifiedEmail} />` directly below the existing error
  line when it is set. The error message itself stays unchanged.

## Tests

- `src/shared/services/__tests__/auth.test.js`: resend calls
  `authClientMock.sendVerificationEmail` with the email and a `/auth/callback`
  `callbackURL`; a 429 error maps to the friendly rate-limit message; a returned
  `{ error }` is thrown.
- `src/features/auth/__tests__/VerificationResend.test.jsx` (new, fake timers): click
  calls the service with the email; success shows the status and disables with a
  countdown; after 60 s the button re-enables; a rejected call shows an alert and
  re-enables.
- Update `JobSeekerRegister.test.jsx` and `EmployerRegister.test.jsx` only as needed to
  assert the resend control appears on the confirmation variant and that the employer
  screen receives the registered email. Keep existing assertions intact.
- `src/features/auth/__tests__/Login.test.jsx`: extend the unverified-account test to
  assert the resend control appears after the `EMAIL_NOT_VERIFIED` failure, and that
  clicking it calls `authClientMock.sendVerificationEmail` with `new@test.com` and a
  `/auth/callback` `callbackURL`. The existing message assertion stays.

## Acceptance

`npx vitest run` for the three touched suites, then `npm test` and `npm run lint`, all
passing. Report commands and counts.
