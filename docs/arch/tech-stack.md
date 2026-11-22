# JobLinked — System Tech Stack

Reference of the current stack, verified against the repo on 2026-11-19
(`package.json`, `server/package.json`, `vite.config.js`, `db/schema.sql`,
`server/src/app.js`, `vercel.json`, `docs/ops/deploy-runbook.md`, ADRs).
Versions below are the declared ranges, not a lockfile audit.

## 1. Topology

```
Browser SPA  ──HTTPS──▶  Vercel (static build, SPA rewrite + security headers)
   │  VITE_API_URL
   ▼
Express API (single persistent Node process, VPS, systemd/pm2)   ADR-037
   │  DATABASE_URL (server-side only)
   ▼
PostgreSQL 18 (VPS)  ── files on local disk (UPLOAD_DIR) + bytea profile images
   │
   ├─ Supabase (Auth only: JWT issue/verify, MFA; no browser DB/storage/RPC)
   ├─ Cloudflare Turnstile (registration/login captcha)
   └─ OpenRouter / NVIDIA NIM (OpenAI-compatible chat: AI help + job matching)
```

Invariant (ADR-037): the API is **one long-lived process**. Uploads, in-memory
rate limiters, and the retention purge all assume a single instance. Do not run
replicas or move the API to serverless without the rework listed in ADR-037.

## 2. Frontend

| Concern | Choice |
| --- | --- |
| UI runtime | React 19.2 + React DOM 19.2, **JSX only — no TypeScript** (repo rule) |
| Build/dev server | Vite 8 (`@vitejs/plugin-react` 6), `@` → `src` alias |
| Routing | react-router-dom 7 (`StaticUrlRouter`: frozen address bar, per-tab history stack; lazy route chunks via `src/shared/lib/routeLoaders.js`) |
| Styling | Tailwind CSS v4, CSS-first (`@import "tailwindcss"`, `@theme inline` in `src/index.css`) via `@tailwindcss/vite`; `tw-animate-css`; `clsx` + `tailwind-merge` (`src/lib/utils.js`) |
| Headless primitives | `@base-ui/react` 1.9 + `class-variance-authority` (UI set in `src/components/ui/`) |
| Icons / charts / motion | `lucide-react` 1.48, `recharts` 3.10, CSS keyframes |
| Resume handling | `mammoth` (DOCX text), `pdfjs-dist` (browser preview/worker) |
| Auth client | `@supabase/supabase-js` 2 — **auth only** (`persistSession:false`, `autoRefreshToken:false`); session JWT is attached to API calls by `src/shared/lib/api.js` |
| Captcha | Cloudflare Turnstile, hand-rolled loader (`src/shared/lib/turnstile.js`), no npm package |
| Data access | One fetch wrapper (`src/shared/lib/api.js`): JSON/FormData, 1×401 refresh+retry, 10 s per-user GET cache + in-flight coalescing, non-GET clears cache |

State is local React state + context (`src/shared/context/AuthProvider.jsx`) and
hooks (`useAuth`, `useAFKTimer`, `useCaptcha`, `useDialog`). No Redux/Zustand.

Feature layout: `src/features/{auth,employer,job-seeker,public-site,super-admin}`;
shared code in `src/shared/{components,context,hooks,lib,services,utils,content}`;
static assets imported from `src/assets/` (`public/` holds only the tab icon).

## 3. Backend (`server/`)

| Concern | Choice |
| --- | --- |
| Runtime | Node 20+ (CI pins 20; dev-verified on 24), ES modules, no build step |
| HTTP | Express 4.21 (`server/src/app.js` wires the whole stack once; tests reuse it) |
| DB driver | `pg` 8.16, hand-written SQL, **no ORM**. Pool: max 20, 5 s connect, 120 s statement, 180 s idle-in-transaction timeout; refuses non-loopback `DATABASE_URL` without `sslmode=verify-full` |
| Auth | Supabase JWT verified server-side with the service-role key (`server/src/auth.js`); per-request + TTL token cache (`tokenCache.js`); `resolveRole` merges `super_admins`/`employers`/`job_seekers`; `requireRole`, custom-role permission bundles (ADR-042) |
| Uploads | `multer` disk storage under `UPLOAD_DIR` (resumes/documents, magic-byte + extension check, 5 MB/2 MB PDF cap); avatars/logos as bytes in `profile_images` |
| AI | OpenAI-compatible `fetch` to OpenRouter (default `openai/gpt-4o-mini`) or NVIDIA NIM via `OPENROUTER_BASE_URL`/`OPENROUTER_MODEL`; in-process call budget; deterministic fallback when unconfigured (`server/src/aiProvider.js`, `ai/`, `matching/`) |
| Middleware | `helmet` (CSP), `cors` (fail-closed in prod), `compression`, request id, JSON access log, metrics, `express-rate-limit` (auth / upload / general), `attachPrincipal` |
| Errors | JSON `{ error: { code, message } }`; DB saturation → 503 + `Retry-After`; no PII or SQL in logs |

Routes: `auth`, `account`, `jobs`, `applications`, `profiles`, `admin`,
`admin-users`, `admin-jobs`, `admin-reference`, `legal`, `notifications`,
`reports`, `ai`, `aiMatch`, `health`, `metrics` (`server/src/routes/`).

## 4. Database

- **PostgreSQL 18**, portable schema — `db/schema.sql` is the source of truth
  (ADR-020): `pgcrypto`, enums (`user_role`, `account_status`, `job_status`,
  `application_status`, `accreditation_status`, `document_status`), plain uuid
  PKs mirroring Supabase auth user ids, no RLS/auth-schema references.
- Upgrades: `db/migrations/001…015_*.sql`, applied exactly once in filename
  order by `db/apply-migrations.sh`, ledger in `public.schema_migrations`.
  Several files are deliberately non-idempotent — the ledger is the idempotency
  mechanism. **No schema change without architect approval.**
- `supabase/migration.sql` is retained untouched as the Supabase-target schema
  (auth FKs, RLS, storage); `db/schema.sql` is derived from it and must not be
  replaced by it.
- Main tables: `job_seekers`, `employers`, `super_admins`, `reference_data`,
  `employer_accreditations`, `employer_documents`,
  `employer_document_petitions`, `job_vacancies`, `job_status_history`,
  `job_prohibited_flags`, `resumes`, `job_applications`,
  `application_status_history`, `education`, `work_experience`,
  `employment_history`, `notifications`, `profile_images`, `audit_logs`,
  `user_preferences`, `legal_documents`, `schema_migrations`.
- Files: resumes/documents store **relative paths** to `UPLOAD_DIR`; profile
  images/logos are `bytea` in `profile_images` and travel with the dump.
- Deploy target: remote VPS Postgres (`ADR-044`, `sslmode=no-verify` today);
  local dev uses a DB tunnel (`127.0.0.1:5433`) or a local instance.

## 5. Auth, security, secrets

- Supabase Auth issues the JWT; the API verifies it with the service-role key.
  Roles live in Postgres; `app_metadata.role` is the service-role-only signal
  that guards super-admin. Custom roles carry a permission bundle.
- Cloudflare Turnstile on auth forms; CSP allows `challenges.cloudflare.com`.
- Frontend headers (CSP, `X-Frame-Options`, `Referrer-Policy`, …) are set in
  `vercel.json`; API headers via `helmet`/`cors` in `server/src/app.js`.
- `CORS_ORIGIN` unset in production fails closed to localhost; `TRUST_PROXY`
  defaults to 0 (fail-safe) and must be set to the real hop count.
- Rate limits: authenticated 1000 req/15 min per user, anonymous 300/IP;
  stricter buckets on `/api/auth` and uploads.
- Secrets live in `server/.env` (gitignored) and `VITE_*` values in
  `.env.example`; `DATABASE_URL`/service-role key never reach the browser.

## 6. Infrastructure, ops, CI

- **Frontend hosting:** Vercel static SPA (`vercel.json`: SPA rewrite + security
  headers). `VITE_*` values are baked at build time.
- **API hosting:** one systemd unit (or pm2) on the VPS; `node --watch` for dev.
- **Backups:** `scripts/backup.sh` — `pg_dump -Fc` + uploads tarball, manifest
  and checksums, off-volume `BACKUP_DIR`; restore drill documented in
  `docs/ops/deploy-runbook.md`.
- **Monitoring (ADR-043):** `GET /api/metrics` gated by `METRICS_TOKEN`, optional
  `ALERT_WEBHOOK_URL` on 5xx, external deep-health probe
  (`/api/health?deep=true` checks Postgres + Supabase auth).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — Node 20 + Postgres 18
  service: `npm ci`, lint, unit tests, integration tests (`INTEGRATION_TEST=1`),
  build, advisory autofill eval + audits, preview + public route sweep
  (`npm run syscheck`).

## 7. Tooling and tests

- **Vitest 4**, two projects: `client` (jsdom + Testing Library + jest-dom +
  user-event, setup `src/test/setup.js`) and `server` (node, `server/**`,
  `db/**/*.test.js`). Integration tests use supertest against real Postgres.
- **Accessibility/perf:** `axe-core` in tests; `puppeteer-core` drives
  `scripts/system-check.mjs` (public route sweep) and `scripts/smoke.mjs`
  (authed role walkthrough, opt-in via `INTEGRATION_TEST=1`).
- **Lint:** ESLint 10 flat config (`eslint.config.js`), react-hooks +
  react-refresh plugins.
- **Scripts:** `dev` (web + API + DB tunnel via `concurrently`), `dev:web`,
  `dev:api`, `build`, `preview`, `test`, `test:watch`, `lint`, `syscheck`,
  `smoke`, `backup:uploads`, `eval:autofill`.
- Dev-only dependency: `@dietrichgebert/ponytail`.

## 8. Environment variables

Client (`VITE_*`, baked at build): `VITE_API_URL`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` (blank disables the widget).

Server (`server/.env`): `DATABASE_URL`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `PORT` (4000), `UPLOAD_DIR`, `CORS_ORIGIN`,
`TRUST_PROXY`, `LOG_LEVEL`, `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`/
`OPENROUTER_BASE_URL`, `METRICS_TOKEN`, `ALERT_WEBHOOK_URL`,
`RETENTION_DISABLE`. See `server/.env.example` for intent and boot warnings.

## 9. Repository layout

```
src/features/    auth, employer, job-seeker, public-site, super-admin
src/shared/      components, context, hooks, lib, services, utils, content
src/components/ui/  headless primitives (Base UI + CVA)
src/assets/      images/fonts (imported from source)
server/src/      routes, middleware, services, ai, matching, auth, db, upload
db/              schema.sql, migrations/, seeds, apply-migrations.sh
supabase/        Supabase-target migration + security fixes (retained)
docs/arch/       ADRs, audits, specs, this document
docs/ops/        deploy runbook
docs/plan/       plans (done/ once verified)
scripts/         backup, smoke/syscheck, probes, tunnel
```

## 10. Sources of truth and rules

- `AGENTS.md` — repo rules (no TS, no browser-side DB, schema approval, API
  calls through `src/shared/lib/api.js`).
- `docs/arch/adr-*.md` — decision records (topology: ADR-037 single process,
  ADR-044 remote Postgres, ADR-042 custom-role permissions, ADR-043 monitoring).
- `docs/ops/deploy-runbook.md` — production env, migrations, backups, restore.
- `db/schema.sql` + `db/migrations/` — database truth; `server/.env.example` —
  API config truth; `vercel.json` — frontend header truth.
