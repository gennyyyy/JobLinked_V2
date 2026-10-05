# AGENTS.md

## Commands
- `npm run dev` – starts BOTH Vite (web) and the Express API (api on :4000) via concurrently; Ctrl+C stops both
- `npm run dev:web` / `npm run dev:api` – run only one side
- `npm run build` – production build to `dist/` (Vercel builds this)
- `npm run lint` – ESLint, repo-wide (must exit 0 before submitting)
- `npm run preview` – preview production build
- `npm test` / `npm run test:watch` – vitest (jsdom + testing-library)
- `node src/index.js` (in `server/`) – Express API on `:4000`

No CI configured.

## Stack
- React 19, React Router v7, Vite 8, Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- Plain JS (no TypeScript); ESLint enforces React hooks + refresh rules
- Supabase (`@supabase/supabase-js`) for **auth only** – no table/storage/RPC calls from the browser
- API: Express 4 + `pg` (node-postgres, no ORM) + multer + cors + dotenv (`server/`)
- DB: local PostgreSQL, administered via pgAdmin4; portable SQL in `db/`
- Tests: vitest + jsdom + testing-library (`src/test/setup.js`)

## Required Environment Variables
The app needs this (see `src/shared/lib/api.js`):
- `VITE_API_URL` (dev defaults to `http://localhost:4000` when unset;
  production builds throw without it — see `.env.example`)

Supabase Auth still needs (see `src/shared/lib/supabase.js`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The API needs `server/.env` (gitignored – see `server/.env.example`):
- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT=4000`, `UPLOAD_DIR`, `CORS_ORIGIN`

Service-role key and `DATABASE_URL` must never appear in client code or the Vite bundle.

## Architecture

### Topology (ADR-020, `docs/arch/rework/01-topology.md`)
Browser → Express API (`/api`) → local Postgres. Supabase provides JWT auth
only. API contract: `docs/arch/rework/02-api-contract.md` (+ Addenda A/B).
Nothing alters `db/schema.sql` without architect approval; schema changes go
through `db/schema.sql` + psql, never the pgAdmin GUI. `supabase/migration.sql`
is retained untouched as the Supabase-target schema for a future move back.

### Auth & Roles
- `src/shared/context/AuthProvider.jsx` → provides `{ user, role, loading, logout, refreshUser }` via `AuthContext`
- `src/shared/hooks/useAuth.js` → consume auth state
- `src/shared/components/ProtectedRoute.jsx` → role-gate routes
- **Login flow**: Supabase `signInWithPassword` → `GET /api/auth/me` → 404 means
  unprovisioned → `POST /api/auth/provision` from `user_metadata` → retry `me`.
  Suspended → 403. `POST /provision` validates the token but skips the row check.
- **No session persistence**: Supabase client uses `persistSession: false, autoRefreshToken: false`
- **Expired JWT**: `api.js` retries once after `refreshSession()` on 401 (token attached only), else best-effort sign-out + hard bounce to `/portals`. Sign-out never rejects.
- **AFK auto-logout**: `src/shared/hooks/useAFKTimer.js` (5 min, warning at 4 min); wired into layouts

### Data Layer
- `src/shared/services/` – thin `fetch` wrappers over the API, via the single
  client in `src/shared/lib/api.js` (attaches Supabase JWT, throws `Error` with
  `.status`). Exported names/params/return shapes are frozen by the API contract.
- `src/shared/services/seekers.js` – profile children (education/experience/employment)
- `src/shared/lib/supabase.js` – auth calls only
- `src/shared/constants.js` – shared enums (roles, statuses, job tags, document types, etc.)
- Server ownership checks: seeker ⇄ own id, employer ⇄ own `company_id`, admin ⇄ all.
  Notifications + audit are best-effort server-side and never fail the action.

### Routing
- `src/App.jsx` – all route definitions; three protected portal nests (`/super-admin`, `/employer`, `/job-seeker`) each wrapped in `<ProtectedRoute>` + a layout with `<Outlet />`
- Public routes: `/`, `/jobs`, `/jobs/:jobId`, `/portals`, `/register/*`, `/forgot-password`, `/reset-password`, `/{portal}/login`
- `vercel.json` – SPA rewrite to `/index.html` (no serverless `api/` dir; the API deploys separately)

### UI
- Custom Tailwind theme in `src/index.css` – use `primary`, `accent`, `danger`, `dark-blue` color tokens (not default Tailwind palette)
- Feature folders in `src/features/` (`auth`, `employer`, `job-seeker`, `public-site`, `super-admin` – layouts live beside their features); shared code in `src/shared/` (`components`, `context`, `hooks`, `lib`, `services`, `utils`)

## Conventions
- No TypeScript; JSDoc for type hints if needed
- Tailwind classes inline in JSX; no CSS-in-JS
- Ponytail skill active at full intensity: laziest working solution first, shortest diff wins, no unrequested abstractions
- Design docs live in `docs/arch/` (`gap-matrix.md`, `adr-backlog.md`, `rework/`); implementation agents build against architect-signed contracts only
