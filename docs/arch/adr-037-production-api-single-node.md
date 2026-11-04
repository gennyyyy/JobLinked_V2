# ADR-037 — Production API runs as a single persistent Node process

**Status:** Accepted 2026-11-04 (Lead Architect; `plan/2026-11-04-06-ops-deployment-plan.md`)

## Context

Three server behaviors assume one long-lived process:

1. uploads persist to local disk (`UPLOAD_DIR`, default `./uploads`);
2. rate limiting uses an in-memory store (`express-rate-limit`);
3. the daily retention purge is an in-process `setInterval`.

A serverless API would lose uploads on cold starts, share no limiter state, and
have no scheduler. The frontend already deploys statically (Vercel SPA rewrite).

## Decision

The API deploys as **one persistent Node process** (VPS or container) behind the
static frontend. The deploy runbook documents the single-instance invariant,
uploads directory ownership/backup, and explicit `CORS_ORIGIN`/`TRUST_PROXY`
values.

## Consequences

- Scaling out requires rework first: uploads to Supabase Storage (routes, client,
  DB paths), limiter backed by Postgres/Redis, retention via external scheduler.
  Do not "just add replicas".
- Backups must cover **both** the Postgres dump and the uploads directory; a
  restore drill proves both.
