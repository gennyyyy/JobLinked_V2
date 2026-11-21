# ADR-056 — Better Auth cutover (Supabase Auth removed)

- **Status:** Accepted
- **Date:** 2026-11-21
- **Supersedes:** the Supabase-auth portions of ADR-028 (token cache) and ADR-041 (Turnstile verified by Supabase). ADR-041's product decision — Turnstile in front of credential calls — stands.
- **Plan:** `docs/plan/2026-11-19-supabase-to-better-auth-plan.md`
- **Renumbered:** `adr-055-recovery-link-entry.md` already holds 055.

## Context

Supabase's built-in mailer rate-limits auth email by roughly the third send (measured 2026-11-04, `docs/arch/runbooks/supabase-auth-launch-config.md`). On 2026-11-21 a live browser run confirmed `POST /auth/v1/recover` answering `429` while the project's `/token` endpoint still answered `400` — the limit is the mailer bucket, not an outage and not our Express limiter. Password recovery, invite acceptance, and registration all depend on that mailer. Custom SMTP in the Supabase dashboard would lift the cap, but the provider keeps the quota, the schema, and the token format while this repo already owns the Postgres, the Express API, and every profile/permission decision.

Better Auth is a library, not a service: it runs inside the existing single Express process (ADR-037) against our database, and we send our own mail through SMTP.

## Decision

1. **Placement.** Better Auth 1.7.x inside `server/`; tables in a dedicated `auth` schema in the same Postgres. `public` stays app-only. `pg_dump -Fc` covers every schema.
2. **Sessions.** Better Auth's signed session cookie on the API origin. No JWT or Bearer plugin: one auth surface, nothing to rotate. CORS gains `credentials: true` with the existing explicit origin list. Same-site subdomains (`www` → `api`) carry the cookie.
3. **Identity.** `advanced.database.generateId: "uuid"` so `auth.user.id` keeps the uuid the role tables already use as PK/FK. No mapping table.
4. **Passwords.** bcrypt `hash`/`verify`, cost 10, matching Supabase's hashes; imported `$2a$` hashes verify unchanged. BA does not rehash on login — accepted, bcrypt remains sound. `minPasswordLength: 8` plus a `hooks.before` guard on sign-up / reset / change enforcing 8–72 with at least one letter, one number, one symbol. The client already enforces exactly that (`src/shared/utils/password.js`); the hook closes the direct-API bypass. Supabase never enforced complexity server-side either.
5. **Email.** `nodemailer` over SMTP. Production uses Resend (`SMTP_HOST=smtp.resend.com`, port 587, user `resend`, password = API key, verified `FROM`). Development has no sender: when `SMTP_HOST` is unset **and** `NODE_ENV !== 'production'`, the mailer logs the action URL to the server console instead of sending. Production with no SMTP configured fails closed (no URL in logs, a clear error), never silently pretends to send.
6. **Turnstile.** BA's captcha plugin (`provider: 'cloudflare-turnstile'`) with the token in the `x-captcha-response` header. Protected endpoints are BA's defaults: `/sign-up/email`, `/sign-in/email`, `/request-password-reset`. The site key and widget stay.
7. **Admin invites and the unforgeable grant.** BA's admin-plugin `user.role` is the provider-side role signal. The pending app profile (first/middle/last/suffix/phone/company) and the custom-role grant live in a new **`public.admin_invites`** table: `user_id uuid PK → auth."user"(id)`, `role text`, `custom_role_id bigint null → public.reference_data(id)`, `profile jsonb`, `created_at`. Only the server invite route writes it; `POST /api/auth/provision` consumes and deletes it. The request body can never grant a role or bundle. This replaces `app_metadata`, whose only virtue was being unwritable by the client — a property a server-only table also has, without polluting the auth user row with app profile fields.
8. **Self-signup profile data.** BA's `requireEmailVerification` makes sign-up return **no session**, and BA stores only `name`/`email` — the registration form's role, address, skills, education, and employer fields would be lost between sign-up and first sign-in (the Supabase flow kept them in `user_metadata`). A transient **`public.pending_signups`** table (`user_id uuid PK → auth."user"(id)`, `role text` constrained to `job-seeker`/`employer`, `profile jsonb`, `created_at`) holds them. A pre-auth, rate-limited `POST /api/auth/pending-signup` writes the row only for an existing unverified user whose id and email match; `provision` claims and deletes it in the same transaction as the role-row insert. Unverified users still get no role row (no session exists until verification), and `super-admin`/`custom_role_id` can never be stored here.
8. **Dual-auth window.** Session resolution tries the BA cookie first, then the legacy Supabase bearer, until the client cutover. Both paths produce the same principal: `{ id, email, role, customRoleId, permissions }`. Supabase is deleted only after the client, data, and cutover are verified.
9. **Rate limits.** The existing `express-rate-limit` buckets stay the operator-facing knob. BA's built-in limiter stays enabled as defense in depth. Both are in-memory and single-instance, the documented ADR-037 ceiling.
10. **Data migration.** A resumable, idempotent script reads `auth.users` from the Supabase Postgres database (read-only) and writes `auth."user"`/`auth."account"`, preserving the bcrypt hash bytes and `email_confirmed_at`, with uuids equal to the Supabase ids. The admin API cannot be the source: it omits `encrypted_password` (measured 2026-11-21 — 0 of 161 users returned a hash). It runs before the client deploy. Sessions do not migrate: every user signs in once.
11. **MFA.** TOTP moves to BA's two-factor plugin. Supabase TOTP secrets are provider-encrypted with no documented importer, so existing factors are **not** migrated; affected admins re-enroll once at cutover and are told so.
12. **Schema authority.** `db/migrations/017_better_auth_tables.sql` + `db/migrations/018_pending_signups.sql` + `db/schema.sql`. BA table names are exactly as generated (quoted, including `"twoFactor"`); renaming them breaks BA's queries. The new `public` objects are `admin_invites` and `pending_signups`. The generated DDL must emit `uuid` ids; if it emits `text`, stop and return to the architect.
13. **Runtime options pinned.** BA's origin/CSRF check is forced on (`advanced.disableOriginCheck: false`) even under `NODE_ENV=test`, so a wrong `trustedOrigins` list fails the suite. Schema introspection is off (`advanced.database.validateSchema: false`): migration 017 is the authority, and `/api/auth/ok` must not require a database round-trip. BA's logger is routed through the API's one-JSON-line logger. Every `better-auth` upgrade requires re-running the generator and diffing 017.

## Consequences

- Auth email is ours: no third-party email cap, and the dev flow no longer needs a provider at all.
- One-time user cost at cutover: one sign-in for everyone, TOTP re-enrollment for the few accounts that use it.
- New runtime dependencies: `better-auth`, `bcrypt`, `nodemailer`, and an explicit `kysely` (the config imports `PostgresDialect`; do not rely on a transitive dependency).
- One deploy window accepts two token formats. That complexity is temporary and must not leak past the cleanup task.
- The single-process, in-memory limiter ceiling (ADR-037) now applies to BA's limiter too. Scaling out requires a shared store for both.
- Runtime schema validation is deliberately off: a BA upgrade can add a column that 017 lacks, and the failure appears at query time. Re-generate and diff the DDL on every upgrade (decision 13).
- `supabase/` stays in the repo as the historical schema target (`db/README.md`); only runtime/config references are removed.

## Not in scope

OAuth/social providers, MFA factor migration, changes to ADR-042 permissions or the audit convention, browser-side database access, and deleting the retained Supabase-target SQL.
