# API cutover: Vercel Functions → VPS persistent process

**Status:** Approved 2026-11-12 (owner selected Option A after production 503s).
**Goal:** Run the Express API as one persistent Node process on the VPS that already hosts Postgres, so the stack becomes: Vercel (static SPA) → VPS Express API → VPS Postgres, with Supabase handling authentication only.

**Why now:** Production `www.joblinked.site` returns 503 on `/api/*`. Vercel runtime logs show `db_unavailable` with PostgreSQL code **`53300` (`too_many_connections`)**. Each Vercel function instance opens `pg.Pool({ max: 20 })` (`server/src/db.js`) against the single direct VPS Postgres; scaling out exhausts `max_connections`. This is the deployment ADR-037 forbids.

**Architecture after cutover:**

```text
Browser ──auth──▶ Supabase Auth (JWT)
Browser ──API───▶ https://api.joblinked.site  (Express, systemd, nginx TLS)
                    ├──▶ Postgres 127.0.0.1:5432/myapp_db
                    ├──▶ /srv/joblinked/uploads
                    └──▶ Supabase Admin API (JWT verify / invites only)
```

**Constraints:**
- ADR-037 is binding: one API process, no replicas, no serverless API.
- No secrets in this repo. Values are copied from the operator's local `server/.env` / password manager.
- `VITE_*` values are baked at build time; a Vercel env change needs a redeploy.
- Keep the Vercel `server` service until the VPS API passes external verification. Removing it earlier turns the current 503s into a full outage.

**Review focus:**
- Upload survives an API restart (proves `UPLOAD_DIR` is real disk, not `/tmp`).
- Rate limiters are per-process (one process = correct, unlike serverless).
- CORS preflight from the exact frontend origins succeeds.
- `TRUST_PROXY` matches the real hop count, or IP-keyed limiters collapse.
- Turnstile/login is unaffected: Supabase auth is untouched.

---

## Task 1: Deploy the API on the VPS

**Files (VPS):** `/srv/joblinked` (repo), `/srv/joblinked/server/.env`, `/srv/joblinked/uploads`, `/etc/systemd/system/joblinked-api.service`.

- [ ] **Step 1: Back up before touching anything.**

```sh
# on the VPS
sudo mkdir -p /srv/joblinked-backups
pg_dump -Fc -U myapp_user -h 127.0.0.1 myapp_db > /srv/joblinked-backups/pre-cutover-$(date +%F).dump
tar -czf /srv/joblinked-backups/pre-cutover-uploads-$(date +%F).tgz -C /srv/joblinked uploads 2>/dev/null || true
```

`pg_dump` prompts for the `myapp_user` password unless `PGPASSWORD` or `~/.pgpass` is set.

- [ ] **Step 2: Confirm the runtime.**

```sh
node -v            # must be Node 20+ (dev-verified on Node 24)
which node         # use this absolute path in the systemd unit
```

- [ ] **Step 3: Create the service user and directories.**

```sh
sudo useradd --system --create-home --shell /usr/sbin/nologin joblinked 2>/dev/null || true
sudo mkdir -p /srv/joblinked /srv/joblinked/uploads /srv/joblinked-backups
sudo chown -R joblinked:joblinked /srv/joblinked /srv/joblinked-backups
sudo chmod 750 /srv/joblinked/uploads
```

- [ ] **Step 4: Clone and install.**

```sh
sudo -u joblinked git clone https://github.com/gennyyyy/JobLinked_V2.git /srv/joblinked
cd /srv/joblinked
sudo -u joblinked npm ci --prefix server --omit=dev
sudo chmod +x db/apply-migrations.sh scripts/backup.sh
```

If `/srv/joblinked` already exists: `sudo -u joblinked git -C /srv/joblinked pull --ff-only` instead of clone. If the repo is private, give `joblinked` a read-only deploy key or clone as a user that already has access.

- [ ] **Step 5: Write `/srv/joblinked/server/.env` (mode 600, owner `joblinked`).**

```sh
sudo -u joblinked tee /srv/joblinked/server/.env >/dev/null <<'EOF'
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://myapp_user:<PASSWORD>@127.0.0.1:5432/myapp_db?sslmode=disable
SUPABASE_URL=https://omvnwyawamotmzvehdgo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
CORS_ORIGIN=https://www.joblinked.site,https://joblinked.site
TRUST_PROXY=1
UPLOAD_DIR=/srv/joblinked/uploads
LOG_LEVEL=info
EOF
sudo chown joblinked:joblinked /srv/joblinked/server/.env
sudo chmod 600 /srv/joblinked/server/.env
```

- `DATABASE_URL`: copy the password from the existing working URL; only the host changes to `127.0.0.1` and `sslmode=disable` (same host, no TLS needed). If a Unix socket is preferred, use `host=/var/run/postgresql`.
- `TRUST_PROXY=1` assumes nginx terminates TLS directly. Set `2` only if Cloudflare proxies `api.joblinked.site` in front of nginx.
- `CORS_ORIGIN`: the first entry is used for employer-invite links; keep `https://www.joblinked.site` first.

- [ ] **Step 6: Install the systemd unit.**

```ini
# /etc/systemd/system/joblinked-api.service
[Unit]
Description=joblinked API
After=network-online.target

[Service]
User=joblinked
WorkingDirectory=/srv/joblinked/server
EnvironmentFile=/srv/joblinked/server/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=2
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now joblinked-api
sleep 2
curl -s http://127.0.0.1:4000/api/health?deep=true
```

Expected: `{"ok":true,"db":"ok","auth":"ok"}`.

- [ ] **Step 7: Confirm boot log has no warnings.**

```sh
sudo journalctl -u joblinked-api -n 30 --no-pager
```

Expect `uploads directory { dir: '/srv/joblinked/uploads' }` and **no** `CORS_ORIGIN unset` / `TRUST_PROXY unset` warnings.

**Exit criteria:** local health `200`, `/api/jobs` returns `total` > 0, boot log clean.

---

## Task 2: Expose the API with TLS

**Files (VPS):** `/etc/nginx/sites-available/api.joblinked.site`, DNS record.

- [ ] **Step 1: DNS.** Create `A` record `api.joblinked.site → 85.211.176.236`. If the domain is Cloudflare-proxied, either grey-cloud this record (DNS only) or set `TRUST_PROXY=2`.

- [ ] **Step 2: nginx reverse proxy.**

```nginx
# /etc/nginx/sites-available/api.joblinked.site
server {
    listen 80;
    server_name api.joblinked.site;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.joblinked.site;

    ssl_certificate     /etc/letsencrypt/live/api.joblinked.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.joblinked.site/privkey.pem;

    client_max_body_size 6m;          # API caps uploads at 5 MB + multipart overhead

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 65s;       # API request timeout is 60s
    }
}
```

```sh
sudo ln -s /etc/nginx/sites-available/api.joblinked.site /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.joblinked.site
sudo nginx -t && sudo systemctl reload nginx
```

- [ ] **Step 3: Verify from outside.**

```sh
curl -s https://api.joblinked.site/api/health?deep=true
curl -s "https://api.joblinked.site/api/jobs?limit=1"
```

Expected: health `{ok, db:'ok', auth:'ok'}`; jobs JSON with `total`.

- [ ] **Step 4: Verify CORS preflight from the production origin.**

```sh
curl -s -i -X OPTIONS https://api.joblinked.site/api/auth/me \
  -H "Origin: https://www.joblinked.site" \
  -H "Access-Control-Request-Method: GET" \
  | grep -i "access-control-allow-origin"
```

Expected: `access-control-allow-origin: https://www.joblinked.site`.

**Exit criteria:** public HTTPS health is green; CORS header matches the Vercel origin.

---

## Task 3: Point the Vercel app at the VPS API

**Files:** Vercel project env; no repo change yet.

- [ ] **Step 1:** Vercel → project `joblinked_v2-71mq` → Settings → Environment Variables → Production:
  - `VITE_API_URL=https://api.joblinked.site` (no trailing slash — `apiUrl()` appends `/api/...`)
  - keep `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`
- [ ] **Step 2:** Redeploy the app (env vars apply only to new deployments).
- [ ] **Step 3:** In the browser, log in and load `/jobs`. Network panel: requests go to `api.joblinked.site`, no `/api/*` calls to `www.joblinked.site`.
- [ ] **Step 4:** Verify an upload: job seeker → profile → resume/image; then restart the API (`sudo systemctl restart joblinked-api`) and download the same file. It must still exist.

**Exit criteria:** login, jobs, and upload all work against the VPS API; `/api/*` on `www.joblinked.site` is no longer used.

---

## Task 4: Remove the Vercel server service

**Files:** `vercel.json`.

- [ ] **Step 1:** Only after Task 3 passes, replace `vercel.json` with the single-SPA config:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 2:** Commit and push:

```sh
git add vercel.json
git commit -m "chore(deploy): serve API from the VPS, keep Vercel static-only"
git push origin main
```

- [ ] **Step 3:** Confirm the new Vercel deployment is READY and the SPA still loads every route.
- [ ] **Step 4:** Remove server-only env vars from the Vercel project (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN`, `TRUST_PROXY`, `UPLOAD_DIR`, `OPENROUTER_*`, `METRICS_TOKEN`, `ALERT_WEBHOOK_URL`, `RETENTION_DISABLE`, `LOG_LEVEL`). Keep only `VITE_*`.

**Exit criteria:** Vercel has one static deployment; no API function exists; all browser calls target `api.joblinked.site`.

---

## Task 5: Harden and keep it running

- [ ] **Step 1: Close remote Postgres.** The API now runs on the DB host. Change `pg_hba.conf` so `myapp_user` connects only from `127.0.0.1` (or the Unix socket), then `sudo systemctl reload postgresql`. Keep an admin path via SSH tunnel.
- [ ] **Step 2: Backups.** Add to the cron from `docs/ops/deploy-runbook.md` §7:

```sh
30 2 * * * joblinked DATABASE_URL=postgresql://myapp_user:<PASSWORD>@127.0.0.1:5432/myapp_db?sslmode=disable UPLOAD_DIR=/srv/joblinked/uploads BACKUP_DIR=/srv/joblinked-backups bash /srv/joblinked/scripts/backup.sh >> /var/log/joblinked/backup.log 2>&1
```

- [ ] **Step 3: Logs and restart policy.** `journalctl -u joblinked-api` is the log; the unit has `Restart=always`. Confirm after a deliberate `systemctl restart` that health recovers.
- [ ] **Step 4: Monitoring.** Point the existing `/api/metrics` scraper and `/api/health?deep=true` probe at `https://api.joblinked.site`.

**Exit criteria:** Postgres is not publicly reachable; nightly backup includes DB + uploads; service survives a restart.

---

## Task 6: Final verification

- [ ] `curl https://api.joblinked.site/api/health?deep=true` → `{"ok":true,"db":"ok","auth":"ok"}`
- [ ] Log in at `https://www.joblinked.site`; role portal loads.
- [ ] Public `/jobs` lists vacancies.
- [ ] Upload a resume/avatar/logo; restart API; download succeeds.
- [ ] `PGSTAT`/`pg_stat_activity` shows a small, stable connection count (no 20-per-instance spikes).
- [ ] Vercel runtime logs show no `db_unavailable` for the app service (it no longer exists).

---

## Rollback

1. **Before Task 4:** rollback is just Vercel → set `VITE_API_URL` back to empty and redeploy; the existing `server` service and `/api` rewrite still exist.
2. **After Task 4:** `git revert <cutover commit>` (restores the `server` service + `/api` rewrite), set `VITE_API_URL` to empty, redeploy. The VPS API can stay up for inspection; stop it with `sudo systemctl stop joblinked-api`.
3. **Data:** the cutover makes no schema changes. Restore only if the DB was damaged independently; use the Task 1 Step 1 dump.

---

## Out of scope

- Turnstile secret pairing (tracked separately in `docs/plan/done/2026-11-11-jobs-browser-promotion.md` Task 0.5).
- Postgres credential rotation (ADR-044 follow-up).
- Schema or API-contract changes.
