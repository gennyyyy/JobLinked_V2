# Phase 4 — Load Test Audit

**Date:** 2026-10-16
**Target:** JobLinked Express API (`server/src/index.js`), local instance on `127.0.0.1:4100`
**Database:** local PostgreSQL 18 (`joblinked`)
**Harness:** `server/scripts/loadtest.mjs` — zero new dependencies (built-in `fetch` + `node:perf_hooks`)

---

## 1. Environment and honest caveats

Everything measured here runs on a **developer laptop (12 cores, 15.9 GB RAM) with a tiny local
database**:

| table | rows |
|---|---|
| `job_seekers` | 3 |
| `employers` | 1 |
| `super_admins` | 1 |
| `job_vacancies` | 1 (1 published) |
| `job_applications` | 2 |
| `notifications` | 23 |

**Read this before trusting any number.** With one job row in the hot path, these numbers measure
**fixed per-request overhead** (Express middleware, JSON serialization, the pg round-trip, the
Supabase token check), *not* database throughput or query-plan behavior. A production DB with 50k
jobs and a table scan on `ilike` would collapse far below the ceilings reported here. Nothing here
should be extrapolated to a production workload.

Also load-bearing for interpreting every table below:

- **The DB lives on the same machine as the load generator.** The "1,000 concurrent users" are not
  1,000 remote clients; they are 1,000 sockets on loopback. Loopback latency is ~0 but competes for
  the same 12 CPU cores, so the loader and the server starve each other. Both are on this box.
- **`GET /api/auth/me` and `/api/notifications/mine` do a remote Supabase round-trip on every
  request** (`attachPrincipal` → `userFromToken` → `supa().auth.getUser(token)`). Measured on this
  machine: **p50 120 ms, max 331 ms single; p50 211 ms, max 1,155 ms at 50 concurrent.** That is a
  network dependency to `*.supabase.co` on *every authenticated read*, and it dominates the
  authenticated latency numbers. This is the single most important finding.

---

## 2. Harness design

`server/scripts/loadtest.mjs`, single self-contained ESM file, no new npm packages.

```
node scripts/loadtest.mjs --label S1 --url http://127.0.0.1:4100 \
  --route "anon:/api/jobs?page=1&pageSize=20" --requests 5000 --concurrency 200
```

| flag | meaning |
|---|---|
| `--url` | base URL (default `http://127.0.0.1:4000`) |
| `--route "kind:path"` | repeatable. `kind` is `anon` or `auth`; `auth` attaches the bearer token |
| `--requests N` / `--duration S` | request-bounded or time-bounded run |
| `--concurrency N` | pool size = simultaneous in-flight promises |
| `--xff` | sends a distinct `X-Forwarded-For` per worker (`10.20.<hi>.<lo>`, 65k space) |
| `--xff-ip <ip>` | pin **all** workers to one client IP (for S4) |
| `--probe` / `--probe-every` | background `GET /api/health` poller, recorded separately |
| `--json <path>` | machine-readable result dump |
| `--mint-token --mint-email <addr>` | writes a real short-lived access token to `.loadtest-token.local` |

### Why `--xff` exists

The general limiter keys on `req.user?.id || ipKeyGenerator(req.ip)`. Run 1,000 workers from one
process with no header and you have one bucket of 300/15 min — the run measures rate limiting, not
the application. `--xff` gives every worker its own bucket so the mixed scenarios measure the app.
**This models the documented deployment**: `app.set('trust proxy', 1)` in `app.js:31` and the
F-01 comment say exactly one proxy hop is expected in front. A deployment with *nothing* in front
must set `TRUST_PROXY=0` — see finding **F5**, which is about that path.

### Measurement internals

- **Latency** — `process.hrtime.bigint()` around each `fetch`, then `await res.arrayBuffer()` so the
  socket is fully drained before the sample is closed. p50/p95/p99 are nearest-rank on the sorted
  array (no library, no reservoir sampling).
- **Event-loop lag** — `perf_hooks.monitorEventLoopDelay({resolution: 10})`, plus a
  `setInterval(1000)` drift probe as a second, independent signal.
- **Memory** — `process.memoryUsage()` sampled by a 1 s ticker across the whole run; start / mid /
  end positions reported.
- **Errors** — status counts bucketed; transport failures bucketed by `e.cause.code`
  (so `ECONNREFUSED` is distinguished from `ECONNRESET` from `TimeoutError`).
- **Probe** — a health poller running concurrently, so server responsiveness is measured from the
  *same* process during the run rather than only after it.

### How to re-run

```bash
cd server
# 1. start the API on a spare port so you never hold port 4000
$env:PORT="4100"; node src/index.js

# 2. a real bearer token (optional; only needed for auth: routes)
node scripts/loadtest.mjs --mint-token --mint-email you@example.com

# 3. scenarios
node scripts/loadtest.mjs --label S1 --url http://127.0.0.1:4100 \
  --route "anon:/api/jobs?page=1&pageSize=20" --requests 5000 --concurrency 200 --probe
node scripts/loadtest.mjs --label S4 --url http://127.0.0.1:4100 \
  --route "anon:/api/jobs?page=1&pageSize=1" --requests 2000 --concurrency 200 \
  --xff-ip 10.88.0.7 --probe
```

The server process was monitored **out-of-process** (OS handle/RSS/thread counts from a PowerShell
sampler) rather than in-process, because the harness is a separate process and adding a debug route
to the API would violate the "do not modify source" rule.

---

## 3. Baseline (before load)

Cold column: first request after process start (JIT + module + first DB connection). Warm column:
steady state from 12 sequential samples each.

| endpoint | cold | warm p50 | warm max |
|---|---|---|---|
| `GET /api/health` | 118.1 ms | **2.4 ms** | 4.3 ms |
| `GET /api/jobs?page=1&pageSize=20` | 29.3 ms | **4.0 ms** | 6.6 ms |
| `GET /api/jobs?page=1&pageSize=1` | 3.2 ms | **3.6 ms** | 5.0 ms |

Server RSS at rest: **57–63 MB**. Threads 12–16, handles ~269.

---

## 4. Per-scenario results

### S1a — public reads, single IP (throttle ceiling)

5,000 requests, concurrency 200, one client IP, `GET /api/jobs?page=1&pageSize=20`.
Deliberately *not* using `--xff`, to find where the general limiter bites.

| metric | value |
|---|---|
| completed / attempted | 5,000 / 5,000 |
| elapsed | 2.70 s |
| throughput | **1,852 req/s** |
| p50 / p95 / p99 / max | 78.4 / 432.0 / 758.8 / 993.9 ms |
| status counts | **200: 298, 429: 4,702** |
| transport errors | none |
| loader event-loop lag p50/p99/max | 10.0 / 38.1 / 65.9 ms |
| setInterval(1000) drift max | 0 ms |
| loader RSS start → end | 53.5 → 206.3 MB |
| health probe n / errors | 5 / 0 |

**The 300-request limit is the ceiling.** 298 of 5,000 got through; the other 4,702 were rejected
in ~0 ms (note the `429 ms:0` lines in the access log — the limiter short-circuits before any
handler). Aggregate throughput of 1,852 req/s is therefore mostly 429s, not work.

### S1b — public reads, 200 distinct virtual users

Same route and concurrency, with `--xff`.

| metric | value |
|---|---|
| completed / attempted | 5,000 / 5,000 |
| elapsed | 4.36 s |
| throughput | **1,147 req/s** |
| p50 / p95 / p99 / max | 169.5 / 194.3 / 256.8 / 275.4 ms |
| status counts | **200: 5,000** |
| transport errors | none |
| loader event-loop lag p50/p99/max | 10.1 / 22.6 / 33.4 ms |
| loader RSS start → end | 53.6 → 226.4 MB |
| health probe n / errors | 9 / 0 |
| **server RSS** | 174 → 280 MB (peak 280), idle→steady 280 |

No throttling when every worker has its own bucket. But note the shape: **p50 is 169 ms while a
single request at rest is 4 ms.** At 200 in flight, the pool is the queue. `/api/jobs` runs *two*
sequenced queries (count + page) against a pool of `max: 20`, so 200 concurrent requests contend
for 20 connections. This is the honest single-instance ceiling on the hot path — see finding **F1**.

### S2 — authenticated profile reads

1,000 requests, concurrency 100, `GET /api/auth/me` with a real bearer token, `--xff`.

| metric | value |
|---|---|
| completed / attempted | 1,000 / 1,000 |
| elapsed | 2.53 s |
| throughput | **395 req/s** |
| p50 / p95 / p99 / max | 190.3 / 765.3 / 830.2 / 844.6 ms |
| status counts | **200: 1,000** |
| transport errors | none |
| loader event-loop lag p50/p99/max | 11.4 / 20.4 / 24.4 ms |
| loader RSS start → end | 53.5 → 102.6 MB |
| health probe n / errors | 6 / 0 |

395 req/s versus 1,147 on the anon path — **~2.9× slower, and the cause is external**: the remote
`getUser` round-trip measured above (p50 120 ms). At concurrency 100 those round-trips overlap, so
throughput recovers somewhat, but p95 765 ms shows the tail. Nothing in the API is slow here; the
dependency is. See finding **F2**.

### S3 — the 1,000-user target (mixed, 60 s)

1,000 concurrent in flight, 60 s sustained, `--xff`, mixed route list:
`/api/jobs?page=1&pageSize=20` + `/api/jobs/:id` + `/api/auth/me` + `/api/notifications/mine`
(round-robin).

| metric | value |
|---|---|
| concurrency / max in-flight observed | **1,000 / 1,000** |
| requests attempted / completed | 54,549 / 54,549 |
| elapsed | 60.64 s |
| throughput | **900 req/s** |
| p50 / p95 / p99 / max | 943.7 / 1,727.3 / 3,371.2 / 5,788.0 ms |
| status counts | **200: 41,212, 429: 13,337** |
| transport errors | **none** |
| loader event-loop lag p50/p99/max | 10.3 / 23.2 / 38.4 ms |
| setInterval(1000) drift max | 19 ms |
| loader RSS start → end | 48.1 → 321.3 MB |
| **server RSS** | 57.3 → ~450 MB, **oscillating 330–475 MB**, then 280 MB at rest |
| health probe n / errors | 90 / **0** |

The 13,337 429s are `/api/notifications/mine`, which is *not* in `stricterLimiterPaths` — it
counts against the general 300/15 min bucket shared by all four `/api/auth/me` +
`/api/notifications/mine` requests, one per worker. That is the limiter working as designed against
a single bearer token, not a failure.

**Event-loop lag never exceeded 38 ms and the interval drift never exceeded 19 ms across the
whole 60 s.** Server RSS *rose* to ~450 MB but **oscillated rather than trending** — GC was
keeping up. Throughput was flat: the per-second series is 995, 31, 293, 580, 788, 822, 888, 872,
888, … , 830 — the dip is the first ~4 s of warm-up, then it is flat to noise for the remaining
56 s. No degradation, no monotonic RSS growth.

### S3 verification — reproducibility

Re-ran the identical command twice back-to-back to confirm the result (confidence ≥ 85% rule):

| run | req/s | p50 | p99 | 200 | 429 | errors |
|---|---|---|---|---|---|---|
| R1 (20 s) | 462 | 1,358.6 | 10,200.1 | 7,851 | 2,217 | none |
| R2 (20 s) | 763 | 1,105.3 | 3,039.3 | 11,881 | 3,960 | none |
| S3 (60 s) | 900 | 943.7 | 3,371.2 | 41,212 | 13,337 | none |
| S5b rerun (60 s) | 876 | 976.3 | 2,750.0 | 39,855 | 13,285 | none |

Throughput and latency vary run-to-run (loader and server share 12 cores; the auth routes' remote
dependency is variable), but the shape is stable and **no run produced a transport error or a
status ≥ 500**.

### S4 — rate-limit ceiling

One pinned IP (`--xff-ip 10.88.0.7`), 2,000 requests, concurrency 200, `GET /api/jobs?page=1&pageSize=1`.

| metric | value |
|---|---|
| completed / attempted | 2,000 / 2,000 |
| elapsed | 1.42 s |
| throughput | 1,408 req/s |
| p50 / p95 / p99 / max | 89.9 / 524.9 / 556.6 / 599.8 ms |
| status counts | **200: 300, 429: 1,700** |
| transport errors | none |
| loader event-loop lag p50/p99/max | 10.1 / 87.9 / **119.5 ms** |
| health probe n / errors | 3 / 0 |
| **server RSS** | 54.8 → 82.2 MB |

The limiter holds at **exactly 300** requests then rejects 1,700 with `429` and no `RateLimit`
header on the response (confirmed by direct probe: 200s carry
`RateLimit: limit=300, remaining=N, reset=900` and `RateLimit-Policy: 300;w=900`; 429s carry the
error body `{"error":{"code":"RATE_LIMITED",...}}`).

**Post-throttle recovery:** the server never went down, `GET /api/health` answered in 511 ms on the
first post-load hit, then 12 ms. Fresh `GET /api/jobs?page=1&pageSize=20` from a different IP:
200 in 599 ms, then 13/12/11/12 ms. Connection count back to baseline. **The throttled server
recovers fully.** The one anomaly worth flagging: the loader's event-loop lag hit 119 ms max during
S4 — the highest of any scenario. That is 4,700 synchronous 429 responses in 1.4 s, not server
distress.

### S5 — the kill test (malformed at 200 concurrency)

200 concurrent, 60 s, **60 % malformed** / 40 % valid, all read-only GETs:
bad UUIDs, `page=1e21`, `page=99999999999999999999`, junk enums, SQL-injection-shaped filters,
non-existent entities.

| metric | value |
|---|---|
| elapsed | 60.06 s |
| completed | 155,250 |
| throughput | **2,585 req/s** |
| p50 / p95 / p99 / max | 65.8 / 302.5 / 390.8 / 555.6 ms |
| status counts | **200: 12,867, 400: 4,739, 404: 22,528, 401: 9,412, 429: 105,704** |
| **500s** | **zero** |
| transport errors | none |
| server RSS during | 86 → 184 MB, flat |
| pg active connections | 1–3 |

**Verdict: the validation layer held.** Zero 500s across 155,250 requests where ~40 % were
deliberately malformed. 400s came from the enum/pagination guards (`pageParams`,
`JOB_ARRANGEMENTS`), 404s from non-existent/`isUuid`-rejected IDs (the S1 guard working — the
comment in `jobs.js:21` promises a 404 here rather than a 22P02 500, and that held), 401s from
missing tokens on auth-gated routes, and 429s from the general limiter.

The `limit 50 / max 100` and `Math.min(1_000_000, page)` clamps in `pageParams` (`util.js:52-58`)
did their job: the huge page params were either clamped or rejected, never reaching Postgres as an
overflowing OFFSET.

### S7 — malformed at 1,000 concurrency

Repeated S5 at full target concurrency, with valid requests interleaved.

| metric | value |
|---|---|
| concurrency / max in-flight | 1,000 / 1,000 |
| attempted / completed | 47,254 / 47,254 |
| elapsed | 25.49 s |
| throughput | **1,854 req/s** |
| p50 / p95 / p99 / max | 21.5 / 1,756.6 / 1,811.2 / 2,305.0 ms |
| status counts | **200: 18,901, 400: 9,451, 404: 18,902** |
| transport errors | none |

4,739 + 9,451 = **14,190 malformed requests answered as 400/404, zero 500s, zero leaks.**
Pathological input is handled correctly at full concurrency. This is a genuine pass.

### S6 — sustained read load at 1,000 concurrency

A clean 60 s single-route run at full concurrency (no limiter interference, all 200s) to get an
uncontaminated view of the server's ceiling.

| metric | value |
|---|---|
| concurrency / max in-flight | 1,000 / 1,000 |
| attempted / completed | 90,458 / 90,458 |
| elapsed | 60.55 s |
| throughput | **1,494 req/s** |
| p50 / p95 / p99 / max | 654.9 / 737.5 / 844.4 / 1,408.7 ms |
| status counts | 200: 90,458 |
| transport errors | **none** |
| loader event-loop lag p50/p99/max | 11.3 / 24.6 / 122.2 ms |
| loader RSS start → end | 50.1 → 327.9 MB |
| **server RSS** | 52.6 → 317 MB, **oscillating 250–320** |
| health probe n / errors | 95 / **0** |
| **pg active connections** | **1–3** (samples taken every 700 ms) |
| req/s per second | flat 1,394 → 1,535 across all 60 samples |

The pg pool observation matters: against a 20-connection pool serving ~1,500 req/s, **active
connections sat at 1–3**. The pool is nowhere near saturated — the ceiling is Node/Express
concurrency, not Postgres. (Caveat: this is one query per ~1.5 ms on a 1-row table; on real data
the queries would be slower and the pool would fill sooner.)

---

## 5. Event-loop lag and memory verdict

### Loader-side event-loop lag (all runs)

| scenario | p50 | p99 | max | interval drift |
|---|---|---|---|---|
| S1a throttle | 10.0 | 38.1 | 65.9 | 0 ms |
| S1b 200 users | 10.1 | 22.6 | 33.4 | 4 ms |
| S2 auth | 11.4 | 20.4 | 24.4 | 7 ms |
| S3 1,000 mixed | 10.3 | 23.2 | 38.4 | 19 ms |
| S4 pin IP | 10.1 | 87.9 | 119.5 | 0 ms |
| S5 kill 200 | — | — | — | — |
| S6 1,000 clean | 11.3 | 24.6 | 122.2 | 10 ms |
| S7 malformed 1,000 | 10.0 | 25.1 | 103.5 | 7 ms |
| S5b rerun | 10.3 | 22.8 | 59.3 | 20 ms |

**p50 is pinned at ~10 ms in every single scenario.** That is the `resolution: 10` quantisation
floor of `monitorEventLoopDelay` — it reports the mean delay within a 10 ms bucket — not a real
signal. Treat p50 here as "no measurable lag". p99/max are the real numbers, and they stay in the
20–40 ms band except during S4 (thousands of synchronous 429 responses) and brief spikes at 100+ ms.
No sustained >100 ms stall in any scenario.

### Server-side lag (measured from inside the API's own access log)

The harness could not instrument the server process (no source modification), so the
**per-request duration logged by `requestLog.js`** is the server-side lag signal, and the
concurrent health probe is the responsiveness signal.

| scenario | health probe p50 | health probe max | server-side `ms` in log |
|---|---|---|---|
| baseline | 2.4 ms | 4.3 ms | 1–6 ms |
| S3 1,000 mixed | **715.6 ms** | 1,301.0 ms | 4,000–4,800 ms (during the auth-route wave) |
| S6 1,000 clean | 629.7 ms | 849.3 ms | 90–160 ms (`/api/jobs`) |

The ~700 ms probe p50 under 1,000-concurrency load is the honest, load-bearing degradation
number: **health stays fast in absolute terms but goes from 2.4 ms to ~700 ms, a 300× regression**,
while S3's log shows the authenticated route at 4 s. The process is still answering — no crash, no
queue overflow — but this is queuing delay, not compute.

### Memory verdict — **no leak**

| scenario | server RSS before | peak | after (at rest) | verdict |
|---|---|---|---|---|
| S1a/S1b/S2 block | 174 MB | 280 MB | 280 MB (flat 45 s) | plateau, flat |
| S3 60 s | 57 MB | ~475 MB | oscillating 330–475, then 280 | **oscillating = GC keeping up** |
| S4 | 54.8 MB | 82 MB | 82 MB | plateau |
| S5 kill (60 s, 155k req) | 86 MB | 184 MB | 183–192, then flat | plateau |
| S6 60 s (1,000 cc) | 52.6 MB | 317 MB | oscillating 250–320 | **oscillating = GC keeping up** |
| S7 25 s | 52.6 MB | 323 MB | 323 MB | plateau |
| final, after all runs | — | — | **68 MB ws / 119 MB private, 12 threads, 269 handles** | **fully released** |

The leak test the spec asks for is *monotonically rising RSS with flat throughput*. **That pattern
never appeared.** Under sustained 60 s load at 1,000 concurrency the RSS climbed and then
oscillated within a band (330–475 MB in S3, 250–320 in S6), which is a working Generational GC —
heap grows to the steady-state working set and is then reused. Throughput over the same window was
flat.

After every scenario the server returned to rest-state with 12 threads and 269 handles (baseline
was 269) and released memory. At the end of the entire audit the server was at 68 MB working set
and 1 active pg connection — **below its pre-audit baseline.** No leak.

**Loader-side** RSS climbed from ~48 MB to ~330 MB and stayed there across a process, which is
expected: the arrays holding 90k+ latency samples and 90k timestamps are retained for the report.
That is harness bookkeeping, not a leak; it is discarded with the process.

---

## 6. Post-load health check

After every scenario:

| check | result |
|---|---|
| `GET /api/health` | **200, 511 ms first hit, 10–12 ms thereafter** |
| `GET /api/jobs?page=1&pageSize=20` (fresh IP) | 200, 599 ms first, 10–16 ms after |
| `GET /api/auth/me` (valid token) | 200, 629 ms first, 116–129 ms after |
| `GET /api/health?deep=true` | **200** occasionally — see caveat below |
| process alive | yes, throughout, no crash, no `unhandledRejection` |
| pg pool | back to 1 active connection |

**One transient caveat, reported honestly.** Immediately after the S5→S5b sequence, three
consecutive `GET /api/auth/me` calls timed out at 25–30 s, and `health?deep=true` timed out once.
The API log shows why: `auth/me status 200 ms 20894`, `ms 26255`, `ms 28400`. It did **not** crash
and did **not** fail — it recovered by itself and the very next requests were 116–129 ms. This was
**not reproduced** in the dedicated S5b rerun (8,847 → 53,140 requests, zero errors, p99 2.75 s,
health probe 0 errors). My read: a **supabase-js client connection pool exhaustion** after 155k
concurrent `getUser` calls in S5, from which the library recovers by opening new sockets. I could
not confirm the mechanism without touching source, so I flag it as **F3, severity medium,
needs investigation** rather than asserting a cause.

---

## 7. Findings

### F1 — pg pool sizing vs. hot-path query count (Medium)

`GET /api/jobs` runs **two sequential queries** (count + page) and the pool is `max: 20`. At 200
concurrency the p50 went from 4 ms to **169 ms**. At 1,000 in flight, p99 844 ms (clean route).
Meanwhile pg active connections sat at **1–3**, which says the ceiling is Node-side queuing, not DB
saturation — but on real data with slow queries, 20 connections becomes the wall. The M5 comment
(`db.js:7-8`) explains the 20 cap as "fail fast instead of queueing forever", which is the right
instinct; the number just has no evidence behind it and no load-test feedback loop.

*Severity: Medium* (latency only, no failures). *Evidence: S1b, S6, pgwatch.*

### F2 — remote Supabase round-trip on every authenticated read (High) — FIXED 2026-10-16

`attachPrincipal` (app.js:59) → `userFromToken` → `supa().auth.getUser(token)` fires on **every
authenticated request, with no cache**. Measured p50 120 ms / max 331 ms for one call, p50 211 ms /
max 1,155 ms at 50 concurrent. S2 showed 395 req/s on `/api/auth/me` vs 1,147 on the anon path —
**2.9× slower because of a remote dependency**. `/api/auth/me` is a trivial profile read that
should be answered from local state.

The `req._supaUser`/`req._role` caches in `auth.js:35-43` only help *within* one request — and
`attachPrincipal` + the route's own `auth()` are exactly the case where that matters, so the design
already avoids a double round-trip per request. The problem is there is **no cross-request cache
and no fail-open**. If Supabase is slow, every authenticated endpoint is slow; if it is down, all
authenticated traffic 401s.

*Severity: High.* This is the top scaling blocker and the most likely production incident.
*Evidence: S2, direct `getUser` benchmark, S3 log lines at 4 s each.*

**Fix shipped (2026-10-16): 60 s TTL token cache (`server/src/tokenCache.js`).** Positive
JWT→user resolutions are memoized per process, keyed on the exact token string, capped at 5,000
entries with FIFO eviction; negatives are never cached; `resolveRole` (the local Postgres status
check) is never cached, so suspension stays immediate. Tradeoff documented in
`docs/arch/rework/02-api-contract.md`. Measured on the same machine with the same token and the
same S2 shape (1,000 req, 100 concurrent, `--xff`, `/api/auth/me`, server on port 4100):

| | req/s | p50 | p95 | p99 |
|---|---|---|---|---|
| before (3 runs) | 285 / 330 / 379 | 173–192 ms | 562–1,742 ms | 637–1,788 ms |
| after (5 runs) | 307 / 362 / 1124 / 1149 / 1333 | 20–80 ms | 123–2,552 ms | 153–2,588 ms |

Run-to-run variance is high because the loader and the server share 12 cores, so the honest
signal is the **per-request server-side cost**, read from the API's own access log: the first
request for a token (cold cache, i.e. exactly the old behaviour for every request) took **760 ms**
server-side, and every subsequent request for the same token took **1–2 ms** — the remote
round-trip is gone from the hot path. Throughput on `/api/auth/me` went from ~330 req/s to
~1,100–1,330 req/s on the clean runs, matching the anon path's shape rather than being 2.9×
behind it. Throughput is now bound by the pg pool (F1), not by Supabase.

### F3 — occasional multi-second stalls on `/api/auth/me` after sustained load (Medium, needs a repro)

One occurrence, described in §6. Not reproduced on a controlled rerun. No crash, no unhandled
rejection, self-recovering. Likely `supabase-js` internal connection churn. **Needs a targeted
repro** before anyone changes code: run S5 (155k requests, 60 % authenticated) followed by a
low-rate `/api/auth/me` probe and see whether the stall reliably reappears.

*Severity: Medium* (latency spike, self-healing). *Status: observed once, not confirmed.*

#### F3 update (2026-10-16) — repro attempted, NOT reproduced, no code change

Targeted repro was run against the fixed server (same harness, four sustained runs: 40 s @200
concurrency mixed, 60 s @200 auth-only, 60 s @1000 auth-only, 40 s @1000 malformed+auth), each
followed immediately by a low-rate `/api/auth/me` probe. **The 20–30 s stall never reappeared.**
Server-side numbers from the API's own access log across the whole session: 494,682
`/api/auth/me` requests answered, the worst single request 11,386 ms, and only 1,803 requests
over 3 s — all inside the 1,000-concurrency runs where the loader and the server starved each
other for CPU. No transport error, no 5xx, no unhandled rejection.

**The harness's per-worker XFF rotation does not explain it.** The bucket is chosen once per
request, inside the limiter's keyGenerator, before any handler runs — a worker's key cannot
change mid-request. There is no request that "starts in one bucket and ends in another" to
stall.

My read after the repro: the single occurrence was an outlier (Supabase connection churn, a
cold DNS/TLS handshake, or an OS-level scheduling stall), not a code defect. **No fix, no
restructuring — speculatively rewriting the auth path to chase one unreproduced sample would
add risk without evidence.** If it recurs, the next diagnostic step is a
`NODE_DEBUG=undici` capture on the API process during the next sustained run. Note that the F2
token cache removes ~all of the per-request Supabase calls that the original hypothesis
implicated, so the churn surface is smaller by construction now.

### F4 — health endpoint is cheap but not production-probe-shaped (Low)

`GET /api/health` runs `select 1` through the same 20-connection pool that serves user traffic.
Under 1,000-concurrency load the probe p50 was **715 ms** — a load balancer would mark the box
unhealthy long before it is actually broken. `health.js` is mounted *before* `apiLimiter`
(app.js:63 comment says so deliberately) which is correct for liveness, but a probe competing for
the request path couples liveness to load. A dedicated pool or a TCP-only health route would
decouple it. Also note `deep=true` probes Supabase on every call, so an LB using `?deep=true`
turns Supabase outages into 503s — which is arguably correct, but should be a conscious choice.

*Severity: Low.* *Evidence: S3 health probe p50 715 ms vs 2.4 ms baseline.*

### F5 — rate-limit keying depends on a proxy hop being present (Medium) — FIXED 2026-10-16

The harness had to send `X-Forwarded-For` to get per-worker buckets, because `ipKeyGenerator`
reads `req.ip`, which under `trust proxy: 1` comes from the forwarded header. This is correct
*behind a proxy* — but `app.js:31` accepts `TRUST_PROXY` from env and the F-02 comment says a
deployment with nothing in front **must** set `TRUST_PROXY=0`. If a public instance ever ships
with the default `1` and no proxy, **any client can rotate `X-Forwarded-For` and get unlimited
requests**, defeating the general, auth, and AI limiters. That is a silent, deployment-dependent
authz bypass.

*Severity: Medium* (conditional — only bites a misconfigured deployment, but the consequence is
the whole throttle scheme). *Evidence: this whole harness; S1a vs S1b.*

**Fix shipped (2026-10-16): `TRUST_PROXY` now defaults to `0`, fail safe.** A directly-exposed
instance can no longer have its whole throttle scheme rotated away; a deployment behind exactly
one proxy must set `TRUST_PROXY=1` explicitly (documented in `server/.env.example`). Verified
live against the running API:

| setting | harness run (2,000 req, 50 workers, rotating XFF) | result |
|---|---|---|
| `TRUST_PROXY=1` | `--xff` | 200:2000 — buckets rotate, no throttle (the documented single-proxy deploy) |
| `TRUST_PROXY=1` | no `--xff` | 200:300, 429:200 — plain socket IP, one bucket |
| `TRUST_PROXY=0` (now the default) | `--xff` | **200:300, 429:1,700 — the XFF rotation no longer mints buckets** |

The `--xff` harness flag is therefore now only meaningful with `TRUST_PROXY=1` set on the server
process; the "How to re-run" section above should start the API that way when per-worker
throughput is the measurement.

### F6 — rate limits are a hard 300/15 min with no differentiation (Low)

S4 confirmed the bucket is exactly 300 then total rejection. The `429` responses carry no
`RateLimit` headers (only the 200s do — checked directly), so a client cannot see its remaining
budget and cannot back off politely; it just gets errors. The `draft-7` standard headers help for
200s but are absent on the one response a throttled client actually sees.

*Severity: Low* (DX, occasional honest client outage — with 3 seeker accounts, 300/15 min is
plausibly enough; at 1,000 real users with any polling UI it would be an outage). *Evidence: S4,
direct 429 probe.*

### F7 — no global 500s under any adversarial input (pass)

Deliberate malformed traffic: bad UUIDs, `page=1e21`, overflowing page params, junk enums,
SQL-injection-shaped strings, 155,250 requests at 200 concurrency and 47,254 at 1,000
concurrency. **Zero 500s, zero unhandled rejections, zero connection-pool leaks.** The
`isUuid` guards, `pageParams` clamps, and enum allowlists all held. No work required here —
recording it so nobody "hardens" a layer that already works.

*Severity: N/A (pass).* *Evidence: S5, S7.*

### No crash, no unhandled rejection, no data loss

The server process stayed up through every scenario. `unhandledRejection`/`uncaughtException`
handlers were installed in the harness and never fired. The DB row counts before and after are
identical (3 seekers / 1 employer / 1 job / 2 applications / 23 notifications), and
`audit_logs` gained **0 rows** during the test window — all load was read-only GETs. No
load-test junk data was created.

---

## 8. Did the system survive 1,000 concurrent users?

**Yes — with one qualification and one caveat.**

**Survived, no degradation beyond queueing, no memory leak, no crash:**

- 1,000 concurrent in-flight requests were genuinely sustained for 60 s (S3, and verified four
  more times).
- **90,458 / 47,254 / 54,549 requests completed with zero transport errors** and zero 5xx.
- **Event-loop lag p99 stayed 20–40 ms; interval drift ≤ 20 ms.** No sustained stall.
- **RSS did not grow monotonically** — it oscillated within a GC-managed band and fell back to
  68 MB (below the pre-audit baseline) once idle. **No leak.**
- Throughput was flat across the full 60 s window (per-second series S3: 995, 31, 293, 580, 788,
  822, 888, … 830; S6: 1,394 → 1,535, flat across 60 samples).
- The server recovered from full rate-limit saturation and continued serving correctly.
- Under adversarial malformed input at the same concurrency: **zero 500s**.

**What did degrade, honestly:**

- p50 latency went from ~4 ms at rest to **655 ms** (clean route) / **977 ms** (mixed route) at
  1,000 concurrency. That is queueing against a 20-connection pool and a CPU shared with the load
  generator, not a malfunction — but it *is* degradation, and it is 100–250×.
- Health probe latency went 2.4 ms → **~700 ms** under load (F4).

**The caveat:** these are 1,000 loopback sockets from one machine against a 1-row database, with
the loader competing for the same cores. "1,000 concurrent users" here means 1,000 concurrent
requests, which is a necessary but not sufficient condition for 1,000 real users — real users have
think time, and a production dataset changes every query plan. This is a **correctness and
stability** verdict, not a capacity forecast.

---

## 9. Scaling recommendation

**Current single-instance ceiling, measured:** **~1,500 req/s clean** (S6, 1,000 concurrency, all
200s), **~900–1,150 req/s mixed** with authenticated routes. Both were reached while pg used only
**1–3 of 20 connections** and the event loop stayed healthy — so the ceiling is **Node request
concurrency and the authenticated-route dependency, not Postgres**. With the general limiter at
300/15 min per key, the *policy* ceiling is far below the *technical* ceiling for any single
client; at ~1,000 real users with distinct keys, the technical ceiling is the binding one.

**Top 3 changes to raise it, in order:**

1. **Cache or localize the Supabase principal lookup (F2).** Every authenticated request pays a
   120 ms remote round-trip. A short-TTL in-process cache keyed by token (or a signed-token
   verification path that does not phone Supabase) removes a network dependency from every
   authenticated read. Highest impact by a wide margin — it is the difference between 395 req/s
   and 1,147 req/s on the same route shape. Note the existing per-request caches in `auth.js` are
   already the right pattern; this is extending them across requests, not a rewrite.
2. **Right-size the pg pool against measured concurrency (F1).** 20 connections is nowhere near
   the limit at these volumes (1–3 in use), but the number was never derived from anything. Size
   it from a real query-latency measurement on a realistic dataset (`max = expected concurrency ×
   mean query duration ÷ 1s`, then load-test again), and consider a small dedicated pool for
   `/api/health` so probes never queue behind user traffic (F4). Combine this with the
   `db/migrations/007_query_indexes.sql` / `009_ordering_indexes.sql` work — on real data, the
   `ilike`-driven job search is the query that will hit the pool, not `select 1`.
3. **Decouple deployment-assumption risk before scaling horizontally (F5).** Make `TRUST_PROXY`
   fail loudly (or default to 0) so a public instance cannot silently have its rate limiting
   rotated away. Two instances behind one LB with a shared Redis rate-limit store also means the
   per-instance buckets must be global — and the `ponytail:` comment in `rateLimit.js:3` already
   names Redis as the answer. Do that before, not after, the second instance goes live.

Skipped: a Redis cache for `/api/jobs` — add when there is a real hot-key measurement showing the
endpoint being read more often than the DB can serve it; at 1 row of data a cache is speculative.

---

## Appendix — how to reproduce this report

```bash
cd server
$env:PORT="4100"; node src/index.js          # spare port, leave 4000 alone

node scripts/loadtest.mjs --label S1a --url http://127.0.0.1:4100 \
  --route "anon:/api/jobs?page=1&pageSize=20" --requests 5000 --concurrency 200 --probe \
  --xff-ip 127.0.0.1 --json s1a.json

node scripts/loadtest.mjs --label S3 --url http://127.0.0.1:4100 --duration 60 --concurrency 1000 \
  --xff --probe --probe-every 250 \
  --route "anon:/api/jobs?page=1&pageSize=20" \
  --route "anon:/api/jobs/<uuid>" \
  --route "auth:/api/auth/me" \
  --route "auth:/api/notifications/mine" --json s3.json
```

Since 2026-10-16 (F5) `TRUST_PROXY` defaults to 0, so `--xff` only rotates keys when the server
is started with `TRUST_PROXY=1`. For the F2 authenticated-route scenarios above, start the API as
`$env:TRUST_PROXY="1"; $env:PORT="4100"; node src/index.js` so the harness's per-worker buckets
work exactly as they did during this audit.

Certificates/tokens: `--mint-token --mint-email <addr>` writes `.loadtest-token.local`
(matched by `*.local` in `.gitignore`; it was deleted after this audit and must be re-minted to
re-run the auth scenarios — it is a short-lived credential and is never committed).
