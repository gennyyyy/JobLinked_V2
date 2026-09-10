# AGENTS.md

## Project Overview
React + Vite frontend for a multi-portal job marketplace (super-admin, employer, job-seeker).

## Commands
- `npm run dev` – start Vite dev server with HMR
- `npm run build` – production build to `dist/`
- `npm run lint` – run ESLint
- `npm run preview` – preview production build locally

Run lint before submitting work.

## Stack & Structure
- **Framework:** React 19 + React Router v7 (client-side routing, no backend in this repo)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Bundler:** Vite v8
- **Linting:** ESLint with React plugin, no TypeScript

## Entry Points & Architecture
- `src/main.jsx` → wraps `<App>` in `<AuthProvider>` (global auth context)
- `src/App.jsx` → route definitions; three main portals:
  - `/super-admin/*` → super-admin dashboard (protected by `<ProtectedRoute role="super-admin">`)
  - `/employer/*` → employer portal (protected by role)
  - `/job-seeker/*` → job seeker portal (protected by role)
  - `/` → landing, `/jobs`, `/register/*` → public routes
- `src/context/AuthProvider.jsx` – manages auth state and role checks
- `src/components/ProtectedRoute.jsx` – enforces role-based access control

## Directory Reference
- `src/pages/` – route pages (Landing, Login, Register, etc.)
- `src/pages/superadmin/`, `src/pages/employer/`, `src/pages/job-seeker/` – role-specific pages
- `src/layouts/` – SuperAdminLayout, EmployerLayout, JobSeekerLayout (wrappers for role portals)
- `src/components/` – shared UI components, ProtectedRoute
- `src/hooks/` – custom React hooks
- `src/context/` – context providers (AuthProvider)
- `src/utils/` – utility functions
- `src/data/` – static data or constants

## Conventions
- No TypeScript: use JSDoc for type hints if needed, but repo is plain JS
- ESLint targets `**/*.{js,jsx}` with React hooks and refresh rules enforced
- Tailwind classes inline in JSX; no CSS-in-JS

## Important Notes
- Auth and role enforcement happen client-side; ProtectedRoute checks role in AuthProvider context before rendering
- No backend API calls visible in App.jsx; assume API integration happens in pages/components or a missing API layer
- Vite config is minimal; Tailwind is integrated via plugin (not PostCSS)
