# Supabase → Better Auth Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase Auth with the Better Auth library (self-hosted inside the Express API, backed by our Postgres) while keeping every role/permission/audit behavior identical and carrying over all users with their passwords.

**Architecture:** Better Auth runs as one module inside the existing single Express process (ADR-037 still holds). Its tables live in a new `auth` schema in the same Postgres database; app tables in `public` are untouched. A dual-auth window accepts both BA sessions (cookies) and legacy Supabase JWTs so existing sessions survive deploys; Supabase is removed only after the client, data, and cutover are complete. Session transport is BA's default signed cookie (`better-auth.session_token`) — same-site subdomains (`www` → `api.joblinked.site`) make cookies work without JWTs, the Bearer plugin, or the JWT plugin (YAGNI).

**Tech Stack:** `better-auth` 1.7.x (server + `better-auth/react` client), `bcrypt` (password carry-over), `nodemailer` (email delivery — new dependency, see Decisions), Express 4 ESM, `pg` 8, React 19, Vitest 4. Supabase JS is deleted at the end.

**Spec / sources of truth:**
- Better Auth docs (verify versions/APIs against these before implementing each task): [installation](https://better-auth.com/docs/installation), [Express integration](https://better-auth.com/docs/integrations/express), [PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql), [database concepts](https://better-auth.com/docs/concepts/database) (schema, `generateId`), [email & password](https://better-auth.com/docs/authentication/email-password) (hash/verify, email verification), [captcha plugin](https://better-auth.com/docs/plugins/captcha) (Turnstile), [two-factor plugin](https://better-auth.com/docs/plugins/two-factor), [admin plugin](https://better-auth.com/docs/plugins/admin), [React client](https://better-auth.com/docs/concepts/client), [official Supabase migration guide](https://better-auth.com/docs/guides/supabase-migration-guide) (bcrypt mapping + call mapping).
- Current-stack reference: `docs/arch/tech-stack.md`. The Clerk scenario doc `docs/arch/tech-stack-auth-alternative.md` is superseded by this plan.

**Lead Architect sign-off (2026-11-21):** ADR-056 (`docs/arch/adr-056-better-auth-cutover.md`) approves the structure, the `auth` schema, the `public.admin_invites` table, and Task 2's DDL shape. Any deviation — `text` ids, renamed BA tables, or an extra `public` object — returns to the architect before implementation.

## Global Constraints

- **No TypeScript.** BA config and clients are plain ESM JavaScript (`.js`); BA works without TS (repo rule).
- **Schema:** changes go through `db/schema.sql` + `db/migrations/017_*.sql` (BA tables) and `018_*.sql` (pending signups), applied via `db/apply-migrations.sh` (ledger). The Lead Architect signs off on Task 2's DDL with this plan. No change to any existing table — the role tables keep their `uuid` PKs.
- **Auth rule unchanged:** BA is identity only; all profile/job/app data still flows through the Express API. No browser-side database.
- **API calls stay through `src/shared/lib/api.js`**; auth calls through the BA client (`src/shared/lib/auth-client.js`).
- **Dual-auth window:** BA sessions and Supabase JWTs are both accepted between Task 5 and Task 16. Never break a working session path before its replacement is verified.
- **Error contract unchanged:** `{ error: { code, message } }`; our custom routes keep their status codes; BA endpoints keep BA's error shape on `/api/auth/*` BA-owned paths.
- **Principal shape unchanged:** `{ id, email, role, customRoleId, permissions }`; `resolveRole`, `requireRole`, custom-role permission bundles (ADR-042), and the audit convention are untouched.
- **Secrets:** `BETTER_AUTH_SECRET` (32+ chars), SMTP creds, `TURNSTILE_SECRET_KEY`, and the read-only `SUPABASE_DATABASE_URL` (source migration only) live in `server/.env` only. No new `VITE_` secret.
- **Tests before commit:** `npm test`, `npm --prefix server test`, `npm run lint` per task; integration suite where DB is touched.

## Review Focus (failure modes no single task's test covers)

1. **Cross-origin cookie transport** — a signed-in user on `https://www.joblinked.site` whose `fetch` to `https://api.joblinked.site` omits `credentials: 'include'` silently reads as logged-out. Expected: every auth-bearing request carries the cookie. Pinned in Task 11 (integration test through the real app stack).
2. **CSRF origin check misconfiguration** — BA rejects `POST /api/auth/*` whose `Origin` is not in `trustedOrigins`; a wrong list locks every login out (silent outage like the CORS_ORIGIN failure mode). Expected: localhost dev origins + production origin accepted. Pinned in Task 4.
3. **Malformed/legacy bcrypt hash** — `bcrypt.compare` throws on a truncated hash → 500 instead of 401. Expected: any hash-mismatch path answers `401 INVALID_EMAIL_OR_PASSWORD`. Pinned in Task 5.
4. **BA mount ordering** — `express.json()` before the BA handler hangs every BA request; BA catch-all swallowing `/api/auth/provision` and `/auth/me` breaks provisioning. Expected: BA mounted before the body parser, custom auth routes registered before the BA catch-all with route-level body parsing. Pinned in Task 4.
5. **Unverified email → provisioned row** — a user who signed up but never verified their email must not get a role row and must not pass `requireEmailVerification`. Expected: sign-in answers the BA `EMAIL_NOT_VERIFIED` error; with `requireEmailVerification` BA returns **no session** at sign-up, so provision is unreachable until verification; the `pending_signups` row is claimed only by a verified session (Task 6c). Pinned in Task 5 (no row → 403) and Task 6c (unverified pending write only).
6. **Invite grant tampering** — a client sending `role: 'super-admin'` or `custom_role_id` to `/auth/provision` must not change its role. Expected: the pending row in `admin_invites` is the only source; the body is ignored. Pinned in Task 6.
7. **Direct-API password bypass** — `POST /api/auth/sign-up/email` with `aaaaaaaa` must fail even though the UI never sends it. Expected: the server hook enforces 8–72 + letter/number/symbol. Pinned in Task 1 (unit) and Task 4 (through the mount).

---

## Decisions (defaults; the Lead Architect owns these — flag objections at review, not mid-task)

1. **Transport: signed cookie sessions** (BA default), no Bearer/JWT plugins. Same-site subdomains need no third-party cookies; CORS gains `credentials: true` with the existing explicit origin echo.
2. **IDs: `advanced.database.generateId: "uuid"`** — BA mints uuid ids on Postgres, so `POST /api/auth/provision` keeps inserting `id = session.user.id` into the existing role tables. No `clerk_id`-style mapping, no FK changes. Task 2 verifies the generated DDL actually produces `id uuid`.
3. **Tables in a dedicated `auth` schema** (`database.schemaName: 'auth'` via Kysely dialect), so `public` stays app-only and `pg_dump` backups still cover everything (`-Fc` dumps all schemas).
4. **Passwords: bcrypt** on both `hash` and `verify` (`emailAndPassword.password`), matching the official Supabase guide; imported Supabase bcrypt hashes verify as-is. New hashes are bcrypt cost 10. BA does not rehash on login — accepted (bcrypt remains sound); revisit scrypt in a later ADR if desired.
5. **Email delivery: SMTP via `nodemailer`** — the one new dependency (Node has no stdlib SMTP). Provider = any SMTP relay the PESO host can reach (decide concrete provider at Task 8; e.g. the host's own relay or Resend via SMTP). Env: `SMTP_HOST/PORT/USER/PASS/FROM`.
6. **MFA: TOTP via BA two-factor plugin; factors are NOT migrated** — Supabase TOTP secrets are provider-encrypted with no documented importer. Users with an existing factor re-enroll once (banner + comms at cutover). Enforced where the client already enforces (login challenge step); no new server-side aal gate beyond what ships today.
7. **Super-admin guard:** BA `user.role` (set only via the admin plugin's server API) AND the existing `super_admins` row must both agree — replaces the `app_metadata.role` service-role signal (same defense, new owner).
8. **Sessions die at cutover:** every user signs in once after the data migration. `expiresIn` 7 days (BA default), DB-backed in `auth.session`.
9. **Turnstile stays**, same site key; server-side verification moves from Supabase to BA's captcha plugin (`x-captcha-response` header on `/sign-in/email`, `/sign-up/email`, `/request-password-reset`).
10. **Cutover order:** data migration runs BEFORE the client deploy flips to BA (users already exist when the new login goes live).
11. **Server-side password policy:** `minPasswordLength: 8` plus a `hooks.before` guard on sign-up / reset / change enforcing 8–72 chars and one letter, one number, one symbol — the same rules as `src/shared/utils/password.js`. The client is not the trust boundary.
12. **Admin invites:** BA `user.role` is the provider-side signal. The pending profile (`first_name`, `middle_name`, `last_name`, `suffix`, `phone`, `company_name`) and the custom-role grant live in `public.admin_invites` (`user_id uuid PK`, `role text`, `custom_role_id bigint null` — `reference_data.id` is bigint — `profile jsonb`, `created_at`). Only the server invite route writes it; provision reads and deletes it. No `additionalFields` on `auth.user`, no `app_metadata`.
13. **Email sender:** Resend SMTP in production (`SMTP_HOST=smtp.resend.com`, port 587, user `resend`, password = API key, verified `FROM`). In dev, when `SMTP_HOST` is unset, the mailer logs the action URL to the server console; production with no SMTP fails loudly and never logs the URL.
14. **Generated names win:** BA table/column names are exactly as the CLI generates them (`"twoFactor"` is quoted camelCase). `kysely` is an explicit dependency because the config imports `PostgresDialect`. `/forget-password` does not exist — the endpoint is `/request-password-reset`.

## API surface contract

| Path | Owner | Change |
|---|---|---|
| `POST /api/auth/sign-in/email`, `/sign-up/email`, `/request-password-reset`, `/reset-password`, `/change-password`, `/change-email`, `/list-sessions`, `/revoke-*`, `/two-factor/*`, `/ok` | Better Auth | new; replaces the equivalent Supabase calls. Client uses `authClient.*`, never raw `fetch`, except where noted. |
| `GET /api/auth/me` | ours (unchanged contract) | same response incl. `permissions`, `custom_role_id`, `aal`; now session-sourced. |
| `POST /api/auth/pending-signup` | ours (new, pre-auth) | body `{ userId, email, role, ...profile }`; stores the self-signup payload for an existing unverified BA user whose id+email match. Roles limited to `job-seeker`/`employer`; never creates a session or role row; rate-limited by `authLimiter`; returns `{ saved: true }`. |
| `POST /api/auth/provision` | ours (unchanged contract) | same body `{ role }`; session-sourced id; uuid ids make the role-row insert unchanged. Invited users send `{}` — the server merges the pending profile from `admin_invites`; self-signups send `{}` after verification — the server merges `pending_signups`. |
| `POST /api/auth/*` (BA) + our `authLimiter` | both | express-rate-limit buckets unchanged. |
| `POST /admin/users/:id/invite`, `:id/reset-password`, PATCH `:id` | ours | internals switch to BA admin API; request/response shapes unchanged. |

**Dual-window note:** until the client flips, an admin calling our invite/PATCH routes still holds a Supabase bearer, so the route must not rely on `auth.api.createUser`'s session check. Create the user through BA's internal adapter or a direct `auth.user`/`auth.account` insert (bcrypt random password), then send the reset link with the public `requestPasswordReset` API. Pin this in Task 6's tests.

## Supabase touchpoint map (everything this plan rewrites or deletes)

- **Server runtime:** `server/src/auth.js` (supa client, `attachPrincipal`, `auth`, `optionalAuth`, `tokenAuth`), `server/src/tokenCache.js` (deleted), `server/src/routes/health.js` (deep probe), `server/src/routes/auth.js` (provision, `/auth/me`), `server/src/routes/admin-users.js` (invite, app_metadata role, reset-password), `server/src/app.js` (mount + cors).
- **Server tests:** `server/src/__tests__/helpers/auth.js` is the single mock seam (`supabaseAuth`); ~40 test files `vi.mock('@supabase/supabase-js', …)` through it; `auth.tokenCache.test.js` / `tokenCache.negative.test.js` deleted with tokenCache.
- **Client:** `src/shared/lib/supabase.js` (deleted), `src/shared/lib/api.js` (sessionAuth → cookie), `src/shared/context/AuthProvider.jsx`, `src/shared/services/auth.js` (rewritten to authClient), `src/features/auth/{Login,Register,AuthCallback,ResetPassword,AcceptInvite}.jsx`, `src/shared/components/{MfaPanel,ChangePassword,EmailChangePanel,Turnstile}.jsx`, `src/shared/hooks/{useCaptcha}.js`.
- **Config:** `server/.env.example`, `.env.example`, `vercel.json` CSP (`connect-src` drops the Supabase origin at cleanup; `script-src` keeps `challenges.cloudflare.com`), `db/schema.sql`, `db/seed-dev.sql`.

---

### Task 1: Better Auth instance + env + email callbacks

**Files:**
- Create: `server/src/ba.js` (the BA instance; the only place `betterAuth(...)` is configured), `server/src/mailer.js` (nodemailer transport + dev URL fallback, ~40 lines), `server/src/passwordPolicy.js` (8–72 + letter/number/symbol)
- Modify: `server/package.json` (add `better-auth@1.7.x`, `bcrypt`, `nodemailer`, `kysely`), `server/.env.example`
- Test: `server/src/ba.test.js`

**Interfaces:**
- Produces: `export const auth = betterAuth({ … })` — later tasks import `{ auth }` from `../ba.js` only. `auth.api.getSession({ headers })` is the only BA surface the middleware uses.

**Config to write (the decisions above, verbatim shape):**

```js
import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { Pool } from 'pg';
import { PostgresDialect } from 'kysely';
import bcrypt from 'bcrypt';
import { captcha, twoFactor, admin } from 'better-auth/plugins';
import { sendVerificationEmail, sendResetPassword } from './mailer.js';
import { passwordPolicyError } from './passwordPolicy.js';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean),
  database: {
    dialect: new PostgresDialect({ pool: new Pool({   // own pool: must NOT touch the app pool's connections
      connectionString: process.env.DATABASE_URL,
      max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
    })}),
    type: 'postgres',
    schemaName: 'auth',            // Decision 3 — app tables stay in public
  },
  advanced: { database: { generateId: 'uuid' } },  // Decision 2 — uuid user ids
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,          // Decision 11 adds the rest of the policy
    password: {                    // Decision 4 — Supabase carry-over
      hash: async (password) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
    sendResetPassword,
  },
  user: { changeEmail: { enabled: true } },        // sends to the NEW address via sendVerificationEmail
  emailVerification: { sendVerificationEmail },
  hooks: {                          // Decision 11 — the server, not the client, enforces the policy
    before: createAuthMiddleware(async (ctx) => {
      if (!['/sign-up/email', '/reset-password', '/change-password'].includes(ctx.path)) return;
      const issue = passwordPolicyError(ctx.body?.password ?? ctx.body?.newPassword);
      if (issue) throw new APIError('BAD_REQUEST', { message: issue });
    }),
  },
  plugins: [admin(), twoFactor(), captcha({ provider: 'cloudflare-turnstile', secretKey: process.env.TURNSTILE_SECRET_KEY })],
  rateLimit: { enabled: true },    // BA built-in; our authLimiter stays the operator-facing knob
});
```

- Dev CORS/CSRF origins: when `NODE_ENV !== 'production'`, append `http://localhost:5173` and `http://127.0.0.1:5173` to `trustedOrigins` (BA rejects credential POSTs otherwise). Task 4 pins it.
- `passwordPolicyError(value)` returns `''` or the first violation; same four regexes and 8–72 bounds as `src/shared/utils/password.js`. Do not import across the client/server boundary — duplicate the rule and pin both with the same cases.
- Mailer: `sendResetPassword({ user, url })` and `sendVerificationEmail({ user, url })` build one nodemailer transport from `SMTP_*`. If `SMTP_HOST` is unset and `NODE_ENV !== 'production'`, log `{ event: 'dev_mail', to: user.email, url }` instead of sending. In production with no SMTP, throw/log an error without the URL. Never log tokens in production.
- **Verify before writing code:** the callback names, `password.verify` signature, hook path strings, and `createAuthMiddleware` import against Better Auth 1.7.27 docs. If a name differs, use the documented one and note it in the commit; do not invent a shim.

- [ ] **Step 1: Write the failing test** — `ba.test.js`: `auth` builds with stub env; `emailAndPassword.password.verify` answers `false` (not a throw) for a malformed hash string like `'not-a-hash'`; `verify` answers `true` for `bcrypt.compare` against a real cost-10 hash; `passwordPolicyError` rejects `aaaaaaaa` (no number/symbol) and `Abcdefg1!` passes; the mailer's dev branch returns the URL for logging when `SMTP_HOST` is unset and `NODE_ENV=development`, and refuses to log it when `NODE_ENV=production`.
- [ ] **Step 2:** `npm --prefix server test -- ba.test.js` → FAIL (module not found).
- [ ] **Step 3:** Implement `ba.js` + `mailer.js` per the config above (mailer: nodemailer transport from `SMTP_*`, each callback sends the BA-provided URL to `user.email`; log status only, never tokens).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit `feat(server): better-auth instance with bcrypt carry-over and SMTP callbacks`.

### Task 2: Schema — `auth` schema + BA tables + `admin_invites` (DDL APPROVED WITH THIS PLAN)

**Files:**
- Create: `db/migrations/017_better_auth_tables.sql`
- Modify: `db/schema.sql` (mirror the same DDL at the end, under a "Better Auth (auth schema)" section)

**Interfaces:**
- Produces: tables exactly as `npx auth generate` emits them — `auth."user"`, `auth."session"`, `auth."account"`, `auth."verification"`, `auth."twoFactor"` (quoted camelCase; the admin plugin adds `role`, `banned`, `banReason`, `banExpires` to `"user"` and `impersonatedBy` to `"session"`; the two-factor plugin adds `"twoFactor"` + `twoFactorEnabled` on `"user"`). Column families per BA docs: `"user"(id uuid PK, name, email unique, email_verified, image, created_at, updated_at, …)`, `"session"(id, user_id FK, token unique, expires_at, …)`, `"account"(id, user_id FK, provider_id, account_id, password, …)`, `"verification"(id, identifier, value, expires_at, …)`.
- Also produces: **`public.admin_invites`** (Decision 12), the only new app-side object:
  ```sql
  create table if not exists public.admin_invites (
    user_id uuid primary key references auth."user"(id) on delete cascade,
    role text not null check (role in ('job-seeker','employer','super-admin')),
    custom_role_id bigint null references public.reference_data(id) on delete set null,
    profile jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  ```

- [ ] **Step 1:** Run `npx auth@latest generate --config server/src/ba.js` (or per current CLI docs) against a local scratch DB; capture the emitted SQL.
- [ ] **Step 2: Verify the DDL** — every `id`/`user_id` column must be `uuid` (Decision 2), and table names must match the generated quoted names exactly (do **not** rewrite `"twoFactor"` to `two_factor` or `"user"` to `users`). If the generator emits `text` ids, stop and surface it to the architect before proceeding (the role-table FK story depends on uuid).
- [ ] **Step 3:** Write `017_*.sql` = `create schema if not exists auth;` + the generated DDL unchanged + the `admin_invites` DDL above. Mirror both into `db/schema.sql`. Do not change any existing table.
- [ ] **Step 4: Verify** — the dev ledger currently stops at `014`. Apply the committed migrations **in order** through the same psql + ledger procedure: `015_document_petitions.sql`, `016_job_field_and_skills.sql`, then `017_better_auth_tables.sql`. (`psql` is installed but not on PATH; the bash runner needs WSL, which this machine lacks — use the full psql path locally, the bash runner on the Linux host.) For each file: `"C:\Program Files\PostgreSQL\18\bin\psql.exe" "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/<file>`, then `insert into public.schema_migrations (name) values ('<file>') on conflict do nothing;`. Confirm `\dt auth.*` shows the 5 tables, `\d public.admin_invites` shows the columns, and a re-run is a no-op. Stop and report if 015 or 016 fails — do not work around a failed committed migration.
- [ ] **Step 5:** Commit `db: better-auth tables in auth schema (migration 017)`.

### Task 3: Supabase → Better Auth data migration script

**Files:**
- Create: `server/scripts/migrate-supabase-auth.mjs` (adapts the [official guide script](https://better-auth.com/docs/guides/supabase-migration-guide) to this repo: reads `auth.users` over a **read-only Supabase Postgres connection** and writes `auth.*` through direct SQL. The admin API is not a usable source — it omits `encrypted_password` (measured 2026-11-21: 0/161 users). The server package owns `pg`; the root package has no `pg`.)
- Test: `server/src/__tests__/migrate-supabase-auth.test.js` (covered by the existing server Vitest include; imports the script — no `vite.config.js` change)

**Interfaces:**
- Consumes: `SUPABASE_DATABASE_URL` (source Postgres, read-only; `options=-c default_transaction_read_only=on`), `DATABASE_URL` (target).
- Source row: `id, email, encrypted_password, email_confirmed_at, created_at, raw_user_meta_data, raw_app_meta_data` from `auth.users`, keyset-paginated by `id > $resume order by id limit $batch`.
- Produces: `auth."user"` rows (uuid ids = Supabase user ids, `emailVerified` from `email_confirmed_at`, `role` from `raw_app_meta_data->>'role'` when present, name from `raw_user_meta_data`), `auth."account"` rows (`providerId: 'credential'`, `password` = Supabase bcrypt hash verbatim). CLI flags `--dry-run` (default; counts only), `--apply` (required to write), `--batch=500`, `--resume=<userId>`. Logs counts only — never emails, hashes, or tokens.
- Fail closed: no `SUPABASE_DATABASE_URL` → exit 1 with a message naming the missing env. Do not silently migrate without hashes.

- [ ] **Step 1: Write the failing test** — fixture source rows: one verified user (`encrypted_password` = bcrypt `$2a$`, `raw_app_meta_data.role = 'super-admin'`), one unverified, one with no password hash; dry-run reports `{ total: 3, verified: 1, withPassword: 2 }` and writes nothing; `--apply` inserts the users, copies the role, writes one credential account for each hashed user and none for the hashless one, preserves hash bytes exactly (assert stored `password === fixture hash`), and a second `--apply` does **not** overwrite a password changed after the first run (account id = user id; insert guarded by `where not exists (userId, providerId)`). Missing `SUPABASE_DATABASE_URL` exits 1 before any write. No log line contains an email or hash.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Implement per the guide (batched, keyset-resumable). Writes happen only with `--apply`; the default is dry-run. The source pool runs with `default_transaction_read_only=on`. Never log emails, hashes, or tokens together.
- [ ] **Step 4:** Test → PASS. A live rehearsal against real Supabase data is Task 7; do not run `--apply` against production in this task.
- [ ] **Step 5:** Commit `chore(server): supabase→better-auth user migration (bcrypt, resumable)`.

### Task 4: Mount BA in Express (ordering-critical)

**Files:**
- Modify: `server/src/app.js` (mount + cors), `server/src/env.js` (required-env additions), `server/src/routes/auth.js` (`/auth/provision` route-level `express.json()`)
- Test: `server/src/__tests__/middleware-hardening.test.js` (extend), new `server/src/__tests__/ba-mount.test.js`

**Interfaces:**
- Consumes: `{ auth }` from `ba.js`; `toNodeHandler` from `better-auth/node`.
- Produces: `GET /api/auth/ok` → 200 through the real app stack; our custom auth routes still reachable; cookies set on BA responses.

**Mount order in `createApp()` (exact — this ordering is the task):** after `authLimiter` and before `express.json()`:

```js
app.use('/api', authRoutes);                      // existing router; provision/me match FIRST
app.all('/api/auth/*', toNodeHandler(auth));      // BA catch-all AFTER our specific auth routes, BEFORE body parser
app.use(express.json({ limit: '1mb' }));          // unchanged position for everything else
app.use('/api', jobsRoutes, …);                   // unchanged
```

`/api/auth/provision` parses its own body (`router.post('/provision', tokenAuth, express.json(), …)` route-level), because the global parser now sits after the BA mount. Add `credentials: true` to the existing `cors({...})` call.

- [ ] **Step 1: Write the failing tests** — (a) `GET /api/auth/ok` → 200 with `{"ok":true…}` (per docs); (b) `POST /api/auth/provision` (session-mocked per helpers) still 401s unauthenticated and 400s without `role`; (c) a BA sign-in response carries `Set-Cookie: better-auth.session_token=…` (BA integration-config or stub); (d) a `POST /api/auth/sign-in/email` with `Origin` not in `trustedOrigins` → 403 (CSRF check fires), with a trusted origin → proceeds to credential check.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implement the mount order + cors `credentials: true` + route-level json on provision; add `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `TURNSTILE_SECRET_KEY`, `SMTP_*` to `env.js`/`.env.example` (optional-in-dev, warn-not-exit until Task 12 flips the default). Give `ba.js` a dev-only `baseURL` fallback (`http://localhost:4000`) and Vite fallback origins (`5173`–`5175`) so the local CSRF check matches the CORS behavior.
- [ ] **Step 4:** Tests → PASS. `npm --prefix server test` green (the old Supabase path still works untouched).
- [ ] **Step 5:** Commit `feat(server): mount better-auth before body parser; cors credentials`.

### Task 5: Session resolution — dual window

**Files:**
- Modify: `server/src/auth.js` (attachPrincipal/auth/optionalAuth/tokenAuth), `server/src/__tests__/helpers/auth.js` (mock seam gains a BA side)
- Test: `server/src/auth.tokenCache.test.js` unchanged (legacy path), new `server/src/auth.baSession.test.js`

**Interfaces:**
- Consumes: `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })` from `ba.js`.
- Produces: same `principalOf` shape `{ id, email, role, app_metadata: undefined, customRoleId, permissions }` — `resolveRole(id)` unchanged. `req.user.role` resolution precedence and status checks unchanged.

**Resolution order (one indirection, one place, memoized per request — `attachPrincipal` and the route's own middleware must never pay two BA round-trips):**

```js
const resolveSession = (req) => (req._session ??= (async () => {
  const ba = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }); // cookie or nothing
  if (ba?.user) return { id: ba.user.id, email: ba.user.email, role: ba.user.role ?? null };
  return supabaseFallback(req);   // existing tokenCache path, deleted in Task 16
})());
```

`principalOf` maps `role` from the BA user (admin plugin) instead of `app_metadata.role`; `app_metadata` is retired. `POST /auth/provision` and `GET /auth/me` currently read `app_metadata` — Task 6 rewires them; until it lands, do not route a BA session through those two handlers in production.

- [ ] **Step 1: Write the failing tests** — (a) BA session present → principal from `resolveRole`; (b) no BA session + Supabase bearer → legacy principal (existing helper mock); (c) BA session whose user has **no** Postgres role row → `req.user` unset (attachPrincipal) / 403 `FORBIDDEN 'Account not provisioned'` (auth middleware); (d) suspended BA-provisioned user → 403 message identical to today; (e) super-admin with BA `user.role !== 'super-admin'` → 403 (Decision 7, both signals must agree); (f) bcrypt `verify` throwing inside a sign-in path surfaces as 401-class error, never 500 (covers Review Focus 3 at the middleware level).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + full server suite green. **Step 5:** Commit `feat(server): dual session resolution (BA cookie → Supabase fallback)`.

### Task 6: `/auth/me`, provision, admin flows on BA

**Files:**
- Modify: `server/src/routes/auth.js` (`/auth/me` aal derivation, provision id source), `server/src/routes/admin-users.js` (invite, PATCH, reset-password), `server/src/routes/health.js`
- Test: existing `auth.provision.test.js`, `auth.me.email-sync.test.js`, `admin.users.invite.test.js`, `admin.users.patch.test.js`, `admin.users.reset-password.test.js` (rewire mocks, same assertions), `health.test.js`

**Interfaces:**
- Consumes: BA's internal adapter (or direct `auth."user"`/`auth."account"` inserts) for admin-created users while the acting admin may still hold a Supabase session; public `auth.api.requestPasswordReset` for the email; `auth.api.adminUpdateUser`/`setRole` once the caller is BA-authenticated. `auth.api.createUser` is **not** usable in the dual window — it requires a BA admin session.
- Produces: identical route contracts (table above). Invite writes `public.admin_invites` (role, `custom_role_id`, profile jsonb) and emails a reset link; `POST /auth/provision` merges that pending profile, deletes the row, and authors the role row. The super-admin gate becomes BA `user.role === 'super-admin'` **and** an `admin_invites` row for that user — `app_metadata` is gone. `aal`: `'aal2'` iff the BA session user has `twoFactorEnabled` and the sign-in completed the factor step (derive from session user flags; document the mapping in the route comment — it is informational for the client's MFA gating, which moves to the client flow in Task 12).

- [ ] **Step 1: Rewrite the tests first** (same expected values, BA mocks instead of Supabase mocks): invite creates the user + `admin_invites` row with the full profile and custom-role tag, then calls `requestPasswordReset`; a client-supplied `custom_role_id` in the provision body is ignored; provision consumes and deletes the invite row and writes the role row with the invite's profile; 409 parity when the email exists; admin PATCH stays role-table-only (it strips `email` by design — B13; the account-settings flow owns email changes); reset-password route calls `requestPasswordReset`; `/auth/me` email-sync writes the role table on mismatch; health deep check verifies the local `auth` schema, no Supabase round-trip.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(server): provision/me/admin on better-auth`.

#### Task 6c (added 2026-11-21): pending self-signup profile

Supabase kept the registration form in `user_metadata`; BA stores only `name`/`email`, and with `requireEmailVerification` sign-up returns **no session**. Without a store, every registrant re-enters their data after verifying.

**Files:** `db/migrations/018_pending_signups.sql` (+ mirror in `db/schema.sql`), `server/src/routes/auth.js` (new `POST /auth/pending-signup`; provision merge), tests.

```sql
create table if not exists public.pending_signups (
  user_id uuid primary key references auth."user"(id) on delete cascade,
  role text not null check (role in ('job-seeker','employer')),
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

- `POST /api/auth/pending-signup` (ours, pre-auth, route-level `express.json()`, `authLimiter`): body `{ userId, email, role, ...profile }`. Require a uuid, a matching unverified `auth."user"` row, and a `job-seeker`/`employer` role; reject `super-admin`/`custom_role_id` outright; upsert by `user_id`; return `{ saved: true }`. It never creates a session or role row.
- Provision: with no invite, read/claim `pending_signups` in the same transaction as the role insert (`delete … returning *`); `role = body.role ?? pending.role` (allow-list), profile = `{ ...pending.profile, ...body }`; delete the pending row. The invite path wins if both exist and still deletes the pending row. Replay/concurrency follows the invite `{raced}` contract.
- Tests: unverified-only write, id+email match, role rejection, verified/unknown user 400; provision consumes the pending row, preserves every field, body overrides, and a second provision returns 200; invite + pending → invite wins and both rows are gone.
- Apply 018 to the dev DB with the psql + ledger procedure.

### Task 7: Migration rehearsal (local + staging data)

**Files:** no repo changes unless gaps fall out (then fix Task 3).

- [ ] **Step 1:** With `SUPABASE_DATABASE_URL` set for the dev Supabase project, run Task 3's script `--dry-run` then `--apply`; record counts (`total`, `withPassword`, `usersWritten`, `accountsWritten`).
- [ ] **Step 2:** Sign in through `POST /api/auth/sign-in/email` (curl with cookie jar) for: an imported user with the OLD Supabase password → 200 + session; wrong password → 401; unverified → BA email-not-verified error; provision a role row; hit `/auth/me`.
- [ ] **Step 3:** **Fixtures:** `db/seed-dev.sql` gains the same fixture identities as `auth.user`/`auth.account` rows (bcrypt hashes, emails verified); `scripts/smoke.mjs` creates its Supabase fixture users via direct `auth.*` inserts (the service-role signup path is gone). Re-run `npm run smoke` with `INTEGRATION_TEST=1` until the three-role walkthrough passes.
- [ ] **Step 4:** `pg_dump -Fc` the DB, restore to scratch, `GET /api/health?deep=true` → `{"ok":true,"db":"ok","auth":"ok"}` (backup covers the `auth` schema — verify in the dump with `pg_restore -l | grep auth`).
- [ ] **Step 5:** Record results in this file under "Rehearsal results"; fix and re-run until clean.

### Task 8: Client — auth client, AuthProvider, api.js

**Files:**
- Create: `src/shared/lib/auth-client.js` — `createAuthClient({ baseURL: import.meta.env.VITE_API_URL, fetchOptions: { credentials: 'include' } })` from `better-auth/react`
- Modify: `src/shared/context/AuthProvider.jsx` (session source → `authClient.useSession()`; `needsProvisioning` semantics preserved exactly — `loadProfile`/ticket logic lines 21–70 unchanged), `src/shared/lib/api.js` (delete `sessionAuth()`'s Supabase calls: fetch calls gain `credentials: 'include'`, no Authorization header; 401 → one `authClient.getSession()` retry → `signOut` + `/login` bounce, straight-line like today; GET-cache key still per-user from the session id)
- Test: `src/shared/context/__tests__/AuthProvider.test.jsx`, `src/shared/lib/__tests__/api.test.js` (new/rewired)

**Interfaces:**
- Consumes: `authClient` (useSession, getSession, signOut).
- Produces: `useAuth()` contract unchanged (`user`, `loading`, `needsProvisioning`, `sessionUser`, `logout`, `refreshUser`).

- [ ] **Step 1: Write the failing tests** — session present → profile loaded, identical user shape; profile 404 → `needsProvisioning` true and NO sign-out; 401 from the API → one retry then cleared user; api.js sends no Authorization header and no cache pollution across identities (existing per-user keying tests).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(client): better-auth session plumbing (cookie transport)`.

### Task 9: Client — auth screens + captcha

**Files:**
- Modify: `src/shared/services/auth.js` (rewrite to `authClient`: `signIn.email`, `signUp.email`, `signOut`, `requestPasswordReset`, `resetPassword`, `changePassword`, `changeEmail`), `src/features/auth/Login.jsx` (two-factor step: `twoFactorRedirect` → `verifyTOTP`), `Register.jsx` + role variants, `ForgotPassword.jsx`, `ResetPassword.jsx` (`?token=` from BA link → `resetPassword({ token })`), `AcceptInvite.jsx` (BA reset link → password set → `/accept-invite` → `provision({})`; the server merges the `admin_invites` profile, never client `user_metadata`), `AuthCallback.jsx` (email-verification callback → `verifyEmail`), `src/shared/lib/turnstile.js`/`useCaptcha` (token → `fetchOptions.headers['x-captcha-response']` on the three protected calls instead of Supabase `captchaToken` option)
- Test: the existing per-screen suites (`Login.mfa.test.jsx`, `AuthCallback.test.jsx`, `ResetPassword.test.jsx`, `AcceptInvite.test.jsx`, `services/__tests__/auth.test.js`) — rewire mocks to `auth-client`, keep user-visible assertions identical

- [ ] **Step 1: Rewire tests first** (mock `authClient` via a small `src/test/authClientMock.js` helper so every suite mocks one seam). Assert: signup with captcha sends the header; missing site key skips the widget as today; login with `twoFactorRedirect` shows the code step and calls `verifyTOTP`; reset token flows through; verification callback marks verified and routes to the portal.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(client): auth screens on better-auth + turnstile header`.

### Task 10: Client — account security surfaces

**Files:**
- Modify: `src/shared/components/MfaPanel.jsx` (BA twoFactor: enable → QR/secret → `verifyTOTP` → enabled; disable; backup codes display), `ChangePassword.jsx` (`changePassword({ currentPassword, newPassword })`), `EmailChangePanel.jsx` (`changeEmail` + verification notice), `AccountSettings.jsx` sessions card (`listSessions` / `revokeSessions` / `revokeOtherSessions` — direct authClient calls are acceptable here per the API contract note)
- Test: `MfaPanel`, `ChangePassword`, account settings suites (rewired to `authClientMock`)

- [ ] **Step 1:** Tests first (enable→verify→banner; wrong current password error mapping; revoke-all clears session → `AuthProvider` resets). **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(client): mfa/password/email/sessions on better-auth`.

### Task 11: Test-harness sweep (the Supabase mock seam)

**Files:**
- Modify: `server/src/__tests__/helpers/auth.js` (replace `supabaseAuth.getUser` factory with a BA-session factory: `loginAs(res, userId)` mints a session cookie header the BA mock resolves), then the ~40 `vi.mock('@supabase/supabase-js')` files become `vi.mock('../../ba.js')` (path-corrected) — mechanical, pattern-driven
- Delete: `server/src/auth.tokenCache.test.js`, `server/src/tokenCache.negative.test.js` (with Task 16's runtime deletion, or here if the seam makes them moot)
- Test: full suites

- [ ] **Step 1:** Rewrite `helpers/auth.js` around the BA seam; `loginAs` keeps its name/signature so per-test edits stay minimal.
- [ ] **Step 2:** Sweep the `vi.mock` blocks (scripted `sed`-style pass; each file's assertion bodies unchanged).
- [ ] **Step 3: Verify** — `npm --prefix server test` fully green; `INTEGRATION_TEST=1 npm --prefix server run test:integration` green (its `db.integration.test.js` mock swap included here).
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run build` green.
- [ ] **Step 5:** Commit `test: supabase mock seam → better-auth session seam`.

### Task 12: Cutover + comms (production)

**Files:** `docs/ops/deploy-runbook.md` (§1 env table + §2 procedure gain the BA env and the migration step)

- [ ] **Step 1 (pre-deploy, operator):** set `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`SMTP_*`/`TURNSTILE_SECRET_KEY` and `SUPABASE_DATABASE_URL` (read-only Supabase Postgres connection) in `server/.env`; run `server/scripts/migrate-supabase-auth.mjs --dry-run` against production (counts match Supabase `auth.users`, and `withPassword` is non-zero), then `--apply`; verify spot logins with old passwords (3 roles).
- [ ] **Step 2:** deploy server + client together (dual window makes server-first safe).
- [ ] **Step 3 (verify, owner):** login per role → portal; admin invite → email arrives (SMTP live) → accept link sets password; forgot-password → reset link; Turnstile solves and rejects a scripted bot token; MFA banner prompts re-enrollment for prior Supabase-MFA users; `GET /api/health?deep=true` OK; logs show no Supabase round-trips.
- [ ] **Step 4:** comms: "sign in again once; re-enroll TOTP" (existing MFA users), via the existing Broadcast channel.
- [ ] **Step 5:** Record the cutover in the runbook's revision note.

### Task 13: Cleanup (only after Task 12 verified)

**Files:**
- Modify: `server/src/auth.js` (delete `supabaseFallback` + `supa()`), delete `server/src/tokenCache.js`, remove `@supabase/supabase-js` from both `package.json`s, delete `src/shared/lib/supabase.js`, strip `SUPABASE_*`/`VITE_SUPABASE_*` from `.env.example` + `server/.env.example`, `vercel.json` CSP (`connect-src` drops `*.supabase.co`), `docs/arch/tech-stack.md` (rewrite §1/§3/§5 auth rows), `docs/plan/` this file → `docs/plan/done/`
- Delete: `supabase/` directory stays (retained as the historical Supabase-target schema per `db/README.md` — **do not delete**)

- [ ] **Step 1:** Grep proves zero `supabase` references outside `supabase/`, `db/README.md` history notes, and ADRs: `grep -ri supabase src server/src scripts db | grep -v node_modules` → only historical mentions.
- [ ] **Step 2:** Full verification: `npm test`, `npm --prefix server test`, integration suite, `npm run build`, `npm run syscheck` against `npm run preview`.
- [ ] **Step 3:** Commit `chore: remove supabase auth (better-auth cutover complete)`.

### Task 14: Records

- [ ] **Step 1:** Lead Architect writes `docs/arch/adr-056-better-auth-cutover.md` (**done 2026-11-21** — 055 is taken by the recovery-link ADR; records Decisions 1–14 + the MFA re-enrollment acceptance + the `admin_invites` boundary).
- [ ] **Step 2:** Rewrite `docs/arch/tech-stack.md` auth sections; retire `docs/arch/tech-stack-auth-alternative.md` (superseded-by note → delete, since this plan realizes it).
- [ ] **Step 3:** Commit `docs: adr-056 + tech stack update`.

## Ponytail notes (deliberate ceilings)

- `bcrypt` for all new passwords (not scrypt): matches the official guide, keeps verify uniform; upgrade path is rehash-on-login — add when a security review asks. `# ponytail: bcrypt(10) uniform; scrypt+rehash-on-login if review demands`. If the native `bcrypt` build fails on the target host, `bcryptjs` is an acceptable swap — the stored hashes and `verify` contract do not change; pin it with the same real `$2a$` fixture test.
- MFA factors not migrated (Decision 6): one-time re-enrollment accepted; an importer is only worth it if more than a handful of accounts have TOTP.
- No JWT/Bearer plugins: one auth surface (cookie), nothing to rotate; add the JWT plugin only if a second consumer (mobile app, third-party API) appears.
- `admin_invites` is one small table rather than an `auth.user` extension: it keeps app profile data out of the auth schema and makes the grant server-only by construction. Delete the row at provision; a stale row is inert.
- `nodemailer` is the only new delivery dependency; no UI kit, no BA prebuilt components.

## Explicitly NOT in scope

- Changing any role/permission/audit behavior (ADR-042 stays exact).
- Migrating Supabase MFA factors, sessions, or OAuth providers (none in use).
- Touching `db/schema.sql` app tables, uploads, AI, rate-limit semantics, monitoring.
- The Supabase-target schema retention (`supabase/migration.sql`, `db/README.md` rules).
