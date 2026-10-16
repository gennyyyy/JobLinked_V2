# Phase 5 — Security Audit (read-only), 2026-10-15

Scope: JobLinked Express API + React SPA. Read-only audit; no code modified.
Note: another agent was concurrently editing `server/src/routes/admin.js` and frontend
services — the mid-edit state was observed; re-verify those two files after their edits land.

## Verdict

**No Critical findings.** No High findings. 2 Medium, 4 Low, 2 informational.
The guard matrix from `docs/arch/rework/02-api-contract.md` holds in every handler, all SQL is
parameterized, no secrets are committed, and no XSS sinks exist in the frontend.

## Findings

| ID | Severity | OWASP | File:line | Issue | Recommended fix |
|---|---|---|---|---|---|
| F-01 | Medium | A05:2021 Security Misconfiguration | `server/src/app.js:47`, `server/src/middleware/rateLimit.js:42-52` | `apiLimiter` is mounted **before** route-level `auth`, so `req.user?.id` in its `keyGenerator` is always undefined — every route keys by `req.ip` only, contrary to the comment. Verified empirically: with `trust proxy 1` and no proxy, a client-set `X-Forwarded-For: 9.9.9.9` changes `req.ip` (test shown below), so the 300/15min and 100/15min buckets are rotated trivially in dev/direct deployments. Behind exactly one proxy in prod this is correct. Side effect: NAT'd users share one bucket (false 429s). | Either mount a per-user limiter inside the routers (after `auth`) or accept IP keying but make `trust proxy` env-driven so non-proxy deploys ignore `X-Forwarded-For`. At minimum fix the misleading comment. |
| F-02 | Low | A05:2021 | `server/src/app.js:24` | `app.set('trust proxy', 1)` is hardcoded. Safe only if prod is truly behind exactly one hop (nginx/Caddy/CF per the comment); two chained proxies give the wrong IP, zero proxies give a spoofable one. | `app.set('trust proxy', process.env.TRUST_PROXY ?? (production ? 1 : false))`. |
| F-03 | Low | A09:2021 Logging / integrity | `server/src/routes/auth.js:143-149` | `POST /api/audit` writes any non-empty ≤100-char string as `action` from any authenticated token (including unprovisioned). Attribution (user id) is correct, but the audit-log event names are client-forgeable — a user can write their own false `login`/`logout` rows. | Allowlist known client-event actions (login/logout/password.change/reset) or namespace them (store as `client.<action>`). |
| F-04 | Low | A04:2021 Insecure Design | `server/src/routes/profiles.js:141-142`, `:204` | `doc_type` is free text (only "required"). No SQL risk (parameterized; sanitized into notification messages), but unbounded values land in `employer_documents.doc_type` and admin UI. | Validate against a short allowlist or `reference_data where category='document_type'` if that catalog exists. |
| F-05 | Low | A04:2021 | `server/src/routes/jobs.js:240-273`, `admin.js:548-577`, `profiles.js:32-49` | Enum columns are validated, but numeric/date columns are not: `PATCH /jobs/:id {salary_min:"abc"}` or `{deadline:"nonsense"}` reaches Postgres → 22P02 → generic 500 instead of 400. Handlers rely only on the column-name allowlist. | Coerce/validate numeric and date columns in the same loop that builds `patch` (reject non-numeric non-null values with 400). |
| F-06 | Info | A05:2021 | `server/src/upload.js:27-31` | Uploads validated by extension allowlist + size only; content (magic bytes) is never inspected and the client MIME is ignored (correct). Allowed extensions exclude html/svg, and helmet's `nosniff` plus `res.sendFile`'s extension-derived content type make polyglot stored-XSS impractical. | Optional hardening: verify leading bytes (PDF `%PDF`, PNG `\x89PNG`, JPEG `\xFF\xD8`) before writing the DB row. |
| F-07 | Info | — | `server/src/app.js:28-35` | Helmet defaults verified present for an API (nosniff, frameguard, HSTS set — browsers ignore it over HTTP so dev is unaffected, CORP `cross-origin` correct for cross-origin file fetches). CORS fails closed. | None — do not regress. |

Evidence for F-01 (run against `node_modules/express` v4, port 3999):
```
no XFF  -> {"ip":"::ffff:127.0.0.1","ips":[]}
XFF set -> {"ip":"9.9.9.9","ips":["9.9.9.9"]}
```

## Verified secure (do not regress)

**Auth & authorization**
- Every route enumerated (`routes/*.js`): all have `auth`/`tokenAuth`/`optionalAuth`; every `requireRole` ride sits on a route that also has `auth`. **No missing-auth routes.**
- Guard matrix holds in each handler: seeker ⇄ own `id` (`/applications/mine`, `/seekers/me`, `/files/resumes/*`, `/applications/seekers/:seekerId/*`, credentials reads); employer ⇄ `company_id = token id` (jobs list/create, applications job/company lists, dashboard, documents, accreditations); admin ⇄ all. `company_id` is **never** taken from the body (jobs.js:214, profiles.js).
- `canViewJob` (jobs.js:23-27) returns 404 (not 403) for non-owners — no existence leak; `listStatusFor` pins non-admins to `published` so drafts/pending can't be enumerated.
- Role resolution reads only DB role tables (`auth.js:12-22`); a client-supplied role is trusted **nowhere**. `requireRole` reads `req.user.role` server-side only.
- `POST /auth/provision` idempotency race handled (`23505` → 200 existing row); super-admin body role gated on `req.user.app_metadata?.role` which is service-role-set only (super-admin invite writes it via `auth.admin.updateUserById`, admin.js:188) — unforgeable, fails closed. Invitee cannot escalate to super-admin without it.
- `tokenAuth` routes (`/auth/provision`, `/auth/audit`, `/auth/me`) authorize on no role inside; provision validates token authenticity but skips the provisioned-row check per Addendum B — correct.

**Injection**
- Every SQL statement uses bound parameters. The only interpolated identifiers come from hardcoded allowlists: `ORDER_COLS`/`ORDER_DIR` (jobs.js:9,61-62), `JOB_COLS`/`ADMIN_JOB_COLS`, `USER_TABLES`, fixed `(table, order)` constant pairs in `credByLink`/`seekerChildRead`/`seekerChild`.
- LIKE metacharacters escaped via `likeEscape` (util.js:20) on every `ilike` including the jobs `skills` filter (jobs.js:94 uses the same escape inline) and admin search; skills filter passes an array param `::text[]` — never concatenated.
- No `Object.assign`/spread of `req.body` into queries; all PATCH handlers iterate explicit column allowlists; admin's information_schema allowlist is DB-driven, never client-keyed.

**File security**
- Upload: destination is `bucket + user.uuid` only; filename is `randomUUID + basename(original).replace(/[^a-zA-Z0-9._-]/g,'_')` — path traversal via filename/doc_type impossible; extension allowlist; 5 MB global / 2 MB PDF limits; multer errors → 400; orphan files unlinked when the DB insert fails.
- Download `GET /files/:bucket/*` (profiles.js:287-316): bucket allowlisted; `path.normalize` + `startsWith(uploadDir+bucket+sep)` containment check defeats `..`/encoded `%2e%2e` (decoded before the handler); ownership enforced (own resume, employer via linked `job_applications`, own-company document, or admin); `fs.existsSync` before `sendFile`.

**Abuse**
- Limiter order verified: `/api/auth` (100/15min), POST `/api/documents` + POST `/api/files/*` (50/15min) mounted before `apiLimiter` (300/15min), whose `skip` mirrors exactly those paths so no double counting; `/api/health` exempt for LB probes; 429s carry the standard error envelope; `aiLimiter` runs *after* `auth` so its per-user key actually works (20/15min).
- `insert … select … where exists(published and deadline ok)` for applications (applications.js:64-73) — TOCTOU-safe deadline enforcement inside the write.
- No email/company enumeration surface: provisioning/me paths require a valid token; admin-only invite returns 409 on existing email.

**Secrets & config**
- `git log --all --diff-filter=A -- **/.env` — nothing. Only `.env.example` files tracked; both contain placeholders (`<password>`, `<service-role-key>`, empty `OPENROUTER_API_KEY`).
- `server/.env` + `.env.local` exist on disk and are gitignored (`.gitignore:12,16`) — never committed.
- `git grep` for `DATABASE_URL|SUPABASE_SERVICE_ROLE|service_role|OPENROUTER_API_KEY`: hits are docs/examples/server-only code only. `src/**` references no server secret — browser gets only `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; `supabase.js` uses `persistSession:false` + Bearer tokens, no cookies.
- `env.js` fails fast (exit 1) with a non-leaking message; `db.js` uses `connectionString` + bounded pool.

**Transport & headers**
- CORS allowlist fails **closed** (`corsOrigins?.length ? ... : ['http://localhost:5173']`), no `*`, `credentials` not enabled (Bearer header auth only) → no CSRF surface, no cookies anywhere in the stack.
- Header-injection guard validated: `requestId` echoes client `X-Request-ID` only after `/^[\w.-]{1,128}$/` (requestId.js:7-12).
- Frontend XSS: grep of `src/**` for `dangerouslySetInnerHTML|innerHTML|document.write|eval(` — zero hits; job `description`/`requirements` rendered as JSX text (PublicJobDetail.jsx:88,95), company `website` rendered as text not `href` — no `javascript:` vector.
- Error middleware logs only `code/sqlState/message + method/path + request id` — never the query/parameters; body-parser 400/413 mapped to client errors.
- Retention purge (admin.js:298-312): server-scheduled, no request input, cutoff computed by Postgres (`make_interval`), writes `data.purge` audit row with `user_id NULL`.
