# Frontend plan — Vercel + transport swap (page code untouched)

## Deploy config (frontend agent)
- `vercel.json`: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
  (SPA fallback; no `api/` directory — the API is a separate deploy later).
- `.env.example`: `VITE_API_URL=http://localhost:4000` (dev),
  `VITE_SUPABASE_URL=` + `VITE_SUPABASE_ANON_KEY=` (auth only, already required
  by `lib/supabase.js`). Vercel dashboard gets the same three vars (API URL =
  local tunnel for now, real URL when the API deploys).
- No code changes needed for Vercel beyond this (Vite build is the default).

## Transport swap (frontend agent)
- NEW `src/shared/lib/api.js` — the ONLY fetch wrapper: reads the Supabase
  session access token, sets `Authorization: Bearer`, JSON by default,
  `FormData` passthrough for uploads, throws `Error(message)` with `.status`
  on `{ error }` bodies. One file, no deps.
- `src/shared/lib/supabase.js` — stays, auth calls ONLY (`auth.*`). Any
  `supabase.from` / `supabase.storage` / `supabase.rpc` elsewhere is deleted
  in this pass.
- `src/shared/services/*` — same file names, same exported function names,
  same params, same return shapes (frozen by `02-api-contract.md`); bodies
  become `api.get/post/patch/del(...)` one-liners. `validateFile`,
  `makeDocPath` (client id hint only — server owns final path),
  `latestAccByCompany`, `NOTIFICATION_TYPES` stay client-side. Service-to-
  service imports that bypass HTTP (`attachSeekers`, `notify`, `notifyAdmins`,
  `logAudit` inside other services) are REMOVED client-side — that logic now
  lives in the API; services only call HTTP.
- Direct `supabase.from` calls inside pages (`Profile.jsx`, `Employment.jsx`,
  `Applicants.jsx`, `CompanyProfile.jsx`, `JobPosts.jsx`,
  `EmployerAccreditation.jsx`, `EmployerStatus.jsx`, `Dashboard.jsx` — see
  gap-matrix tech-debt list) are routed through the matching service function
  (add it if missing, same signature style) — no raw client queries remain.

## Directory blueprint (after rework)
- `/server` — Express API: `package.json` (express, pg, multer, cors, dotenv,
  @supabase/supabase-js for token validation only), `src/index.js`,
  `src/db.js` (pg Pool), `src/auth.js` (middleware), `src/routes/*.js` (auth,
  jobs, applications, employers, seekers, accreditations, documents, files,
  admin, notifications — one per contract section), `server/.env` (gitignored:
  DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT=4000,
  UPLOAD_DIR, CORS_ORIGIN), `uploads/` (gitignored).
- `/db` — `schema.sql`, `seed.sql`, `README.md`.
- `/vercel.json`, updated `.env.example`.

## State management — unchanged
AuthContext + Supabase session + AFK timer as-is. No global store, no
React Query (YAGNI — service calls already cover server state; add when
caching measurably matters).
