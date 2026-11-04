# ADR-037: API runtime resilience — bounded requests, self-healing dev process, watchdog

Date: 2026-11-05 · Status: accepted · Decides runtime behaviour of the Express API under failures

## Context

The API repeatedly "stopped responding" during development. Root causes found
by live reproduction (all previously shipped fixes in this repo):

1. An unhandled `pool` `'error'` (pooled connection dropped by Postgres) killed
   the process — `node --watch` does not respawn a crashed child.
2. `node --watch` restarted the API on metadata-only filesystem events (13
   restarts in 45s with zero content changes on Windows).
3. No request/socket bounds at all: a stuck request can pin a browser's
   per-origin connection pool indefinitely.

Users must never see a randomly dead API, whatever the trigger.

## Decisions

1. **DB layer (`db.js`).** `statement_timeout=120s`, `idle_in_transaction_session_timeout=180s`
   (pg startup packet) so a lock-wedged or leaked statement can never pin one of
   the 20 pool slots forever. A wedged pool used to mean 503-endless until restart.
2. **Server bounds (`index.js`).** `requestTimeout=60s`, `headersTimeout=30s`,
   `setTimeout=60s` — every socket is cut eventually (verified: stalled headers
   answer `408` within ~47s; stalled bodies are destroyed ~60s).
   `keepAliveTimeout=25s` (default 5s) removes most of the classic
   browser-reuses-a-just-closed-socket race that showed up as random failed
   clicks on POSTs.
3. **Crashes are loud and fast (`index.js`).** `uncaughtException` /
   `unhandledRejection` log one structured line (`uncaught_exception`) and exit 1.
   Half-alive is worse than dead.
4. **Body-parser contract (`app.js`).** An oversized body now answers the
   parser's real status: **HTTP 413** with `{ error: { code: 'PAYLOAD_TOO_LARGE' } }`
   (was HTTP 400 + same code). Malformed bodies stay 400 `BAD_REQUEST`.
   The SPA keys on `error.message`/`error.code`, so no client change.
5. **Auth memo(`tokenCache.js`).** Definite 4**x** (≠429) Supabase answers are
   memoized for the same 60 s TTL as valid users: an expired token in a tab
   stops paying one round-trip per request. 429/5xx/status-0 are never memoized
   (an outage must not turn a valid session into a remembered 401).
   Contract doc updated to match; the revocation-delay note is unchanged.
6. **Dev runner (`server/scripts/dev.mjs`, wired as `npm run dev`).**
   Replaces `node --watch`. Restarts only on real content changes (mtime+size
   polling, `*.test.js` and `__tests__/` excluded), respawns a died child in
   ~1s, **health-gates ships**: before spawning it asks `/api/health`; if
   another healthy instance owns the port it idles and re-checks every 15s —
   two dev windows or two agents can never wedge each other. A port held by a
   dead process is not recoverable in-process: after 3 failed boot cycles it
   exits with a clear message.
7. **Watchdog (`server/scripts/watchdog.{ps1,vbs}` + scheduled task
   `peso-api-watchdog`).** Every minute: if `/api/health` is unhealthy on the
   configured port and no dev runner is alive, start one (hidden window, via
   VBScript so no console flash). A hard external kill (taskkill on node) is
   back online within a minute — verified live: 000 → 200 with one log line.
   Log only when it acts (`server/scripts/watchdog.log`, gitignored).
   Remove with `schtasks /Delete /TN peso-api-watchdog /F`; pause with
   `schtasks /Change /TN peso-api-watchdog /DISABLE`.

## Consequences

- No in-app path wedges a socket, a pool slot, or a process longer than one
  minute, whatever goes wrong.
- One machine-level artifact (the scheduled task) exists consciously; the
  watchdog is the only piece that survives a hostile `taskkill /IM node.exe /F`
  on this box.
- For deployment, decisions 1–5 travel with the code (a process manager
  replaces 6–7).

## Verification (2026-11-05, all live)

- Postgres backends killed mid-run: requests answered, health 200, recovery,
  0 5xx across the session.
- Full process tree killed: health back to 200 within one watchdog cycle.
- Runtime probe battery: 150 mixed concurrent → 0 failures, p95 1.3s; 60
  aborted requests → no damage; malformed/oversized/unknown → correct; stalled
  clients bounded; 63 files / 463 tests green; `eslint .` clean.
