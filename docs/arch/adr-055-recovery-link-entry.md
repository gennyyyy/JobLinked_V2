# ADR-055 — A recovery link is a credential, not a session

**Status:** Accepted 2026-11-21 (product owner confirmed the fix brief).

## Context

The password-reset email asks Supabase to return the browser to `<origin>/reset-password`
(`src/shared/services/auth.js:resetPassword`). Two facts break that:

1. GoTrue only honours `redirect_to` when it matches an entry in the project's
   **Redirect URLs** allowlist. When it does not, GoTrue silently falls back to the
   **Site URL** and appends the implicit-flow fragment there, i.e.
   `https://www.joblinked.site/#access_token=…&type=recovery…`.
2. `src/App.jsx` seeds the router from the entry URL and wraps `/reset-password` in
   `PublicRoute`, which signs the visitor out on arrival (ADR-021). The recovery
   session therefore has no screen that accepts it: the visitor sees the public
   landing page, and even if the path were right the one-time session would be
   destroyed before `updateUser` could run.

`contract: this is our only recovery credential; a redirect fallback is outside our control.`

## Decision

A tab that opens with `type=recovery` in its URL fragment is treated as a recovery
landing, snapshotted at module load in `src/App.jsx` before `@supabase/supabase-js`
clears the fragment:

- the router is seeded with `/reset-password`, so the reset screen renders no matter
  which pathname the email actually landed on;
- `PublicRoute` does not sign out while that snapshot is set.

This is the single, documented exception to ADR-021. It is not a new session type:
it is the existing Supabase session that arrived as a one-time credential. Ordinary
signed-in visits to public routes are unchanged, and a guest visit to
`/reset-password` has no fragment, so the ADR-021 rule still applies to it.

## Consequences

- The reset flow works even when the Supabase allowlist is misconfigured; fixing the
  allowlist (`<origin>/reset-password`) remains the correct ops state and is
  documented in `docs/ops/deploy-runbook.md`.
- While the snapshot is set, public routes do not sign the tab out. The snapshot lasts
  for the page's lifetime (the SDK strips the fragment after it consumes the token).
  Accepted: the alternative — trusting a fragment that a third party controls to
  decide whether to keep a session — is the same trust boundary, and the session is
  the user's own.
- No API, schema, or email-template change. No auth migration.

## Rollback

Delete the recovery snapshot and its two uses in `src/App.jsx`; the previous
behaviour returns and the email then depends entirely on the Supabase allowlist.
