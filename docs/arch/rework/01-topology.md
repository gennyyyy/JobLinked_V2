# ADR-020 — Local Postgres + Supabase Auth + Vercel [SIGNED OFF 2026-10-03]

Decision (owner chose "Local Postgres now, Supabase later"):
- **Database:** local PostgreSQL, administered via pgAdmin4. Schema in portable
  SQL (`db/schema.sql` + `db/seed.sql`). No Supabase-only constructs.
- **Backend/auth:** Supabase Auth (signup, login, JWT, reset) stays. All DATA
  access moves to a thin Express API (`/server`) that validates the Supabase
  JWT and talks to local Postgres via `pg`. Replaces PostgREST + RLS + RPC.
- **Frontend:** same React app, deployed on Vercel. Only the transport inside
  `src/shared/services/*` changes (supabase-js queries → `fetch` to the API);
  exported function signatures are FROZEN so pages don't change.

What stays: Supabase Auth flows, AuthContext, AFK timer, `persistSession:false`,
all pages/layouts/components, Tailwind theme, audit + notification semantics.
What goes: direct table access from the browser, RLS, `notify_admins` RPC,
`handle_new_user` trigger (replaced by `POST /api/auth/provision`), Supabase
Storage (replaced by API-served local uploads), `supabase/migration.sql` as
the live schema (retained as the Supabase-target file for the later move).

Trust boundary: browser holds only the Supabase JWT. Every ownership/role
check lives in the API (guard matrix in `02-api-contract.md`). No RLS in
local Postgres — the API is the only DB client (`DATABASE_URL` never leaves
the server). `SUPABASE_SERVICE_ROLE_KEY` lives only in `server/.env`.

Explicitly deferred (future ADR, not this rework): where the API is deployed,
managed Postgres provider, file storage move off local disk (paths stored
relative so this is copy + prefix change), monthly reports/charts (ADR-009),
new-relevant-jobs fan-out (ADR-012).
