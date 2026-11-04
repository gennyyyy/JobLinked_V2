# ADR-038 — Request admission order and backpressure contract

- **Status:** Accepted
- **Date:** 2026-11-05
- **Context:** Live load campaign, `docs/arch/testing/2026-11-05-campaign.md`
- **Supersedes:** part of the middleware order documented in ADR-037

## Context

Two failures were measured against the real API, a real Postgres with 50k jobs,
and real Supabase sessions:

1. **Unauthenticated body-parse DoS.** `express.json({ limit: '1mb' })` ran
   before every rate limiter. One client flooding 900 KB JSON bodies at 100
   concurrent connections pushed `/api/health` to **p50 8.6 s / max 10.3 s**
   and sat a full core for the whole run. The limiters never saw the request,
   so an anonymous caller could starve the event loop indefinitely.
2. **Pool exhaustion answered as 500.** At 2,000 concurrent requests, the pg
   pool (max 20, connect timeout 5 s) queued longer than the timeout. The API
   logged 1,991 `timeout exceeded when trying to connect` and answered **HTTP
   500 INTERNAL** — telling clients and the proxy that the application was
   broken, when the correct signal is "busy, retry".

## Decision

1. **Admission control runs before any body work.** The JSON body parser is
   mounted after `authLimiter`, `uploadLimiter`, `apiLimiter`, and
   `attachPrincipal`. Those middlewares need only headers and path, so ordering
   them first costs nothing and caps the work an unauthenticated caller can
   force.
2. **DB saturation is a 503, not a 500.** The error middleware maps pool
   connect timeouts, `ECONNREFUSED`, `57P01`, `57P03`, and `53300` to
   `503 SERVICE_UNAVAILABLE` with `Retry-After: 5`, and logs them as
   `db_unavailable`.
3. **Upstream email limits are not conflicts.** `POST /api/admin/users/invite`
   maps Supabase `over_email_send_rate_limit` to `429 RATE_LIMITED`, invalid
   addresses to `400`, genuine duplicate registrations to `409`, and other send
   failures to `502 UPSTREAM_ERROR`.

## Consequences

- A throttled flood answers `429` after the bucket empties; health stayed at
  **p50 164 ms** in the re-run (was 8,645 ms). The kernel still receives the
  bytes for rejected uploads, so bandwidth remains the theoretical vector, but
  the event loop is no longer blocked.
- 2,000 concurrent list requests now produce 503s (92 in the re-run) instead of
  500s, and the process stays healthy. Throughput still saturates at ~270–540
  req/s on the single node; 503 is the correct signal, not a capacity fix.
- Clients must treat 503 as retryable. `src/shared/lib/api.js` already surfaces
  `.status`; no UI change was required because 503 only appears under
  saturation far beyond normal municipal traffic.
- Health checks still share the application pool. Under a 2,000-concurrent
  burst `/api/health` took p50 2.2 s / max 5.1 s, which can trip a strict LB
  timeout. A dedicated 1-connection health pool is the follow-up if the
  deployment adds a health-checked load balancer; not built now (YAGNI for a
  single-node deployment whose normal load keeps health < 100 ms).
