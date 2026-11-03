# ADR-035 — Next.js App Router replaces Vite at the repository root [ACCEPTED 2026-11-03]

## Context
The frontend is a Vite 8 + React 19 SPA written in JavaScript (`src/`). A complete Next.js 16
App Router app with better feature breadth exists at `new_frontend/Joblinked/`, but every screen
reads from an in-memory mock. Keeping both means two data layers, two toolchains, two ways to
style a screen, and two test setups. The Vite app also carries a root `vercel.json` catch-all
rewrite to `index.html` that would break App Router serving.

The project owner requires the old flat layout: the frontend lives directly at the repository
root, not nested in a subfolder.

## Decision
- One frontend, one location: the Next app's contents move to the repository root (`app/`,
  `components/`, `constants/`, `hooks/`, `lib/`, `public/`, `services/`, `tests/`, `types/`, plus
  `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `components.json`). The Vite app
  (`src/`, `index.html`, `vite.config.js`, `eslint.config.js`, `dist/`, old root `public/`, root
  `vercel.json`) is deleted in the same change. No coexistence period. No `web/` folder.
- One package manager: **npm only**. `pnpm-lock.yaml` / `pnpm-workspace.yaml` removed, no
  `packageManager` field. One lockfile: root `package-lock.json`.
- The root `package.json` is both the app package and the orchestrator: it carries the Next app's
  dependencies and scripts (`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`) and
  proxies the API with `npm --prefix server run dev`.
- Deployment target is the repository root (Vercel project root = repo root); the API stays on its
  own host behind `NEXT_PUBLIC_API_URL`.
- Ports: Next dev `3000`, API `4000`.

## Consequences
- Every later task edits exactly one app at the repo root; shared types/env names live at root.
- The frontend is TypeScript strict; no `.jsx` frontend files are added.
- `server/`, `db/`, `docs/`, `plan/` stay as sibling folders; `server/package.json` remains its own
  package.
- The API's default CORS origin changes from `http://localhost:5173` to `http://localhost:3000`
  (`CORS_ORIGIN` still overrides; the example keeps `5173` until the old app is fully retired).
- Docs (`AGENTS.md`) describe the flat root layout + `server/` and the new commands.
- Loss of Vite's instant HMR is accepted: Next dev server is the only dev loop.

## Alternatives
- **Keep Vite and port the new UI piecemeal** — duplicates the data layer during the port, keeps two
  test setups, and ends with the same deletion later. Rejected.
- **Nest the app in `web/`** — cleaner for multi-package repos, but the owner explicitly wants the
  old flat layout. Rejected.
- **Run both frontends behind one origin (rewrites)** — doubles auth surfaces and doubles the
  session/guard work for no user-visible gain. Rejected.
