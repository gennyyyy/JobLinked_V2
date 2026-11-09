# ADR-041 — Cloudflare Turnstile in front of every Supabase credential call

- **Status:** Accepted
- **Date:** 2026-11-05
- **Context:** `docs/plan/done/2026-11-05-captcha-integration-plan.md`
- **Renumbered:** the plan called this ADR-040; that number is already taken by
  `adr-040-profile-images-and-file-backups.md`.

## Context

Five browser flows hand a password (or create an account) directly to Supabase
Auth: sign in, job-seeker sign-up, employer sign-up, the password-reset request,
and the change-password re-auth. Supabase is the only credential authority — the
Express API has no unauthenticated credential endpoint, and every write path
already sits behind a session plus rate limiting.

Rate limiting bounds one client, not a distributed bot. A public municipal
service needs a real "are you a human" check at the credential boundary without
adding a backend service, a second secret store, or another npm package.

Supabase Auth supports CAPTCHA protection natively: it accepts a
`captchaToken` inside the normal `supabase.auth.*` call and verifies it
server-side before issuing a session. Cloudflare Turnstile is the
non-interactive option, free at this volume.

## Decision

**Use Cloudflare Turnstile through Supabase Auth CAPTCHA protection.** The
browser loads Turnstile's script at runtime (`?render=explicit`), renders one
widget per form, and forwards the token as `options.captchaToken` (or the second
argument of `resetPasswordForEmail`). Supabase verifies the token when the
project's CAPTCHA protection is enabled; the secret key lives only in the
Supabase dashboard.

The exact call sites:

| Flow | Supabase call | File |
|---|---|---|
| Sign in | `signInWithPassword` | `src/features/auth/Login.jsx` |
| Job seeker sign-up | `signUp` | `src/features/auth/JobSeekerRegister.jsx` |
| Employer sign-up | `signUp` | `src/features/auth/EmployerRegister.jsx` |
| Password reset request | `resetPasswordForEmail` | `src/features/auth/ForgotPassword.jsx` |
| Password change (re-auth) | `signInWithPassword` | `src/shared/components/ChangePassword.jsx` |

Not captcha-gated, because Supabase does not gate them: `updateUser` (recovery
link / invite acceptance), `getSession`, `refreshSession`, `signOut`. Public job
browsing stays anonymous and rate-limited.

## Consequences

- One new public config value: `VITE_TURNSTILE_SITE_KEY`. Unset (CI,
  `.env.test`, local dev) means no widget, no layout hole, and today's behavior.
  The Turnstile **secret** never enters this repo.
- Enforcement is **project-wide** in Supabase and is not deployed by code. It
  must be switched on only after the frontend that sends tokens is live;
  otherwise every sign-in and sign-up fails.
- Tokens are single-use and expire after ~5 minutes. Every failed submit clears
  the token and re-renders the widget before the next attempt.
- `changePassword()` keeps its `signInWithPassword` re-auth — Supabase does not
  verify the current password on `updateUser`, so that call is the only check;
  it now carries a token too.
- A blocked `challenges.cloudflare.com` must not lock users out. Submit stays
  enabled; the widget explains the load failure, and Supabase's verdict (with a
  mapped "complete the challenge again" error) is the authority.
- No new npm dependency, no Express middleware, no schema change.

## Alternatives considered

- **hCaptcha** — the only other Supabase-supported provider. Switching later is
  a dashboard provider change plus swapping one widget script.
- **Custom Express captcha verification** — a second secret store, a new
  endpoint, and no better protection: Supabase already verifies before issuing a
  session.
- **Rate limiting alone** — already present; it does not stop distributed
  signup spam.

## Rollback

Disable CAPTCHA protection in the Supabase dashboard. That is instant and needs
no deploy; tokens already being sent are simply ignored. Re-enabling uses the
same toggle once the frontend is confirmed live. The widget's site key can stay
configured during the rollback window (it renders harmlessly).

## Operator checklist (manual; not run by the codebase)

1. Create the Turnstile widget in the Cloudflare dashboard (hostnames:
   `localhost` + production).
2. Put the **site key** in `.env.local` / the deployment environment. Confirm the
   widget renders and a real token reaches Supabase while enforcement is still
   off.
3. Deploy the frontend.
4. Supabase dashboard → Authentication → CAPTCHA / Bot protection → provider
   **Turnstile** → paste the **secret key** → enable.
5. Verify sign-up, sign-in, forgot-password, and change-password with
   enforcement on.
6. Rollback: disable protection in the dashboard (instant, no deploy).
