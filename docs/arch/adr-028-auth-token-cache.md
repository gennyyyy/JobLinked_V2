# ADR-028 — 60-second per-process cache of the Supabase JWT→user resolution [ACCEPTED 2026-10-16]

> ADR-024 was already taken by the admin-invite decision (`docs/arch/adr-backlog.md`), so this takes the next free number.

## Context

`attachPrincipal` (`app.js:66`) resolved the bearer token on **every** `/api/*` request, and each route's own auth middleware did it again, so an authenticated read paid one or two `supa().auth.getUser(token)` round-trips. Phase 4 measured ~120 ms per call and a 395 req/s ceiling on authenticated reads (`docs/arch/audit/phase4-loadtest.md`). The resolution's only job is learning the user id, and that does not change per request.

## Decision

Memoize the JWT→user result **per process** in `server/src/tokenCache.js`, keyed on the exact token string, TTL 60 s, cap 5,000 entries, FIFO eviction.

- Key on the raw token, not a hash — tokens are already opaque secrets and the map never leaves the process, so hashing costs more than it protects.
- Cache **positives only**: an invalid or expired token reaches Supabase every time, so a transient Supabase failure can never freeze a dead token into the cache, and a token that becomes valid again is picked up immediately.
- FIFO via `Map` insertion order; re-setting an existing key keeps its original position, so a hot token ages out instead of becoming immortal.
- Its own module so the test helper can reset it without importing `auth.js` (which would cycle back through the `@supabase/supabase-js` mock factory).
- The per-request memo `req._supaUser` (`auth.js`) stays on top: different scope, and it is what the F-01 limiter keying relies on.

## Consequences

- **Revocation delay up to 60 s.** A Supabase-side sign-out-everywhere or password reset is invisible for up to the TTL; the browser cannot fix it by retrying. Documented in `docs/arch/rework/02-api-contract.md`.
- **Local suspension stays immediate.** `resolveRole` reads Postgres every request and is deliberately *not* cached, so suspension takes effect on the next request, inside or outside the TTL.
- Per-process by construction: each instance memoizes its own tokens. Worst case is a missed memo, never a wrong principal. Raise `TOKEN_CACHE_MAX` before adding eviction logic (the `ponytail:` comment names it).
