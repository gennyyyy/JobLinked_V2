# ADR-063: Apply-intent post-login landing

**Status:** Accepted
**Date:** 2026-11-28

## Context

Public job pages (`/jobs/:id`) carry a "Log in to Apply" CTA. Today it links to
`/login` with no job context, and `Login.jsx` always forwards the signed-in
account to their role's portal home (`PORTALS.homePath`). A guest who clicked a
specific job must re-find it after sign-in.

Two constraints shape the solution:

1. **ADR-021** — public pages destroy any signed-in session on arrival. Returning
   the user to the public `/jobs/:id` page after sign-in would immediately log
   them out. The valid "full job page" destination is the seeker portal's
   `/job-seeker/jobs/:id`, which shows the same job with a working Apply button.
2. **ADR-036/041** — the address bar is frozen; in-app URLs are not real
   document URLs, and the register→verify-email→sign-in round trip crosses a
   server-controlled email link whose callback URL is fixed. A query parameter
   threaded through links cannot survive that round trip.

## Decision

1. **One storage entry, not link threading.** "Log in to Apply" stashes an
   apply intent before navigating to `/login`: a single `localStorage` entry
   `joblinked:applyIntent` holding JSON `{ id, at }`, written by
   `PublicJobDetail` at the click.
2. **`src/shared/lib/applyIntent.js` owns the entry.** `stashApplyIntent(jobId)`
   writes it; `takeApplyIntent()` reads-and-clears (one-shot), expires entries
   after 24 hours, validates the id against `^[A-Za-z0-9-]+$`, and maps the
   intent to the seeker portal page `/job-seeker/jobs/:id`. The stored value is
   never navigated to raw — open-redirect-safe by construction.
3. **Consumers.** `Login.jsx` honors the intent on every successful
   sign-in path (password, MFA code step, and the already-signed-in early
   return). `CompleteRegistration.jsx` honors it after provisioning succeeds.
   Non-job-seeker roles ignore the intent and keep today's portal-home
   redirect. Failed sign-in attempts do not consume the intent.
4. **No API, schema, or route changes.** Registration screens are not modified —
   the storage entry survives the entire register → verify-email → sign-in
   round trip without threading anything through links or the emailed URL.

## Consequences

- A job seeker with a live intent lands on the full job page in their portal;
  a stale (>24 h), invalid, or absent intent falls back to the portal home.
- The intent is one-shot: the first successful sign-in/provisioning consumes
  it. A later unrelated sign-in within 24 h could still honor a leftover
  intent (bounded staleness; the user is a seeker landing on a job page).
- Cross-tab: the entry is shared per browser profile; `takeApplyIntent()`
  is idempotent-safe under double render.
- `CompleteRegistration`'s already-provisioned early return does not consume
  the intent (bounded by the TTL).
