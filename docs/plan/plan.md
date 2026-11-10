# Production Login Fix — Deployment Configuration Plan (rev. 2)

> **For agentic workers:** Runbook for the human operator (dashboard/VPS access required). Verification probes can be run by the architect on request. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production login works end-to-end AND the API runs where the code says it must — one persistent Node process (ADR-037).

**Architecture:** Login chain = Turnstile → Supabase → Express `/api/auth/me`. Captcha pairing is fixed (sitekey `0x4AAAAAAF7XYodVEYDcBaUx` pairs with the Supabase secret — proven by working local login). Two blockers remain, both discovered while executing rev. 1:

1. **Architecture conflict.** `vercel.json` deploys the API as a Vercel service, which is serverless. ADR-037 (Accepted 2026-11-04) explicitly forbids this: uploads write to local disk via `multer.diskStorage` (read-only filesystem in a serverless function), rate limiters are in-memory, and the retention purge is an in-process `setInterval`. Rev. 1's Task 2 (just set env vars) would produce working logins and broken uploads. **Decision required before Tasks 2–3.**
2. **Database URL defect.** The only candidate prod URL (`.env.local`) fails two ways: password `say my name` is unencoded (must be `say%20my%20name`), and TLS fails with `DEPTH_ZERO_SELF_SIGNED_CERT` — the remote Postgres at `85.211.176.236` presents a self-signed cert while installed `pg-connection-string` treats `sslmode=require` as verify-full. Also ADR-044 names user `myapp_user` while the URL says `postgres`. Credentials are unverified.

**Tech Stack:** Vercel (static SPA), Supabase (auth), Cloudflare Turnstile, Express + PostgreSQL (API runtime TBD: persistent host per ADR-037).

**Spec:** This conversation's diagnosis (2026-11-10) + `docs/arch/adr-037-production-api-single-node.md` + `docs/arch/adr-044-remote-postgres-cutover.md` + `docs/ops/deploy-runbook.md`.

## Global Constraints

- **No secrets in this repo or this doc**; values referenced by source location only.
- ADR-037 single-instance invariant is binding: one persistent Node process for the API. No replicas, no serverless (unless ADR-037 is formally superseded — that is a Lead Architect decision, not an implementation shortcut).
- `VITE_*` values are baked at build time — every env change needs a rebuild (runbook §5).
- Vercel env vars apply only to new deployments.
- One Supabase project → one captcha secret → all environments use sitekey `0x4AAAAAAF7XYodVEYDcBaUx`.

## Review Focus

- **Login works but uploads 500** — the signature of running the disk-backed API on serverless. Probe: log in, upload a resume, download it. Expected: the API runs on a persistent host.
- **`/api/health` 503 after a clean boot** — DB unreachable: TLS (`DEPTH_ZERO_SELF_SIGNED_CERT`), credential, or host-firewall failure. Probe: `?deep=true`, then the Node probe script against `DATABASE_URL`.
- **Stale production build** — dashboard shows a var but the deployment predates it. Probe: deployed bundle content, never the dashboard alone.
- **CORS fails closed** — API `CORS_ORIGIN` must list the exact frontend origin; else login POSTs get no `Access-Control-Allow-Origin`.
- **Captcha returns on prod only** — Turnstile widget hostname allowlist missing the prod domain.

---

### Task 0: Architecture decision (blocks everything else)

- [ ] **Step 1:** Choose the API runtime.
  - **A (recommended, ADR-compliant):** persistent Node process on the VPS that already hosts Postgres (`85.211.176.236`, runbook §2 systemd/pm2 + nginx), `VITE_API_URL=https://<api-host>` on Vercel, remove the `server` service from `vercel.json`. Fixes uploads, limiters, retention.
  - **B (stopgap, requires superseding ADR-037):** keep the Vercel serverless API, accept: resume/document uploads fail (read-only fs), limiter state per-instance, no retention purge. Acceptable only for a demo, never for real job-seeker data.
- [ ] **Step 2:** Record the choice (new ADR if B; rev. 1 plan otherwise). Implementation proceeds per choice below.

### Task 1: Repair the remote database connection (both paths need this)

- [ ] **Step 1:** Confirm the real credentials: DB user (`myapp_user` per ADR-044 or `postgres`), password (percent-encode spaces/`@`/`:`/`/`), database `myapp_db`, host `85.211.176.236`.
- [ ] **Step 2:** Fix TLS semantics — append `&uselibpqcompat=true` to the URL (keeps `sslmode=require` as encrypt-without-verify, per installed pg-connection-string) **or** install a CA-signed cert on the server. Verify from the dev machine (architect runs the read-only probe): expect `CONNECTED` + expected `public tables` count + `schema_migrations` present.
- [ ] **Step 3:** If the remote DB is empty/fresh: apply migrations with `db/apply-migrations.sh --status` then a normal run (per runbook migration ledger). No schema edits.

### Task 2A: Deploy the persistent API (if Task 0 = A)

- [ ] **Step 1:** On the VPS: clone repo to `/srv/joblinked`, `npm ci --prefix server --omit=dev`, env file per runbook §1 — `NODE_ENV=production`, `DATABASE_URL` (Task 1), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from local `server/.env`), `CORS_ORIGIN` = prod frontend origin, `TRUST_PROXY` per hop count, `UPLOAD_DIR=/srv/joblinked/uploads` (absolute), `PORT=4000`.
- [ ] **Step 2:** systemd unit per runbook §2, `enable --now`, verify `curl 127.0.0.1:4000/api/health?deep=true` → `{"ok":true,"db":"ok","auth":"ok"}`.
- [ ] **Step 3:** Expose it (nginx + TLS, or Cloudflare tunnel) and verify from outside: `https://<api-host>/api/health?deep=true`.
- [ ] **Step 4:** Vercel **app** project: set `VITE_API_URL=https://<api-host>`, keep `VITE_TURNSTILE_SITE_KEY=0x4AAAAAAF7XYodVEYDcBaUx`, redeploy. Remove the `server` service + rewrite from `vercel.json` (commit).

### Task 2B: Stopgap serverless API (only if Task 0 = B)

- [ ] **Step 1:** Vercel `server` service env vars: `DATABASE_URL` (Task 1), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN`; redeploy; `/api/health` → 200.
- [ ] **Step 2:** Vercel `app` project: confirm `VITE_TURNSTILE_SITE_KEY` for Production, redeploy.
- [ ] **Step 3:** Document the accepted deviations (uploads, limiters, retention) in a new ADR.

### Task 3: End-to-end verification (either path)

- [ ] **Step 1:** Production login → lands in role portal, no bounce.
- [ ] **Step 2:** Path A only: upload a resume as a job seeker, download it back — proves disk persistence and backups' worth.
- [ ] **Step 3:** `/api/health?deep=true` → `{"ok":true,"db":"ok","auth":"ok"}`.

### Rollback

Vercel: instant rollback per deployment. VPS: previous `git` revision + `systemctl restart`. Env edits reverted in place. No schema changes are made by this plan beyond running the existing migration ledger.
