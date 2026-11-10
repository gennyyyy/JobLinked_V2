# ADR-043 — Minimal in-process monitoring and alerting

**Status:** Accepted 2026-11-10 (Lead Architect; closes register row G15)

## Context

The API already logs one structured line per request (`middleware/requestLog.js`)
and answers `GET /api/health`. Nothing aggregated those lines: an operator could
tell that *a* request failed, but not how many, how fast, or whether the trend was
getting worse. The ops plan (06) left monitoring as its last open item, and the
topology decision (ADR-037/038: one persistent node) means a per-process snapshot
*is* the whole picture — no multi-instance aggregation problem to solve.

## Decision

1. **Counters in-process, read on demand.** `server/src/middleware/metrics.js`
   increments on `res.on('finish')`: request counts by `method status-class`, a
   coarse latency histogram (25 ms … 5 s + over), RSS, uptime, and the last 5xx
   (`method`, `path`, `at`). No timers, no persistence, no exports, no dependency.
2. **Scrape endpoint** `GET /api/metrics` (`src/routes/metrics.js`), gated by
   `METRICS_TOKEN` via the `x-metrics-token` header (constant-time compare).
   Unset token → **404**, so a disabled endpoint is indistinguishable from a
   missing one; a scraper needs no user session, and the payload carries counts
   only — no query strings, no user ids, no bodies.
3. **Optional alert hook.** When `ALERT_WEBHOOK_URL` is set, each 5xx posts one
   small JSON line to it, throttled to **one per minute** and fire-and-forget: an
   alert must never delay a response or fail a request.
4. **Not a metrics platform.** No Prometheus client, no time series, no dashboards.
   If multiple instances or trend retention become real, replace this wholesale
   rather than extending it.

## Consequences

- Operators get: `curl -H "x-metrics-token: …" https://api/api/metrics` for a live
  snapshot, and an optional webhook ping when 5xx start (the quiet failure mode the
  request log could never surface).
- Counters reset on restart — deliberate; this answers "what is happening now".
- The webhook throttles per process, so a restart-heavy deploy could alert more
  than once a minute. Acceptable at this scale; noted rather than engineered.
- Both env vars are documented in `server/.env.example`; unset in local dev, so
  nothing changes for existing runs.
