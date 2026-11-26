# Password reset: enforce the 1-minute cooldown across navigation

**Status:** approved by user 2026-11-26 (bug report: leave `/forgot-password`, return, resend
immediately).

## Root cause

- `useCooldown` (`src/shared/hooks/useCooldown.js`) is in-memory component state; navigating away
  resets it.
- Server-side, `server/src/ba.js` pins Better Auth's reset endpoint to **3 per 60s per IP**
  (`customRules['/request-password-reset'] = { window: 60, max: 3 }`). So requests 2 and 3 in the
  same minute really deliver email.

## Server fix (authoritative)

### New `server/src/requestResetCooldown.js`

Per-email 60s window, no account lookup (so it cannot leak account existence):

```js
export const RESET_COOLDOWN_MS = 60_000
export function requestResetAllowed(email, now = Date.now()) // -> { allowed, retryAfterSeconds }
export function resetRequestCooldown() // test hook
```

- Key: `String(email).trim().toLowerCase()`; empty email returns allowed (BA validates it).
- Allowed → store `now`; within the window → `{ allowed: false, retryAfterSeconds }`.
- Sweep entries older than the window once the map exceeds ~5000, mirroring `mailer.js`.
- `// ponytail: per-process map; Redis/DB if the API runs multi-instance.`

### `server/src/ba.js`

Extend the existing `before` hook: handle `/request-password-reset` before the password-policy
branch. If `!requestResetAllowed(ctx.body?.email).allowed`, throw
`new APIError('TOO_MANY_REQUESTS', { message: 'A reset email was already sent. Please wait a minute before trying again.' })`.
Keep the existing IP rule as a backstop and update its comment to say the client mirrors the
per-email 60s window.

### Test `server/src/requestResetCooldown.test.js`

First request allowed; second within 60s blocked with a positive `retryAfterSeconds`; past the
window allowed again; keys are case-insensitive; different addresses independent. Use the reset
hook in `beforeEach`.

## Client fix (UX mirror)

### `src/shared/hooks/useCooldown.js`

Add `stop = useCallback(() => setRemaining(0), [])` and return it. Keep `start(length)`.

### `src/features/auth/ForgotPassword.jsx`

- Persist the last request per address: `localStorage['joblinked:password-reset-cooldown'] =
  JSON.stringify({ email, until })`.
- On success **and** on `err.code === 'RATE_LIMITED'`: write `{ email: normalized, until:
  Date.now() + 60_000 }` and `cooldown.start()`.
- Add an effect on `email`: read the record; if it matches the normalized input and `until > now`,
  `cooldown.start(Math.ceil((until - now) / 1000))`; otherwise `cooldown.stop()`. Delete expired
  records and ignore parse errors.
- Keep the in-flight ref and the existing submit guard (`busy || cooling`).
- Note in a comment that localStorage is only the UI mirror; the server enforces the window.

### Tests `src/features/auth/__tests__/ForgotPassword.test.jsx`

- Add `localStorage.clear()` to the existing top-level `beforeEach` (the new persistence would
  otherwise leak between the cooldown tests).
- New test: send for `jane@example.com`, unmount, render the page again, type the same email →
  button disabled with `Send again in …s` and submit does not call `requestPasswordReset`.
- New test: a different email stays enabled.
- Update the stale comment claiming the server allows 3 sends per 60s (now per-email 1/60, IP
  backstop 3/60).

## Done when

- The reported flow cannot send a second email inside 60s (server rejects with 429), and the
  returning page shows the remaining countdown for that address.
- `npx vitest run src/features/auth/__tests__/ForgotPassword.test.jsx` and
  `npx vitest run server/src/requestResetCooldown.test.js` pass; `npm run lint` clean.
