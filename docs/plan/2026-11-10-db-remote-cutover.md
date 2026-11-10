# Plan: Local Postgres → remote Postgres cutover (85.211.176.236 / myapp_db)

Status: **Production cutover complete** (2026-11-11) — local API, Vercel app and Vercel server all serve the VPS store. Prod verified: `health?deep=true` → `{ok, db:'ok', auth:'ok'}`, `/api/jobs` → `total=102`. Remaining: credential rotation, legacy-key revocation, uploads persistence.

> `docs/plan/plan.md` was concurrently replaced by the "Production Login Fix" plan; this migration plan lives here instead. ADR: `docs/arch/adr-044-remote-postgres-cutover.md`.

## State

- Local source of truth: Postgres 18.6 `joblinked`, 21 tables, 102 vacancies. API is the only DB client (`server/.env` `DATABASE_URL`, user `postgres`).
- Remote target: `85.211.176.236:5432`, PG 18 (Ubuntu), db `myapp_db`, user `myapp_user`.
- **Dump complete:** `backups/joblinked-cutover.dump` — 186,489 B, 178 restore entries, 21 `TABLE DATA` entries (all tables), includes `pgcrypto` + `pg_trgm` extension entries.
- Gate B (TLS): PASS — SSL negotiation succeeds; node-postgres specifics captured in the completion log below.

## Completion log (2026-11-10)

- Gate A: remote `PostgreSQL 18.6 (Ubuntu)`, `myapp_user` owns `myapp_db`, empty target, `pgcrypto` + `pg_trgm` present.
- Restore: `pg_restore --no-owner --no-privileges` of `backups/joblinked-cutover.dump`. Only errors: 2 × `COMMENT ON EXTENSION` (extension comments need extension ownership; cosmetic). All 21 tables restored; per-table exact counts match local (`backups/counts-local.txt` vs `counts-remote.txt`).
- TLS finding: node-postgres treats `sslmode=require` as `verify-full` and rejects the VPS self-signed cert (`DEPTH_ZERO_SELF_SIGNED_CERT`; API served 503). Fixed with `sslmode=no-verify` (pg-specific mode; encrypt, no CA check). psql/libpq does not reproduce this because libpq's `require` is encrypt-only. Upgrade path: real CA cert + `sslmode=verify-full`.
- `server/.env` now: `DATABASE_URL=postgresql://myapp_user:<pwd>@85.211.176.236:5432/myapp_db?sslmode=no-verify`; API restarted; `GET /api/health?deep=true` → `{ok, db:'ok', auth:'ok'}`; `GET /api/jobs` → `total=102`.
- Remote write proof: temp table create+insert+rollback succeeded as `myapp_user`.
- Local Postgres: zero application connections after cutover (only the admin psql session). Left installed with data intact (rollback path). **2026-11-11 decision: disable it indefinitely** (owner request) — stop `postgresql-x64-18` + set startup to Disabled (needs an elevated shell; not yet executed).
- Root `.env.local`: stale `DATABASE_URL=…@85.211.176.236…myapp_db` line removed.
- 2026-11-11: `server/.env` was found reverted to localhost while the running API still used Azure via a terminal-exported `DATABASE_URL` (dotenv never overrides exported vars). Fixed: the working URL was recovered from the API process env and pinned into `server/.env`; both now identical (`sslmode=no-verify`, 48-char password).
- 2026-11-11 (production): every `/api/*` route returned `X-Vercel-Error: FUNCTION_INVOCATION_FAILED`. Root cause from Vercel runtime logs: `Invalid export found in module "/var/task/server/src/app.mjs". The default export must be a function or server.` Vercel's Express preset auto-detected `server/src/app.js` (a `createApp()` factory, no default export) as the service entrypoint. Fixed by pinning `"entrypoint": "src/index.js"` on the `server` service in `vercel.json` (commit `3673d93`). Env vars were never the cause of that 500.
- 2026-11-11 (production env matrix): server → `DATABASE_URL` (`?sslmode=no-verify`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_DIR=/tmp/uploads`, `CORS_ORIGIN`, `TRUST_PROXY=1`; app → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`; `VITE_API_URL` absent (same-origin `/api/*` rewrite). Redeploy without build cache for the app.
- 2026-11-11 (integration pitfall): the Vercel↔Supabase Marketplace integration linked a different project (`ftcobgvzyqgtamwchxki`) and synced `SUPABASE_SECRET_KEY`, `POSTGRES_*`, `NEXT_PUBLIC_*` — none of which this app reads. App values must use project `omvnwyawamotmzvehdgo`; the new publishable/secret keys are in use locally and in Vercel.
- 2026-11-11 (key-probe lesson): a publishable key answers `401 {"message":"Secret API key required"}` on `/rest/v1/` root — that is not a revocation signal. Probe validity via `/auth/v1/settings` (200 = valid). `health?deep=true` also treats any 4xx from Supabase as "up", so it cannot prove a key works.
- 2026-11-11 (prod verification): `https://www.joblinked.site/api/health?deep=true` → `{ok:true, db:"ok", auth:"ok"}`; `GET /api/jobs` → `total=102` from the VPS store.

## Remaining

1. Rotate the `myapp_user` password (it travelled through chat): `ALTER USER … WITH PASSWORD '<openssl rand -hex 24>'`, update `server/.env` + Vercel `DATABASE_URL`, restart API / redeploy server.
2. Revoke the legacy Supabase keys (`service_role` JWT still returns 200 and was exposed in chat): Supabase → Settings → API → disable legacy keys. Do **not** rotate the JWT secret (invalidates every user session).
3. **Uploads persistence:** Vercel Functions are ephemeral, so `UPLOAD_DIR=/tmp/uploads` means resumes/avatars/logos do not survive. ADR-037 still requires a persistent API host — move the Express API to the VPS (or add object storage) as its own slice.
4. `fail2ban` on the VPS + narrow the `0.0.0.0/0` pg_hba rule once a static egress/tunnel exists.

## Security note

pg_hba `0.0.0.0/0` scram on 5432 = Internet-wide password surface. Requirement: long random password; add fail2ban; narrow allowlist once static egress/tunnel exists.
