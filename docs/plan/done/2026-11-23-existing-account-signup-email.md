# Existing-account email on duplicate signup

- Date: 2026-11-23
- Owner: backend
- Status: approved by user request

## Confirmed brief

- **What:** when someone tries to register an email that already exists, send
  that address: “You already have an account — log in or reset your password.”
  The HTTP response stays the generic Better Auth success so the endpoint does
  not become an account-enumeration oracle.
- **How:** use Better Auth's `emailAndPassword.onExistingUserSignUp` hook, add a
  mailer function for this message, and add a 10-minute per-address cooldown so
  repeated duplicate signups cannot email-bomb an inbox.
- **Done when:** a duplicate signup sends one email to the existing address with
  working `/login` and `/forgot-password` links; the HTTP response is unchanged;
  tests + lint pass.
- **Out of scope:** changing signup UI copy, revealing existence/verification
  status in the response, schema changes, or per-email limits on the existing
  verification/reset endpoints.

## Changes

1. New `server/src/appOrigin.js`
   - Export the existing one-liner from `server/src/routes/admin-users.js`:
     first `CORS_ORIGIN` entry, trimmed.
   - Update `admin-users.js` to import it; no behavior change.

2. `server/src/mailer.js`
   - Generalize `deliver` to accept an explicit `text` body (keep the current
     single-URL behavior for verification/reset).
   - Add `sendExistingAccountEmail({ user })`:
     - Recipient: `user.email`.
     - Subject: `You already have a JobLinked account`.
     - Body: sign-in link, reset-password link, and “If you didn’t try to
       register, you can ignore this email.”
     - Links use `appOrigin()` (`/login`, `/forgot-password`).
     - 10-minute in-memory cooldown keyed by lowercased email. `ponytail:`
       comment: single process; move to Redis/DB if the API is multi-instance.
   - When `SMTP_HOST` is unset in dev, the `dev_mail` log includes the body so
     the E2E harness can assert both links.
   - On send failure, include `responseCode`, `command`, and a 200-char
     sanitized `response` in `mail_failed` (the 550 domain failure was otherwise
     invisible).

3. `server/src/ba.js`
   - Import `sendExistingAccountEmail`.
   - Add under `emailAndPassword`:
     ```js
     onExistingUserSignUp: async ({ user }) => {
       await sendExistingAccountEmail({ user });
     },
     ```
   - The hook runs for both verified and unverified existing accounts.

## Tests

`server/src/ba.test.js` (existing mailer/auth test file):

- `sendExistingAccountEmail` with `SMTP_HOST` unset logs `dev_mail` with
  `kind: 'existing_account'`, the recipient, and both `/login` and
  `/forgot-password` URLs.
- Calling it twice for the same address logs only one send (cooldown).
- `auth.options.emailAndPassword.onExistingUserSignUp` is wired; invoking it
  sends through the mailer (same `dev_mail` assertion).
- Optional: a mocked transport failure logs `mail_failed` with `responseCode`,
  `command`, and `response`, without exposing credentials.

## Acceptance

```powershell
cd server
npx vitest run src/ba.test.js
cd ..
npm run lint
```

## Security notes

- The duplicate signup HTTP response and timing remain generic.
- The email goes only to the address on the existing account, never to the
  requester.
- The per-address cooldown is 10 minutes; the signup route’s existing 3/10s IP
  limiter remains the outer bound.
- Do not include the account’s verification state in the email.
