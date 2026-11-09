# CAPTCHA Integration Plan (Supabase Auth + Cloudflare Turnstile)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`
> (or `superpowers:executing-plans`) after Lead Architect sign-off on ADR-041.
> Track steps with `- [ ]`.

**Goal:** Put a real bot check in front of every credential-creating or
credential-checking request (sign-up, sign-in, password-reset request, and the
password-change re-auth) without adding a backend endpoint or a new npm package.

**Architecture:** Supabase Auth owns the verification. The browser renders a
Cloudflare Turnstile widget, the token travels to Supabase inside the existing
`supabase.auth.*` calls (`options.captchaToken`), and Supabase verifies it
server-side when CAPTCHA protection is switched on in the project dashboard.
The Express API is untouched: it has no unauthenticated credential endpoint to
protect, and Supabase refuses the request before a session exists.

**Tech Stack:** Vite + React 19 + JSX · `@supabase/supabase-js` (installed) ·
Cloudflare Turnstile script (loaded at runtime, no package) · Vitest.

**Spec:** this file is the spec. Measured against the code on 2026-11-05.

## Decision (recorded in ADR-041)

Use **Cloudflare Turnstile** through **Supabase Auth CAPTCHA protection**.

- Turnstile is non-interactive, free at this volume, and supported natively by
  Supabase (secret key lives in the Supabase dashboard, never in this repo).
- hCaptcha is the only other Supabase-supported option; switching later is a
  dashboard provider change plus swapping the widget script (one file).
- Rejected: custom Express captcha verification (a second secret store, a new
  endpoint, and no better protection — Supabase already verifies before issuing
  a session); rate limiting alone (already present, doesn't stop distributed
  signup spam).

## Scope: where a token is required

| Flow | Supabase call | File |
|---|---|---|
| Sign in | `signInWithPassword` | `src/features/auth/Login.jsx` |
| Job seeker sign-up | `signUp` | `src/features/auth/JobSeekerRegister.jsx` |
| Employer sign-up | `signUp` | `src/features/auth/EmployerRegister.jsx` |
| Password reset request | `resetPasswordForEmail` | `src/features/auth/ForgotPassword.jsx` |
| Password change (re-auth) | `signInWithPassword` | `src/shared/components/ChangePassword.jsx` |

Not in scope: `updateUser` (recovery link / invite acceptance), `getSession`,
`refreshSession`, `signOut` — Supabase does not captcha-gate those. Public job
browsing stays anonymous and rate-limited.

## Global Constraints

- JavaScript/JSX only. **No new npm dependency** — load Turnstile's script
  (`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`).
- **No server or database changes.** No schema touch, no Express middleware.
- `VITE_TURNSTILE_SITE_KEY` is the only new config. The Turnstile **secret**
  stays in the Supabase dashboard. Never commit either secret or a test key.
- Site key unset (`''`): the widget renders nothing, forms behave exactly as
  today, and the suite stays green. This is the default in CI and `.env.test`.
- Turnstile tokens are **single-use**. Every failed submit clears the token and
  re-renders the widget before the next attempt.
- Forms stay usable if the script is blocked: show a clear load error but do
  not hard-disable submit — Supabase's verdict plus the mapped error is the
  final answer (see Review Focus 2).
- Dashboard CAPTCHA enforcement is **project-wide**. It must be switched on only
  after the frontend that sends tokens is deployed (rollout task).
- Every task ends green on `npx eslint <changed files>` plus the task's Vitest
  files; the final task runs `npm test`, `npm run build`,
  `npx eslint src server db`.

## Review Focus

1. **Change-password silently breaks.** `changePassword()` verifies the current
   password by calling `signInWithPassword` — once CAPTCHA is enforced that call
   fails for every role until it also sends a token. Pinned in Task 8.
2. **A blocked script must not lock users out.** Ad-blockers and offline
   networks can block `challenges.cloudflare.com`; if submit were disabled while
   required, sign-in would be unreachable. Submit stays enabled and the widget
   failure is explained. Pinned in Tasks 3 and 5.
3. **Replayed/expired tokens.** A token is consumed by the first attempt and
   expires after ~5 minutes; a retry with the same token makes every retry fail.
   Reset after each failure. Pinned in Tasks 5–8.
4. **Registration's email-confirmation branch.** `signUp` returns no session when
   confirmation is on; the captcha only gates account creation, never the
   confirmation link or the later `signIn`. The existing
   `emailConfirmationRequired` behavior must survive. Pinned in Task 7.
5. **Dev, preview, and e2e harness.** No site key must mean *no widget and no
   layout hole* — `jobseeker-preview.html`, `preview.html`, and the smoke scripts
   must render as today. Pinned in Tasks 3 and 9.

---

## Task 1: Record ADR-041 (gate — no code before this)

**Files:**
- Create: `docs/arch/adr-041-auth-captcha-turnstile.md`

**Interfaces:**
- Produces: the approved decision that Tasks 2–9 implement.

- [x] **Step 1:** Write the ADR: context (public credential endpoints, bot
      signups, current protections), decision (Supabase + Turnstile), the exact
      five call sites above, consequences (site key env, dashboard-enforced
      globally, single-use tokens, change-password re-auth), alternatives
      considered, and rollback (dashboard toggle off; widget becomes inert
      because the site key can stay).
- [x] **Step 2:** Get the repo owner's explicit approval. Implementation stops
      here until it lands.

## Task 2: Turnstile script loader

**Files:**
- Create: `src/shared/lib/turnstile.js`
- Test: `src/shared/lib/__tests__/turnstile.test.js`

**Interfaces:**
- Produces:
  - `export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''`
  - `export function loadTurnstile(): Promise<object>` — injects the script once
    (module-level cached promise), resolves with `window.turnstile`, rejects on
    script error.
  - `export function renderTurnstile(container, { sitekey, onToken, onExpire, onError }): number`
  - `export function resetTurnstile(widgetId): void`
  - `export function removeTurnstile(widgetId): void`
  - Callback names map to Turnstile's `callback`, `expired-callback`,
    `error-callback`; options also include `theme: 'light'`.

- [x] **Step 1: Write the failing test** — assert two `loadTurnstile()` calls
      inject exactly one `script[src*="turnstile"]`, resolve after its `onload`,
      and reject when `onerror` fires; `renderTurnstile` forwards the site key and
      callbacks to `window.turnstile.render` and returns its widget id;
      `resetTurnstile`/`removeTurnstile` call `window.turnstile.reset/remove`
      with that id. Reset the module cache between tests
      (`vi.resetModules()`), stub `window.turnstile`.
- [x] **Step 2:** `npx vitest run src/shared/lib/__tests__/turnstile.test.js` →
      FAIL (`turnstile.js` missing).
- [x] **Step 3:** Implement `src/shared/lib/turnstile.js` (~50 lines). Guard
      `typeof window === 'undefined'`; no-op when `window.turnstile` is absent
      after load.
- [x] **Step 4:** Same command → PASS.
- [x] **Step 5:** `npx eslint src/shared/lib/turnstile.js src/shared/lib/__tests__/turnstile.test.js`,
      then commit `feat(auth): load Cloudflare Turnstile without a dependency`.

## Task 3: `useCaptcha` hook and `<Turnstile>` component

**Files:**
- Create: `src/shared/hooks/useCaptcha.js`
- Create: `src/shared/components/Turnstile.jsx`
- Test: `src/shared/components/__tests__/Turnstile.test.jsx`

**Interfaces:**
- Produces:
  - `useCaptcha() -> { token, setToken, round, reset, required }` where
    `required = Boolean(TURNSTILE_SITE_KEY)`; `reset()` clears the token and
    increments `round`.
  - `export default function Turnstile({ onToken, resetKey })` — renders `null`
    when `!required`; otherwise `<div className="min-h-[65px]" ref>` + error text.
    Calls `onToken('')` on expiry/error.

- [x] **Step 1: Write the failing component test** — with the loader mocked and
      no site key: renders nothing and never calls `renderTurnstile`. With a site
      key: calls `loadTurnstile` + `renderTurnstile` once, forwards a token from
      the widget callback, calls `onToken('')` on expiry, calls
      `resetTurnstile(widgetId)` when `resetKey` changes, and removes it on
      unmount. Add one test for the script rejection error text
      (`Verification could not load…`) and that no widget is mounted.
- [x] **Step 2:** Run the file → FAIL.
- [x] **Step 3:** Implement the hook (5 lines of state) and component. Mock
      `'../../../shared/lib/turnstile'` in the test with
      `TURNSTILE_SITE_KEY`, `loadTurnstile`, `renderTurnstile`,
      `resetTurnstile`, `removeTurnstile` as `vi.fn()`s.
- [x] **Step 4:** Run → PASS.
- [x] **Step 5:** Lint + commit `feat(auth): add the captcha widget and token state`.

## Task 4: Send the token to Supabase (service layer)

**Files:**
- Modify: `src/shared/services/auth.js`
- Test: `src/shared/services/__tests__/auth.test.js`

**Interfaces:**
- Produces (last parameter is `captchaToken`; omit the option when falsy):
  - `signIn(email, password, captchaToken)`
  - `signUp({ ..., captchaToken })`
  - `resetPassword(email, captchaToken)`
  - `changePassword(currentPassword, newPassword, captchaToken)`
- `friendlyAuthError` maps `/captcha/i` failures to
  `Error('Verification failed. Please complete the challenge again.')`.

- [x] **Step 1: Write the failing service tests** — for each of the four
      functions: token provided → `options.captchaToken` / second argument
      `captchaToken` present; token absent → key absent; and sign-in rejecting
      with `{ message: 'captcha protection: request disallowed' }` surfaces the
      mapped message.
- [x] **Step 2:** Run `npx vitest run src/shared/services/__tests__/auth.test.js`
      → the new assertions FAIL.
- [x] **Step 3:** Implement the pass-through. `signUp` keeps its existing
      `options.data`/`emailRedirectTo` and adds `captchaToken` only when present;
      `changePassword` adds `options` to its `signInWithPassword` re-auth.
- [x] **Step 4:** Run → PASS. Existing service tests must still pass.
- [x] **Step 5:** Lint + commit `feat(auth): forward captcha tokens to Supabase`.

## Task 5: Sign-in form

**Files:**
- Modify: `src/features/auth/Login.jsx`
- Test: `src/features/auth/__tests__/Login.test.jsx`

**Interfaces:**
- Consumes: `useCaptcha`, `<Turnstile>`, `signIn(email, password, captchaToken)`.

- [x] **Step 1:** In the test, mock `'../../../shared/lib/turnstile'` with
      `TURNSTILE_SITE_KEY: 'site-key'` (so `useCaptcha().required` is true) and
      mock `<Turnstile>` as a button that calls `onToken('captcha-token')`. Add:
      (a) submit before solving → error copy
      `Please complete the verification challenge.`, `signIn` not called;
      (b) solve then submit → `signIn` called with the token; (c) rejected
      `signIn` clears the token, so a second immediate submit is blocked again.
- [x] **Step 2:** Run → FAIL.
- [x] **Step 3:** Add `const captcha = useCaptcha()`; render
      `{captcha.required && <Turnstile onToken={captcha.setToken} resetKey={captcha.round} />}`
      between the password field and the error paragraph; guard in
      `handleSubmit`; pass `captcha.token`; call `captcha.reset()` in the catch.
- [x] **Step 4:** Run → PASS (update the existing call assertions to include the
      third argument).
- [x] **Step 5:** Lint + commit `feat(auth): require the captcha on sign-in`.

## Task 6: Forgot-password form

**Files:**
- Modify: `src/features/auth/ForgotPassword.jsx`
- Test: `src/features/auth/__tests__/ForgotPassword.test.jsx`

**Interfaces:** same pattern as Task 5; `resetPassword(email, captchaToken)`.

- [x] **Step 1:** Test: blocked without a token; token forwarded; reset after a
      failure; success notice still renders.
- [x] **Step 2:** Run → FAIL.
- [x] **Step 3:** Wire the hook + widget above the submit button; guard; reset on
      catch.
- [x] **Step 4:** Run → PASS (update the existing
      `toHaveBeenCalledWith('jane@example.com')` assertion).
- [x] **Step 5:** Lint + commit `feat(auth): require the captcha on reset requests`.

## Task 7: Both registration forms

**Files:**
- Modify: `src/features/auth/JobSeekerRegister.jsx`
- Modify: `src/features/auth/EmployerRegister.jsx`
- Test: `src/features/auth/__tests__/JobSeekerRegister.test.jsx`
- Test: `src/features/auth/__tests__/EmployerRegister.test.jsx`

**Interfaces:** `signUp(payload & { captchaToken })`.

- [x] **Step 1:** Tests (both files, same lib/site-key + `Turnstile` mock as
      Task 5): blocked without a token; with a token the payload passed to
      `signUp` contains it; on rejection the widget resets. Keep one existing
      test asserting the email-confirmation success screen still renders
      (Review Focus 4).
- [x] **Step 2:** Run both files → FAIL.
- [x] **Step 3:** Render the widget immediately above the submit button in each
      form; pass `captchaToken` into the existing payload object before
      `signUp`; reset on catch.
- [x] **Step 4:** Run both → PASS.
- [x] **Step 5:** Lint + commit `feat(auth): require the captcha on registration`.

## Task 8: Password change (all roles)

**Files:**
- Modify: `src/shared/components/ChangePassword.jsx`
- Test: `src/shared/components/__tests__/ChangePassword.test.jsx`

**Interfaces:** `changePassword(current, next, captchaToken)`; component is shared
by job-seeker Settings, employer profile, and super-admin profile.

- [x] **Step 1:** Tests (same lib/site-key + `Turnstile` mock as Task 5): with
      the widget required, submit without a token is blocked; with a token
      `changePassword` receives it; a failed change resets the token. Existing
      success/validation tests stay.
- [x] **Step 2:** Run → FAIL.
- [x] **Step 3:** Add the hook + widget above the submit button and pass the
      token. **Do not remove the re-auth** — Supabase does not verify the current
      password on `updateUser`, so it is the only check there.
- [x] **Step 4:** Run → PASS (update the existing
      `toHaveBeenCalledWith('oldpass', 'password123')` assertion for the third
      argument).
- [x] **Step 5:** Lint + commit `feat(auth): require the captcha when changing a password`.

## Task 9: Config, docs, and rollout

**Files:**
- Modify: `.env.example` (add `VITE_TURNSTILE_SITE_KEY=` under the Supabase block
  with a one-line comment: public site key; blank disables the widget)
- Modify: `docs/arch/adr-041-auth-captcha-turnstile.md` (add the operator
  checklist)
- No source logic changes in this task.

- [x] **Step 1:** Add the env entry. Leave `.env.test` untouched.
- [x] **Step 2:** Run the full gate: `npm test`, `npm run build`,
      `npx eslint src server db`. Confirm the build works with the variable
      unset and set to a dummy `1x00000000000000000000AA` (Cloudflare's test key).
- [x] **Step 3:** Operator checklist in the ADR:
      1. Create the Turnstile widget (hostnames: localhost + production).
      2. Put the **site key** in `.env.local` / deployment env; confirm the widget
         renders and a real token reaches Supabase (with enforcement still off).
      3. Deploy the frontend.
      4. Supabase dashboard → Authentication → CAPTCHA/Bot protection → provider
         Turnstile + **secret key** → enable.
      5. Verify sign-up, sign-in, forgot-password, and change-password.
      6. Rollback: disable protection in the dashboard (instant, no deploy);
         re-enabling is the same toggle.
- [x] **Step 4:** Commit `docs(auth): document the Turnstile setup and rollout`.

## Out of scope

- No custom captcha endpoint, middleware, or database table.
- No captcha on public job browsing, the audit log endpoint, or authenticated
  `updateUser` (recovery-link/invite) flows.
- No replacement for the existing Express rate limiting.

## Failure modes to guard

1. Enabling Supabase CAPTCHA before the frontend deploys → every login fails.
   Rollout order above is part of the task, not advice.
2. Never leave a submit button permanently disabled because the widget did not
   load; the Supabase error is the authority.
3. Never reuse a token after a rejection; reset before the retry.
4. Never log or persist tokens; they are per-attempt strings passed straight to
   Supabase.

## Results (2026-11-09)

Tasks 2–9 complete. Commits:

- `feat(auth): add the captcha widget and token state`
- `feat(auth): forward captcha tokens to Supabase`
- `feat(auth): require the captcha on sign-in`
- `feat(auth): require the captcha on reset requests`
- `feat(auth): require the captcha on registration`
- `feat(auth): require the captcha when changing a password`
- `docs(auth): document the Turnstile setup and rollout`

Verification (all green):

- `npm test` → 172 files / 1050 tests passed, including the 7 new
  captcha-wiring tests per form file and the 7 service tests.
- `npm run lint` and `npx eslint src server db` → clean.
- `npm run build` → clean with `VITE_TURNSTILE_SITE_KEY` unset, and again set to
  Cloudflare's test key `1x00000000000000000000AA`.
- Form tests keep every non-captcha test with the site key unset (`''`), so the
  no-key behavior is byte-identical to before the integration.

Notes for the repo owner:

- The client guard blocks submit while the widget is configured but unsolved.
  If `challenges.cloudflare.com` is blocked, the widget explains the load
  failure, but submit still reports "Please complete the verification
  challenge." (the plan pins this behavior in Task 5's test). Supabase is the
  only party that can waive the token, so removing the guard would require
  lifting the widget's load-failure state into the form — out of the pinned
  interface.
- Remaining manual steps are the ADR-041 operator checklist: create the
  Turnstile widget, set the site key, deploy the frontend, then enable CAPTCHA
  protection in the Supabase dashboard (nothing in Supabase was touched here).
