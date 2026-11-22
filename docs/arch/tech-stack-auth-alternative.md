# JobLinked — Tech Stack Variant: Clerk instead of Supabase Auth

> **SUPERSEDED (2026-11-19):** the chosen path is the Better Auth library, not
> Clerk — see `docs/plan/2026-11-19-supabase-to-better-auth-plan.md`. This doc
> remains as the rejected-alternative record.

**Status: scenario, not approved.** Companion to `docs/arch/tech-stack.md`
(the current, Supabase-based stack). This is a what-if comparison to inform an
architect decision; nothing here is implemented and no schema is changed.
Assumption: hosted **Clerk** as the identity provider. Alternatives are listed
in §7 — swap §3–§6 accordingly.

## 1. Topology difference

```
Browser SPA  ──HTTPS──▶  Vercel (static build, SPA rewrite + security headers)
   │  VITE_API_URL
   ▼
Express API (single persistent Node process, VPS, systemd/pm2)   ADR-037
   │  DATABASE_URL (server-side only)
   ▼
PostgreSQL 18 (VPS)  ── files on local disk (UPLOAD_DIR) + bytea profile images
   │
   ├─ Clerk (hosted IdP: sign-in/up, MFA, password reset, session JWTs, webhooks)
   ├─ Cloudflare Turnstile  →  replaced by Clerk's built-in bot/CAPTCHA protection
   └─ OpenRouter / NVIDIA NIM (unchanged)
```

Supabase disappears entirely: no Supabase project, no `auth.users`, no
service-role key, no Supabase SDK on either side. Everything else (Express,
`pg`, Postgres, Vercel, uploads, AI, rate limits, monitoring) is unchanged.

## 2. What changes

### Frontend
- `@clerk/clerk-react` replaces `@supabase/supabase-js` for auth: `<SignIn />` /
  `<SignUp />` or custom forms on Clerk's API, `useAuth()` / `useUser()` for
  session state, `getToken()` for the API bearer token.
- `src/shared/lib/api.js`: attach the Clerk session JWT instead of the Supabase
  JWT. The 401-refresh-retry path is removed (Clerk rotates session tokens
  itself); the GET cache and error mapping are unchanged.
- `src/shared/context/AuthProvider.jsx` + `useAuth`: re-pointed at Clerk.
- `src/shared/lib/turnstile.js` + `<Turnstile />`: dropped — Clerk ships bot
  protection / CAPTCHA. (Keeps the CSP cleaner: no `challenges.cloudflare.com`.)
- Env: `VITE_CLERK_PUBLISHABLE_KEY` replaces `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`.

### Backend
- Remove `@supabase/supabase-js`, `tokenCache.js`, and `cachedGetUser`.
- Verify Clerk session JWTs server-side (RS256 via Clerk's JWKS, issuer +
  audience checks) using `@clerk/express` or `clerk-sdk-node`. `attachPrincipal`
  and the `auth` middleware keep the same shape: verified token → user id →
  `resolveRole` in Postgres → `req.user`.
- Provisioning (`POST /api/auth/provision`): still creates the Postgres role
  row, now keyed by the Clerk user id. Trigger it from a Clerk `user.created`
  webhook (SVIX signature verified) or keep the existing client-driven call.
- Health deep check probes Clerk's API instead of Supabase.
- Env: `CLERK_SECRET_KEY`, `CLERK_ISSUER`/`CLERK_JWKS_URL`, optional
  `CLERK_WEBHOOK_SECRET` replace `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

### Database — the one hard part
Clerk user ids are opaque strings (`user_2…`), but the role tables use
`uuid` PKs (`job_seekers`, `employers`, `super_admins`) and every FK points at
them. Two options:

- **Recommended (small diff):** add `clerk_id text not null unique` to each
  role table, keep the uuid PKs and all FKs, resolve roles by `clerk_id`.
  Requires a schema change — architect approval before any migration.
- **Large diff:** convert the PKs and FKs to `text`. Touches every table and
  query; not worth it.

No other schema change: enums, permissions, custom roles, and the
`super_admins` guard all stay. The Supabase-only `app_metadata.role` signal
disappears — super-admin must be re-guarded by a server-side mapping (the
Postgres row plus a Clerk organization role / custom claim verified server-side,
never a client claim).

### Security / ops / CI
- MFA, password reset, email verification, session revocation, and login
  throttling move to Clerk's dashboard — less code to own, but Clerk becomes a
  security dependency (allowlist its domains in CSP, monitor its status page).
- Rate limits, CORS fail-closed, `TRUST_PROXY`, helmet, backups, and the
  `/api/metrics` + deep-health probe are unchanged.
- CI integration tests and the `smoke` role walkthrough need Clerk test keys
  (or a stubbed verifier); fixture provisioning switches to Clerk's API/webhook.

## 3. What stays the same

Vite + React 19 SPA, Tailwind v4, Base UI, React Router/StaticUrlRouter, the
`api.js` client, Express 4 + `pg` + Postgres 18, the migration ledger, disk
uploads + `profile_images`, AI provider/matching, Vercel hosting, VPS single
process, backups/restore drill, GitHub Actions pipeline, Vitest/ESLint.

## 4. Migration path (if approved)

1. Add `clerk_id` columns + unique indexes (schema change, approved first).
2. Dual-auth window: accept both Supabase and Clerk tokens; provision links a
   Clerk id to the existing row on first login.
3. Switch the client to Clerk; disable Supabase sign-in.
4. Remove the Supabase SDK, env, and `tokenCache`; drop Turnstile.

## 5. Trade-offs

- **Gains:** better React DX and prebuilt auth UI, MFA/orgs/session controls
  out of the box, no Supabase project to keep in sync, simpler CSP.
- **Costs:** monthly billing, vendor lock-in, a new security dependency, and
  the `clerk_id` mapping migration. Clerk's session model also changes the
  client's token-refresh behavior (simpler, but a rework of `api.js`).

## 6. Decisions to record before any work

- ADR: choose Clerk (or alternative) and the `clerk_id` mapping.
- Schema change request for `clerk_id` columns (architect approval required).
- Update `docs/ops/deploy-runbook.md`, `.env.example`, and the security audit
  provenance table.

## 7. Other candidates

- **Keycloak** (self-hosted on the same VPS): no vendor or billing, fits the
  current single-process/Postgres philosophy, but real ops and setup work.
- **Auth0**: enterprise hosted IdP, strong MFA/RBAC, pricing tiers.
- **Self-rolled (Lucia-style)**: own session tables in Postgres, no vendor; most
  control and most work — you own password reset, MFA, and breach response.
