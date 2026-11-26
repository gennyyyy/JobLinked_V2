# Auth emails must not block the request

**Status:** approved by user 2026-11-26 ("why is the loading for sending the email so long now").

## Diagnosis

- Better Auth's `/request-password-reset` handler calls
  `await ctx.context.runInBackgroundOrAwait(sendResetPassword(...))`
  (`better-auth/dist/api/routes/password.mjs:82`).
- `runInBackgroundOrAwait` (`context/create-context.mjs:215`) only backgrounds the promise when
  `advanced.backgroundTasks.handler` is configured; otherwise it awaits it.
- Our `sendResetPassword` returns `deliver(...)`, which awaits nodemailer `sendMail`. With SMTP
  configured in `server/.env` and no timeouts, the response waits for the full SMTP handshake and
  delivery. The per-email cooldown added no latency.

## Fix

`server/src/ba.js`, inside the existing `advanced` block:

```js
backgroundTasks: {
  // Auth mail goes out off the request path: SMTP latency must not hold the
  // sign-up / reset / verification response open. The API is long-lived
  // (Express), so the in-process send survives the response; BA's wrapper
  // logs failures.
  handler: (promise) => { promise.catch(() => {}); },
},
```

`server/src/mailer.js`, in `transportFor()`: bound the SMTP attempt so a dead server cannot pile
up background tasks:

```js
connectionTimeout: 10_000,
greetingTimeout: 10_000,
socketTimeout: 20_000,
```

No behavior change to what is sent or to the anti-enumeration responses. Delivery failures were
already swallowed by `deliver` and logged; the HTTP answer was always success.

## Test

`server/src/ba.test.js` (or a small new case in the existing file): assert
`auth.options.advanced.backgroundTasks.handler` is a function, so a refactor cannot silently
restore the blocking path.

## Done when

- `npx vitest run server/src/ba.test.js` and `npm run lint` pass.
- Password reset / verification responses return as soon as the token row is written; SMTP runs
  after the response.
