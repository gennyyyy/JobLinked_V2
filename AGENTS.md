# Repository Guidelines

## Project Structure

- `src/features/` contains the auth, employer, job-seeker, public-site, and super-admin features.
- `src/shared/` holds reusable components, context, hooks, API clients, services, and constants.
- `server/` contains the Express API; `db/` contains the portable PostgreSQL schema and SQL.
- `docs/arch/` holds architecture decisions and API contracts. Tests use Vitest and live alongside source files or in the established test directories.

## Build, Test, and Development

- `npm run dev` starts the Vite web app and Express API together.
- `npm run dev:web` or `npm run dev:api` starts one side; API runs on port 4000 by default.
- `npm run build` creates the production bundle in `dist/`.
- `npm test` runs Vitest; `npm run test:watch` keeps it running during development.
- `npm run lint` runs ESLint across the repository. Run it before submitting changes.
- `npm run preview` serves the production build locally.

## Coding Style

Use JavaScript and JSX; TypeScript is not used. Follow nearby code for formatting and naming. Use PascalCase for React components, camelCase for functions and variables, and keep feature-specific code in its feature folder. Tailwind classes belong in JSX and should use the theme tokens in `src/index.css` (such as `primary`, `accent`, `danger`, and `dark-blue`). Keep API calls in `src/shared/services/` through the shared client in `src/shared/lib/api.js`.

## Testing

Tests run with Vitest, jsdom, and Testing Library, with shared setup in `src/test/setup.js`. Name tests `*.test.js` or `*.test.jsx` and place them near the code they cover or in the existing test directory. Add or update focused tests for behavior changes, then run `npm test` and `npm run lint`.

## Commits and Pull Requests

Use short, imperative commit subjects that describe the change (for example, `Fix seeker profile loading`). Keep changes focused. Pull requests should explain the user-visible behavior and implementation, list relevant verification commands, link related issues when available, and include screenshots for UI changes.

## Architecture and Configuration

The browser talks to the Express API, which owns PostgreSQL access. Supabase is for authentication only; do not add browser-side database, storage, or RPC calls. Do not modify `db/schema.sql` without architect approval; schema updates must go through that file and `psql`. Keep service-role keys and `DATABASE_URL` out of client code. Configure frontend variables as described in `.env.example` and API secrets in `server/.env` using `server/.env.example`.
