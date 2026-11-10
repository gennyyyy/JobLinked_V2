# ADR-044: Cutover from local Postgres to remote Postgres (85.211.176.236)

- Status: Implemented — local cutover 2026-11-10; production cutover verified 2026-11-11 (Vercel app + server serve the VPS store)
- Date: 2026-11-10
- Related: docs/plan/plan.md (migration contract), docs/ops/deploy-runbook.md

## Context

The dev system currently runs against a local Postgres 18.6 (`joblinked`). The plan is to move all application data to the remote Postgres at `85.211.176.236:5432/myapp_db` (user `myapp_user`) and treat the local instance as unused. The Express API remains the only process that touches Postgres (`DATABASE_URL`, server-side only); Supabase stays auth-only, so Supabase user UUIDs referenced by app FKs remain valid after the move.

## Decision

1. One-shot physical move of schema + data with `pg_dump` / `pg_restore` (repo-native path; `scripts/backup.sh` and `docs/ops/deploy-runbook.md` already document DATABASE_URL cutover), then flip `server/.env` `DATABASE_URL` to the remote with a percent-encoded password and `sslmode=require`.
2. Rejected: ongoing `postgres_fdw` bridge ("CREATE SERVER azure_vps_postgres ... USER MAPPING FOR authenticated"). Reasons:
   - Role `authenticated` does not exist in the local cluster (verified via `pg_roles`); it is a Supabase/PostgREST role. The only DB client here connects as `postgres`.
   - FDW keeps the local Postgres in every request path (local-pg → network → remote-pg): +1 hop, ~2× query latency, degraded plan/pushdown, and a running local service the plan intends to disregard.
   - The snippet as proposed created a server and a mapping but no foreign tables (`IMPORT FOREIGN SCHEMA` missing), so nothing could be queried regardless.
   - User-mapping passwords are stored in the cluster catalog (`pg_user_mappings`) — avoidable, given the password must live in `server/.env` anyway.
3. FDW remains acceptable for a temporary read-only peek or a selective `INSERT ... SELECT` fetch if a full dump path is blocked by credentials; mapping would be `FOR postgres`, into a scratch schema.
4. Rollback: repoint `DATABASE_URL` at localhost. Local DB is only read during migration, so rollback is lossless.

## Consequences

- Every dev query now crosses the WAN; `db.js`'s 5s connect / 120s statement timeouts are assumed adequate, verified during cutover checks.
- Remote password is a secret held in `server/.env` (gitignored); no new storage mechanism is introduced.
- CI keeps using its local scratch DB (`INTEGRATION_DATABASE_URL`), unaffected.
- TLS: node-postgres (`pg`) interprets `sslmode=require` as `verify-full` and rejects the VPS self-signed certificate (`DEPTH_ZERO_SELF_SIGNED_CERT`). The working setting is `sslmode=no-verify` (encrypted, server unverified). libpq/psql behaves differently (`require` = encrypt-only), so psql tests do not predict Node behavior. Upgrade path: real CA cert, then `sslmode=verify-full`.
- Restore was applied as `myapp_user` with `--no-owner --no-privileges`; only failures were two `COMMENT ON EXTENSION` statements (extension comments require extension ownership) and are cosmetic.
