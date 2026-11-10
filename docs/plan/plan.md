# Production Login Fix — Deployment Configuration Plan (rev. 3)

> **For agentic workers:** Runbook for the human operator (dashboard/VPS access required). Verification probes can be run by the architect on request. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production login works end-to-end AND the API runs where the code says it must — one persistent Node process (ADR-037).

**Architecture:** Login chain = Turnstile → Supabase → Express `/api/auth/me`. **Root cause of the login 400 (found 2026-11-11):** the Turnstile secret configured in Supabase is invalid. A fresh, real token from the live widget (709 chars, issued by Chrome on `/login`) posted to Supabase with a dummy account returns `400 captcha_failed — captcha protection: request disallowed (invalid-input-secret)`. Cloudflare's siteverify rejects the **secret**; the widget, sitekey, browser, app payload, and password path are all correct. Firefox and Chrome fail identically. One other blocker remains from rev. 1:

1. **Turnstile secret invalid (blocks every login).** Fix is dashboard-only: replace the secret in Supabase with the one from the Cloudflare widget that owns sitekey `0x4AAAAAAF7XYodVEYDcBaUx`. No rebuild, no redeploy.
2. **Architecture conflict.** `vercel.json` deploys the API as a Vercel service, which is serverless. ADR-037 (Accepted 2026-11-04) explicitly forbids this: uploads write to local disk via `multer.diskStorage` (read-only filesystem in a serverless function), rate limiters are in-memory, and the retention purge is an in-process `setInterval`. Rev. 1's Task 2 (just set env vars) would produce working logins and broken uploads. **Decision required before Tasks 2–3.**
3. **Database URL defect — resolved 2026-11-10/11.** The remote store at `85.211.176.236/myapp_db` is live and serving (`sslmode=no-verify`, because node-postgres treats `require` as verify-full while libpq does not). Local API, Vercel app, and Vercel server all serve it. See `docs/plan/2026-11-10-db-remote-cutover.md`.

**Tech Stack:** Vercel (static SPA), Supabase (auth), Cloudflare Turnstile, Express + PostgreSQL (API runtime TBD: persistent host per ADR-037).

**Spec:** This conversation's diagnosis (2026-11-10) + `docs/arch/adr-037-production-api-single-node.md` + `docs/arch/adr-044-remote-postgres-cutover.md` + `docs/ops/deploy-runbook.md`.

## Global Constraints

- **No secrets in this repo or this doc**; values referenced by source location only.
- ADR-037 single-instance invariant is binding: one persistent Node process for the API. No replicas, no serverless (unless ADR-037 is formally superseded — that is a Lead Architect decision, not an implementation shortcut).
- `VITE_*` values are baked at build time — every env change needs a rebuild (runbook §5).
- Vercel env vars apply only to new deployments.
- One Supabase project → one captcha secret → all environments use sitekey `0x4AAAAAAF7XYodVEYDcBaUx`; the Supabase secret must be copied from that same Cloudflare widget (`invalid-input-secret` = wrong or stale secret, not a browser problem).

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

### Task 0.5: Repair the Turnstile secret pairing (unblocks every login)

- [ ] **Step 1:** Cloudflare dashboard → Turnstile → the widget with sitekey `0x4AAAAAAF7XYodVEYDcBaUx` → Settings → copy its **Secret Key**.
- [ ] **Step 2:** Supabase dashboard → project `omvnwyawamotmzvehdgo` → Authentication → Attack Protection (CAPTCHA) → provider **Turnstile** → replace the secret → Save. The secret is server-side; no app rebuild or API restart.
- [ ] **Step 3:** Verify by logging in with a real account. A wrong password must now produce `Invalid login credentials`; `Verification failed` or a `captcha_failed` 400 means the secret is still wrong or belongs to another widget.
- [ ] **Step 4:** If the Cloudflare widget no longer exists, create a new widget (hostnames `localhost` + `joblinked.site`), set its sitekey in `.env.local` and Vercel `VITE_TURNSTILE_SITE_KEY`, rebuild the app deployment, and paste the new secret into Supabase. Update the sitekey in Global Constraints then.
- [ ] **Step 5 (fallback only):** If the secret cannot be recovered now, disable CAPTCHA protection in Supabase to restore logins, record the accepted bot risk, and re-enable once the pairing is fixed.

### Task 1: Remote database connection — DONE (2026-11-10/11)

`myapp_db` was restored on `85.211.176.236` and `server/.env` now points at it with `sslmode=no-verify` (node-postgres treats `require` as verify-full and rejects the VPS self-signed cert; libpq does not). `health?deep=true` → `{ok, db:'ok', auth:'ok'}`, `/api/jobs` → 102. Production (Vercel server) serves the same store. Details: `docs/plan/2026-11-10-db-remote-cutover.md`. No further action.

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
