# Admin Rate-Limit and Over-Fetching Fix Plan — 2026-11-13

**Status (2026-11-13):** executed and deployed — commits `e67caa6` (rate bucket),
`4bc9287` (GET cache), `a842267` (messages); live on production as `d901d15`.

**Goal:** stop the admin console from self-inflicted 429s and make failure messages honest:
(1) raise the authenticated throttle, (2) stop refetching the same lists on every page switch,
(3) distinguish "rate-limited" / "service restarting" from "check your connection".

**Baseline (evidence):** production journal 2026-11-12 21:52 UTC — ~20 admin requests in 8 s
(`applications`/`jobs`/`users`/`audit-logs`/`roles`/`permissions`/`accreditations`/`stats` +
`notifications/mine`), then `429 RATE_LIMITED` on every endpoint until the 15-min window reset.
The 502s were separate manual service stops. Runbook: "Known limits and follow-ups".

**Tech stack:** unchanged. JavaScript/JSX, Vitest, `npm test` + `npm run lint` green.

## Global constraints

- No schema changes; no new dependencies (the cache is ~30 lines in `api.js`, not a library).
- The rate limit stays a **hard abuse ceiling** — no skip for admins, only a higher bucket.
- The response cache must be **per authenticated identity** (`session.user.id`, `anon` when absent)
  and must never serve one user's data to another. Cache only `GET` + `2xx` JSON; never cache
  errors, 429s, or blobs. Any non-GET request clears the cache.
- 10 s TTL — this is a page-switch smoothing aid, not an offline store.
- Commits: one per task, imperative.

---

## Task 1 — Server: split the authenticated and anonymous bucket

**Agent:** backend. **Files:** `server/src/middleware/rateLimit.js`,
`server/src/__tests__/f01-f02-rate-limit-keying.test.js` (extend).

- [ ] `apiLimiter.limit` becomes a function: `(req) => req.user?.id ? 1000 : 300`
      (window 15 min unchanged; keyGenerator unchanged). Comment the rationale: admin consoles
      fetch several lists per mount; 300 was tuned before that.
- [ ] Keep `stricterLimiterPaths` and the 429 envelope unchanged.
- [ ] Tests: authenticated principal gets the 1000 bucket; anonymous gets 300; the per-user
      keying from F-01 still holds (two users do not share a bucket).
- [ ] `npm test` + `npm run lint` in `server/`.

## Task 2 — Client: coalesce and cache GETs

**Agent:** frontend. **Files:** `src/shared/lib/api.js`,
`src/shared/lib/__tests__/api.test.js` (extend).

- [ ] In `api.js`, wrap the GET path (JSON only, not `blob()`):
      - **in-flight coalescing** — identical `url` (path + query) while a request is pending
        returns the same promise, so two components fetching the same list fire one request;
      - **short cache** — `Map` keyed by `${session.user.id ?? 'anon'}::${path}`, TTL 10 s,
        storing the parsed JSON body. Only 2xx GETs are stored.
- [ ] Any non-GET request clears the whole cache (mutations invalidate reads). A changed session
      identity naturally misses old keys; add an explicit clear on logout if the auth service
      exposes one (`src/shared/services/auth.js`).
- [ ] Never cache 401/429/5xx or non-JSON bodies.
- [ ] Tests: two concurrent identical GETs → one `fetch`; second GET within TTL → no `fetch`;
      after TTL → `fetch`; after a POST → `fetch` again; different user id → separate entry;
      429 → not cached.

## Task 3 — Client: honest error messages

**Agent:** frontend. **Files:** `src/shared/lib/api.js`, page error rendering if it swallows
`error.message` (check `src/features/super-admin/*.jsx`), `api.test.js`.

- [ ] `unreachable()` (fetch rejection — includes CORS failures during a restart): message becomes
      "Can't reach the server right now — it may be restarting. Please try again in a moment."
      Keep `.status = 0` and the `.detail` hint.
- [ ] 429: if `apiError.code === 'RATE_LIMITED'`, surface "Too many requests — please wait a
      moment." (server message fallback).
- [ ] 5xx: surface "The service is having trouble — please try again shortly." when the body is
      not a JSON error (nginx 502 HTML currently yields "Bad Gateway").
- [ ] Verify the admin pages render `error.message` (not a fixed string); fix the shared/error
      component if they do not. Small copy change only.
- [ ] Tests: message assertions for network failure, 429, and 502-HTML; run
      `npx vitest run src/shared/lib/__tests__/api.test.js` + `npm run lint`.

## Verification

- [ ] Local: `npm test` (root + server), `npm run lint`.
- [ ] Manual (local, after deploy): switch admin pages rapidly for a minute — no 429 at ~2.5 req/s;
      DevTools Network shows one request per unique list within 10 s, then a refetch.
- [ ] Production after deploy: the same rapid-switch pass stays under the new bucket; a forced 429
      shows the new message (e.g., temporarily lower the limit in a dev run, not production).

## Handoff

| Task | Agent |
|---|---|
| 1 | `backend` |
| 2, 3 | `frontend` |
| Review + deploy | Lead Architect sign-off; owner deploys (runbook § Deploy) |
