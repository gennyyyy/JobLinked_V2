# Email verification / reset password rate limiting

- Date: 2026-11-23
- Owner: fullstack-developer
- Status: approved (user chose 3/60 server + 60s button cooldown)

## Confirmed brief

- **What:** a user must not be able to rapid-fire "Send reset link" or
  "Resend verification email". The reset page currently has no cooldown; the
  verification resend already holds for 60s.
- **How:** keep Better Auth's server rule at **3 requests per 60 seconds per IP**
  for `/send-verification-email` and `/request-password-reset`, pin it explicitly
  in `ba.js`, and apply a **60-second button cooldown** in both UI paths. A 429
  from the server also starts the cooldown.
- **Done when:** both buttons disable for 60s after a successful send and after
  a 429, show a countdown, and focused tests + lint pass.
- **Out of scope:** per-email throttling, database schema changes, CAPTCHA,
  changing the signup endpoint's existing limit, or a new server-side store.

## Changes

1. `server/src/ba.js`
   - Replace `rateLimit: { enabled: true }` with an explicit policy:
     ```js
     rateLimit: {
       enabled: true,
       customRules: {
         '/send-verification-email': { window: 60, max: 3 },
         '/request-password-reset': { window: 60, max: 3 },
       },
     }
     ```
   - This matches Better Auth's current default but pins it across upgrades.

2. `src/shared/services/auth.js`
   - In `friendlyAuthError`, keep the rate-limit signal on the thrown error:
     set `code = 'RATE_LIMITED'` and `status = 429` on the existing friendly
     "Too many attempts" error. Other callers are unaffected.

3. New `src/shared/hooks/useCooldown.js`
   - Extract the 60s countdown already in `VerificationResend`:
     `{ seconds, cooling, start }`; `start(seconds)` begins/reset the timer.
   - No new dependency.

4. `src/features/auth/ForgotPassword.jsx`
   - Use `useCooldown`.
   - On success: `start(60)`, keep the existing success notice.
   - On `err.code === 'RATE_LIMITED'`: `start(60)` and show the friendly error.
   - Submit button disabled while `busy || cooling`; label becomes
     `Send again in ${seconds}s` during cooldown.
   - Do not disable the email input; only the send action is held.

5. `src/features/auth/VerificationResend.jsx`
   - Replace the local timer with `useCooldown`.
   - On `err.code === 'RATE_LIMITED'`, start the 60s cooldown as well.

## Tests

- `src/features/auth/__tests__/ForgotPassword.test.jsx`
  - After a successful request, the button is disabled and reads
    `Send again in 60s`.
  - A 429 response shows the friendly message and disables the button for 60s.
- `src/features/auth/__tests__/VerificationResend.test.jsx`
  - Existing success cooldown still passes.
  - Update the 429 case: button is disabled with the countdown, not re-enabled.
- `src/shared/services/__tests__/auth.test.js`
  - The 429 mapping preserves `code: 'RATE_LIMITED'` / `status: 429`.
- Use Vitest fake timers in the cooldown tests; restore real timers after each.

## Acceptance

```powershell
npx vitest run src/features/auth/__tests__/ForgotPassword.test.jsx src/features/auth/__tests__/VerificationResend.test.jsx src/shared/services/__tests__/auth.test.js
npm run lint
```

## Ops note (no code)

The VPS must have `TRUST_PROXY=1` behind nginx, otherwise Better Auth's
IP-keyed 3/60 bucket is shared by every client. Verify with:

```bash
sudo -u joblinked grep -E '^TRUST_PROXY=' /srv/joblinked/server/.env
```

## Out of scope

- No schema or API contract change.
- No per-email cooldown (Better Auth keys by IP + path).
- No change to the 100/15min `authLimiter` in Express.
