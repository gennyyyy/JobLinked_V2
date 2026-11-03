# Repository Guidelines

## Project Structure

- The Next.js 16 App Router frontend lives directly at the repository root, TypeScript strict with Tailwind 4 and shadcn UI: `app/` (routes), `components/`, `hooks/`, `lib/`, `services/`, `types/`, `constants/`, `public/`, `tests/`, `e2e/`.
- `server/` is the Express API (`server/src/`) and owns all PostgreSQL access.
- `db/` holds the portable PostgreSQL schema and migrations; `docs/arch/` holds ADRs; `plan/` holds the migration plan.
- Root `package.json` is both the frontend package and the orchestrator for the two processes.

## Build, Test, and Development

- `npm run dev` starts the Next app (port 3000) and the Express API (port 4000) together.
- `npm run dev:web` or `npm run dev:api` starts one side; the API runs on port 4000 by default.
- `npm run build` runs the Next production build; `npm run start` serves it.
- `npm run typecheck`, `npm run lint`, `npm test` (Vitest) and `npm run test:e2e` (Playwright) run against the root app.
- `npm --prefix server test` runs the API test suite. Run it in addition to `npm test` when touching `server/`.
- **npm only.** Do not add a pnpm lockfile, yarn lockfile, or a `packageManager` field.

## Coding Style

The frontend is TypeScript strict; no `.jsx` files and no `any` where a real type exists. `server/` stays JavaScript (ESM). Use PascalCase for React components and camelCase for functions and variables. Follow the existing feature folders in `components/`. Tailwind classes belong in JSX and should use the theme tokens in `app/globals.css`.

All browser data access goes through the Express API via `services/api/client.ts` and the per-domain modules in `services/`; components never call `fetch` or build URL paths. Backend enum values are translated in `services/mappers.ts` only.

## Testing

Frontend tests use Vitest, jsdom, and Testing Library; name them `*.test.ts` / `*.test.tsx` next to the code they cover. End-to-end specs live in `e2e/` and run with Playwright. Server tests use Vitest and supertest alongside the route files (`server/src/**/*.test.js`). Add or update focused tests for behavior changes, then run the relevant command and `npm run lint`.

## Commits and Pull Requests

Use short, imperative commit subjects that describe the change (for example, `Fix seeker profile loading`). Keep changes focused. Pull requests should explain the user-visible behavior and implementation, list relevant verification commands, link related issues when available, and include screenshots for UI changes.

## Architecture and Configuration

The browser talks to the Express API, which owns PostgreSQL access. Supabase is for authentication only; do not add browser-side database, storage, or RPC calls. Do not modify `db/schema.sql` without architect approval; schema updates must go through that file and `psql`. Keep service-role keys and `DATABASE_URL` out of client code.

Frontend variables go in `.env.local` at the repo root (copy `.env.example`) and are limited to `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. API secrets go in `server/.env` (copy `server/.env.example`). Never put a service-role key or `DATABASE_URL` in a `NEXT_PUBLIC_*` variable.
