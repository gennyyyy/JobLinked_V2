# Deploy runbook — joblinked API (single persistent Node process)

Covers the production API host (ADR-037: one persistent Node process behind the
static Vercel frontend), its env, logs, migrations, backups, monitoring, and the
restore drill. The API is plain Express + Postgres — no build step of its own.

**Single-instance invariant (ADR-037).** Uploads persist to local disk
(`UPLOAD_DIR`), rate limiters are in-memory, and the retention purge is an
in-process daily `setInterval`. All three assume exactly one long-lived process:
never run replicas, never move the API to serverless. Scaling out requires the
rework listed in ADR-037 first.

## 1. Env checklist (API host)

Put these in an env file owned by the service user, mode `600`
(`server/.env` works; systemd loads it via `EnvironmentFile=`). Never commit it,
never expose these to the browser.

| Variable | Production value | Why |
| --- | --- | --- |
| `NODE_ENV` | `production` | Turns on the two boot warnings below; Express behaves as prod. |
| `DATABASE_URL` | `postgres://user:pass@host:5432/joblinked` | Postgres. **Percent-encode specials in the password** (spaces, `@`, `:`, `/`); libpq rejects a raw space with `unexpected spaces found … use %20`. Alternatively use libpq `PG*` vars (`PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`) and omit `DATABASE_URL`. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase project | Auth only. Service-role key is server-side; boot exits 1 if missing. |
| `CORS_ORIGIN` | `https://app.yourdomain.ph` | Comma-separated browser origins allowed to call the API. **Unset in production = locked to `http://localhost:5173`** (every real browser call gets no `Access-Control-Allow-Origin` and the app is silently broken) and the API logs the warning `CORS_ORIGIN unset in production`. The **first** entry is also the origin used in employer-invite links, so make it the canonical one. |
| `TRUST_PROXY` | hop count in front of the API | Fail-safe default `0`. Behind exactly one proxy (nginx/Caddy) set `1`; Cloudflare + nginx = `2`. Wrong value (too low) makes every client share the proxy IP for the anonymous IP-keyed limiters (site-wide self-DoS); too high lets a client-set `X-Forwarded-For` rotate the limiter key. Non-numeric trusts nothing. With `0` in production the API logs `TRUST_PROXY unset in production`. Integer only. |
| `UPLOAD_DIR` | `/srv/joblinked/uploads` | **Absolute path.** Relative values resolve against `server/` and cause “files disappeared after a restart” when the process is started from a different directory. Dir is created at boot; resumes are PII → `chown <service-user>` + `chmod 750`. Boot logs `uploads directory {dir}` — confirm it. |
| `PORT` | `4000` (default) | Listen port. |
| `LOG_LEVEL` | `info` (default) | `debug`/`info`/`warn`/`error`. |
| `OPENROUTER_API_KEY` etc. | optional | AI help/matching. Blank key = `/api/ai/*` answers 503; API still boots. NVIDIA NIM works by pointing `OPENROUTER_BASE_URL` at it (see `server/.env.example`). |

Boot-check: `journalctl -u joblinked-api` (or the log file) must show the
`uploads directory` line with the absolute path and **no** `CORS_ORIGIN`/
`TRUST_PROXY` warnings when `NODE_ENV=production`.

## 2. Build, start, process manager

API host needs Node 20+ (dev-verified on Node 24) and `postgresql-client` with
the **same major version** as the server (for `pg_dump`/`pg_restore`).

```sh
# one-time (or after each deploy)
cd /srv/joblinked && npm ci --prefix server --omit=dev
chmod +x db/apply-migrations.sh scripts/backup.sh   # Windows checkouts lose the bit
```

systemd unit (primary, no extra dependency):

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

The app exits 1 on `uncaughtException`/`unhandledRejection` on purpose
(half-alive is worse than dead); `Restart=always` is the supervisor.

pm2 alternative: `cd /srv/joblinked/server && pm2 start src/index.js --name
joblinked-api`, plus `pm2-logrotate`. The cwd matters: `dotenv` loads `.env`
from it, so either start pm2 from `server/` (picks up `server/.env`) or pass the
vars through pm2's ecosystem `env` block.

Start/stop:

```sh
sudo systemctl enable --now joblinked-api
curl -s http://127.0.0.1:4000/api/health        # {"ok":true,"db":"ok"}
```

Deploys are `git pull` → `npm ci --prefix server --omit=dev` → run migrations
(§ Migration ledger) → `sudo systemctl restart joblinked-api`.

## 3. Logs (JSON lines, ~30-day rotation)

The API writes one JSON line per event to stdout/stderr
(`{"level","time","msg",...}`), including one `request` access line per request
with method/path/status/duration/request id. Successful `/api/health` polls are
skipped; failures log a `warn`. No bodies or PII are logged.

journald (systemd option): bound size instead of rotation —

```ini
# /etc/systemd/journald.conf
SystemMaxUse=1G
MaxRetentionSec=30day
```

File option (any supervisor that redirects stdout, e.g. pm2 or a wrapper):
capture stdout+stderr to `/var/log/joblinked/api.log` and rotate:

```
# /etc/logrotate.d/joblinked
/var/log/joblinked/api.log {
  daily
  rotate 30
  compress
  missingok
  copytruncate
}
```

## 4. Restart procedure

```sh
sudo systemctl restart joblinked-api
sleep 2
curl -s http://127.0.0.1:4000/api/health?deep=true   # {"ok":true,"db":"ok","auth":"ok"}
journalctl -u joblinked-api -n 20 --no-pager
```

There is no graceful drain: a restart drops in-flight requests (seconds). Do it
off-peak. Check the restart for the boot env warnings (§ 1) — a restart that
comes up with `CORS_ORIGIN` unset is an outage even though health says 200.

## 5. Frontend (Vercel) and `VITE_*`

The SPA is built and served by Vercel (`vercel.json` rewrite only). `VITE_*=`
values (`.env.example`: `VITE_API_URL`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`) are **baked into the bundle
at build time** — changing one on Vercel does nothing until a **rebuild +
redeploy**. `VITE_API_URL` must be the API's public origin.

## Migration ledger

The database is the source of truth (`db/schema.sql`); `db/migrations/001…010` upgrade
existing databases, and **`db/apply-migrations.sh`** applies each file exactly
once, in filename order, recording it in `public.schema_migrations` (created by
`db/migrations/011_schema_migrations.sql`; the only schema object new tooling
adds). Several files are deliberately not idempotent (004 swaps the
`application_status` enum) — **the ledger is the idempotency mechanism**: never
re-run migration files by hand on a database the script has touched, and if you
do apply one manually, it must be recorded in the ledger (re-run
`db/apply-migrations.sh`; never delete rows).

```sh
# state only — safe, read-only
DATABASE_URL=postgres://… ./db/apply-migrations.sh --status

# apply everything pending, then print the ledger
DATABASE_URL=postgres://… ./db/apply-migrations.sh
```

**First run on an existing database** (empty ledger) reconciles reality before
applying anything: it probes for effects that were previously applied by hand
and records them, then applies the rest.

| File | Idempotent? | Reconciled by probe on first run? | Probe |
| --- | --- | --- | --- |
| 004_remove_shortlisted | **no** (one-shot enum swap) | yes | enum `public.application_status` exists and has no `Shortlisted` label |
| 007_query_indexes | yes | yes | index `job_seekers_skills_gin` exists |
| 008_constraint_gaps | yes (after fix below) | yes | `employment_history` FK to `job_applications` is `ON DELETE SET NULL` **and** `employer_accreditations_one_pending_uidx`, `super_admins_email_uidx`, both date-order CHECKs exist |
| 009_ordering_indexes | yes | yes | indexes `job_applications_applied_idx`, `job_vacancies_deadline_idx` exist |
| 001, 002, 003, 005, 006, 010 | yes | no — just applied (no-op on an upgraded DB) | — |

Two migration fixes were required to make this work on real databases (verified
2026-11-09, details in `docs/plan/2026-11-04-06-ops-deployment-plan.md`):

- **004** now drops/recreates the `record_accepted_employment` trigger
  (`AFTER INSERT OR UPDATE OF status`) around the enum swap — Postgres refuses
  the type change while the trigger depends on the column. Recreated identically
  to `db/schema.sql`.
- **008** now targets the `employment_history` → `job_applications` FK
  specifically (`confrelid`); the old guard matched **any** cascade FK on the
  table and could pick `seeker_id` → `job_seekers`, dropping the wrong
  constraint.

Expected console output: `[migrations] reconciled … (already applied by hand)`
for the probed files, `[migrations] apply …` for the rest, then the ledger with
`pending: none`. A second run must print `[migrations] nothing to apply`.

## Backups

Nightly `scripts/backup.sh`: one `pg_dump -Fc` **plus** one tarball of
`UPLOAD_DIR`, in a single timestamped directory with `manifest.txt` and
`SHA256SUMS`, written atomically (`.partial` → rename) and pruned after
`RETENTION_DAYS` (default 30).

**A dump alone is not a backup** — Postgres stores only relative paths
(`resumes.file_path`, `employer_documents.file_path`), so without the uploads
tarball every resume/document 404s after a restore. Restore both or neither.

```cron
# /etc/cron.d/joblinked-backup — nightly 02:30, libpq PG* vars avoid a password in the URL
PGHOST=localhost PGUSER=joblinked PGPASSWORD=… PGDATABASE=joblinked
30 2 * * * joblinked UPLOAD_DIR=/srv/joblinked/uploads BACKUP_DIR=/srv/joblinked-backups bash /srv/joblinked/scripts/backup.sh >> /var/log/joblinked/backup.log 2>&1
```

`BACKUP_DIR` must be a **different volume/host** from both the Postgres data
directory and `UPLOAD_DIR` (a lost disk must not take the backup with it);
sync/rsync it offsite. Log line names the directory and checksums; failure
means no new directory — check the cron mail/log.

## Monitoring (minimal)

One external probe of the deep health endpoint — `?deep=true` checks Postgres
**and** Supabase auth, so it catches the “API up but auth dead” case too:

```cron
# cron-curl + mail (or point any free uptime monitor at the same URL)
*/5 * * * * curl -fsS --max-time 10 'https://api.yourdomain.ph/api/health?deep=true' >/dev/null || echo "joblinked API unhealthy $(date -u)" | mail -s 'joblinked API down' ops@yourdomain.ph
```

Plus the `request` access lines in the JSON logs (§ 3) — the current scale
needs no metrics platform (explicit YAGNI in the plan).

## Restore drill

A backup that was never restore-tested is not a backup. Run this after any
change to backup tooling, and at least quarterly:

1. Pick the newest `BACKUP_DIR/joblinked-*` directory.
2. `psql -c "create database joblinked_drill"` (scratch DB; never restore over the live one).
3. `pg_restore -d postgres://…/joblinked_drill <dir>/db.dump` — must exit 0.
4. `mkdir uploads-drill && tar -xzf <dir>/uploads.tgz -C uploads-drill`.
5. Boot the API against the restored pair:
   `DATABASE_URL=…/joblinked_drill UPLOAD_DIR=/abs/uploads-drill PORT=4100 node server/src/index.js`.
6. `curl http://127.0.0.1:4100/api/health?deep=true` → `{"ok":true,"db":"ok","auth":"ok"}`.
7. Download one real resume through the API as its owner (`GET /api/files/<file_path>` with the owner's bearer token): expect 200, `%PDF-` bytes, the right size. `UPLOAD_DIR` must be the untarred dir — if the file 404s, the uploads half of the backup is the broken half.
8. Drop the scratch DB, stop the scratch API.

**Drill result: PASSED 2026-11-09** (dev machine, PostgreSQL 18, backup taken by
`scripts/backup.sh`; scratch restore → API boot on :4100 → deep health 200 →
resume `HTTP 200, 236 587 bytes, %PDF-`). See the plan's Results for the full
record.
