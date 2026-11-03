# Joblinked Frontend Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Vite React SPA in `src/` with the Next.js App Router app from `new_frontend/Joblinked/` (moved to the repository root), wire it to the existing Express API and Supabase auth, port the six old-only auth/UX features, and add the four approved backend capabilities — with every old route, screen, and flow still working.

**Architecture:** Next.js 16 App Router at the repository root renders UI only; all data continues to flow browser → Express (`server/`, port 4000) → PostgreSQL, with Supabase used strictly for authentication (same trust model as today: in-memory browser session, bearer token attached by one REST client). The mock/demo data layer (`services/mock`, `demoApi`, `DemoSwitcher`) is deleted and replaced by one typed REST client + mapper layer + per-resource SWR hooks. Staff = a super-admin account with a restricted custom role, enforced by a new `requirePermission()` middleware.

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict / Tailwind 4 / shadcn UI / SWR / react-hook-form + zod / sonner / Vitest + Testing Library / Playwright. Backend: Express 4 / pg / Supabase Auth / Vitest + supertest.

**Spec:** this document (§1–§11 are the approved design; ADRs 035–041 will be written to `docs/arch/` during Task 1).

---

## Global Constraints

- Repository layout after migration: the Next app lives directly at the repository root (`app/`, `components/`, `hooks/`, `lib/`, `services/`, `types/`, `public/`, `tests/`), with `server/` (Express, unchanged structure), `db/`, `docs/`, `plan/` as siblings. Root `package.json` is the app package and orchestrates both processes.
- npm only. No pnpm lockfile, no Vite, no `src/` frontend, no JS frontend files — the frontend is TypeScript strict.
- All browser data access goes through the Express API. Supabase is used only for `signInWithPassword`, `signUp`, `signOut`, `updateUser`, `resetPasswordForEmail`, `getSession`, `refreshSession`, `onAuthStateChange`. No Supabase `.from/.storage/.rpc`.
- API base URL comes from `NEXT_PUBLIC_API_URL` (dev fallback `http://localhost:4000`), Supabase from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Backend roles remain `super-admin | employer | job-seeker`. UI names: `admin | employer | jobseeker` (+ derived `staff` display).
- Backend enums are the source of truth. UI labels map in **one** file (`services/mappers.ts` at the repo root); no component invents a status string.
- Error envelope from the API is `{ "error": { "code": string, "message": string } }`; the client throws `ApiError(message, status, code)` and pages toast `error.message`.
- One 401 policy: refresh session once, retry once, then sign out and go to `/login?next=…`. No loops, no recursion.
- Every new backend route gets a supertest test in the existing `server/src/routes/*.test.js` style; every mapper and the REST client gets a Vitest test; every route and portal flow gets a Playwright spec.
- Database changes ship twice: `db/migrations/010_frontend_migration.sql` (new work) and mirrored idempotent statements in `db/schema.sql` (source of truth). Apply with `psql` per `db/README.md`.
- Legacy URLs must keep working via `next.config.mjs` redirects (see §5.3).
- Do not delete `new_frontend/` until Task 25; it is the reference copy.

---

## Review Focus

These are the five ways a user will actually get hurt; each has a named test that must exist before the task owning the code is accepted.

| # | Failure mode | Expected behavior | Test |
|---|---|---|---|
| R1 | Session expires or is revoked mid-action (any portal) | One silent refresh + retry; second 401 signs out and lands on `/login?next=<current>` with a message, never a blank page | `services/api/client.test.ts`; e2e `auth.spec.ts` |
| R2 | User opens a portal URL for the wrong role, or a staff member opens a section their custom role forbids | Session destroyed on wrong portal (ADR-021 parity) → that portal's login; forbidden section renders the "no access" state, no API call storm | `hooks/use-auth.test.tsx`; unit `canOpenSection`; e2e `gating.spec.ts`; backend `admin.permissions.test.js` |
| R3 | Backend sends a status value the UI does not know (enum drift) | Mapper returns the raw value with a neutral label/badge, never `undefined`, never crash | `services/mappers.test.ts` (one case per enum value + unknown fallback) |
| R4 | Resume/document upload exceeds limits or auth expires during upload/preview | Client pre-checks size/type and shows the server's message; preview blob fetch uses auth and revokes the object URL | `services/documents.test.ts`; e2e `jobseeker.spec.ts` upload + preview |
| R5 | Filters/pagination/date params lose meaning between UI and API | Empty/undefined params omitted; `pageSize` clamped to API caps; deadlines compared by calendar date, not UTC instant | `client.test.ts` query cases; `mappers.test.ts` deadline case |

---

## §1 Context

Current app: Vite 8 + React 19 SPA (`src/`), react-router 7, JavaScript/JSX, Tailwind 4, Vitest + Testing Library. Auth: Supabase browser SDK with `persistSession:false`, profile via `GET /api/auth/me`, role-gated routers, 401 refresh-and-retry in `src/shared/lib/api.js`, ADR-021 role-mismatch logout. Backend: Express under `/api`, 16 tables, services cover jobs/applications/accreditation/documents/seekers/notifications/admin/AI.

New app (`new_frontend/Joblinked/`): Next 16 App Router, TypeScript strict, Tailwind 4 + shadcn (`@base-ui`), SWR, react-hook-form + zod, sonner, recharts, resume parsing via pdfjs/mammoth, `next-themes`. Feature breadth is equal or better than current, but **100% of its data comes from an in-memory/localStorage mock** (`services/mock/*`) through `useDemo()`; auth is a demo account picker (`DemoSwitcher`, shared password `Demo123!`); `services/api/http.ts::createRestClient` and `services/api/contracts.ts` are unused scaffolding whose paths only partially match the real API; no tests run.

The migration keeps the new app's UI/route structure and replaces exactly its data/auth boundary, then fills the feature gaps below.

### §1.1 Gap decisions (approved by user 2026-11-03)

| Gap | Decision |
|---|---|
| Saved jobs (UI exists, no table) | Add `saved_jobs` table + endpoints |
| Announcements CRUD (UI exists, backend only has one-shot broadcast) | Add `announcements` table + endpoints; publishing fans out notifications |
| Employment correction requests (UI exists, employment_history is trigger-written) | Add `employment_corrections` table + endpoints |
| Staff role (UI models it, backend has 3 roles) | **No new role value/table.** Staff = super-admin row with restricted `custom_role_id`; new `requirePermission()` gate on admin routes; UI derives `staff` |
| Apply cover letter (UI collects ≤3000 chars, no column) | Add `job_applications.cover_letter` column (architect-approved bundle with the above) |
| Old-only: real forgot/reset password, email-confirm callback, admin invite acceptance, AI help chat, AFK auto-logout, notification bell | Port all six into the Next app |
| Demo notification preferences (no backend storage) | Remove the toggles; keep real notification list/actions |
| Staff "assigned jobs/employees" scoping (`PermissionScope "assigned"`) | Out of scope; staff permission scopes are section-level only (`all` vs `none`) |
| Employer logo upload | Out of scope (text profile fields only); `logo_path` untouched |
| Jobseeker withdraw/cancel application | No backend endpoint exists; keep display-only (no button that pretends to work) |
| "Refer applicant" action | No backend endpoint; application list shows referral presence only |

---

## §2 Architecture Decisions (write as ADR-035 … ADR-041 in Task 1)

**ADR-035 — Next.js App Router replaces Vite at the repository root.**
One frontend, one toolchain (npm). The Next app lives directly at the repo root; root scripts run Next and proxy the API to `server/`. Vercel project root is the repository root; the old `vercel.json` catch-all rewrite is deleted (it would break App Router). Rejected: keeping Vite and porting UI piecemeal (duplicates two data layers); nesting the app in `web/` (user-requested old layout is flat).

**ADR-036 — Auth stays browser-side with in-memory session (parity with current app).**
Supabase `persistSession:false`, `autoRefreshToken:false`; profile fetched from `GET /api/auth/me`. No `middleware.ts` auth checks (the server cannot see an in-memory session, and adding cookie-based SSR auth would change the security model approved for this system). Consequence, documented: a hard reload signs the user out — same as today. Client-side portal guards are the protection layer; the API remains the enforcement layer for every request.

**ADR-037 — One REST client + one mapper layer + SWR per resource.**
`services/api/client.ts` is the only fetch path (auth header, query building, 401 policy, blob helper). `services/mappers.ts` converts snake_case API rows to the domain types already used by components. SWR replaces `useDemo`: one key per resource; mutations `mutate(key)` their affected keys. The demo layer (`services/mock`, `DemoSwitcher`, demo accounts) is deleted in the same change — no dual mode.

**ADR-038 — Staff is a restricted custom role, not a fourth role.**
`super_admins.custom_role_id` already exists; custom roles already live in `reference_data` (`details.permissions[]`). Backend adds `requirePermission(token)` beside `requireRole('super-admin')`; a null custom role passes everything, a set custom role must contain the token. UI maps `role === 'admin' && custom_role != null` → staff presentation/permission gating. Rejected: fourth role table + role refactor of every route.

**ADR-039 — Backend statuses are canonical; UI statuses are presentation.**
Mappers own the translation tables in §8.2. UI actions call the backend action endpoints, never `PATCH status` for application transitions. `Shortlisted` actions are removed (backend migration 004 already removed that status).

**ADR-040 — New tables and one column, shipped via migration 010 + schema.sql.**
`GET/POST/DELETE` saved jobs; announcements with publish-time fan-out; employment corrections; `cover_letter`. No other schema changes in this migration.

**ADR-041 — Legacy routes redirect, they do not 404.**
`/super-admin/* → /admin/*`, `/job-seeker/* → /jobseeker/*`, `/register/* → /signup/*`, portal logins → `/login`, `/portals → /`. Redirects are permanent (`308`) except login (`307` keeps `?next`).

---

## §3 Directory Blueprint

```
E:/code_ni_hans/peso_project
├─ package.json                 # app package + orchestrator: dev/build/lint/typecheck/test/test:e2e
├─ next.config.mjs              # Next config (security headers + legacy redirects)
├─ tsconfig.json                # strict TS, "@/*" → "./*"
├─ postcss.config.mjs / components.json / eslint.config.mjs
├─ .env.example / .env.local    # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
├─ app/                         # existing routes; + forgot-password, reset-password, auth/callback, accept-invite
├─ components/                  # existing; DemoSwitcher deleted; + help-chat.tsx, notification-bell.tsx
├─ constants/                   # existing; demo constants removed
├─ hooks/
│  ├─ use-auth.tsx              # new (port of old AuthProvider semantics)
│  ├─ use-afk-timer.ts          # new (ported)
│  ├─ queries.ts                # new SWR hooks, one file
│  ├─ use-action.ts             # kept (toast + pending)
│  └─ use-demo.ts               # DELETED
├─ lib/
│  ├─ supabase.ts               # new browser client
│  ├─ permissions.ts            # kept; + announcements/audit tokens; real permission source
│  └─ …
├─ services/
│  ├─ api/client.ts             # new (sole fetch path)
│  ├─ api/http.ts               # DELETED (superseded)
│  ├─ api/contracts.ts          # DELETED (interfaces migrate into domain services)
│  ├─ api/mock/**               # DELETED
│  ├─ auth.ts jobs.ts applications.ts seekers.ts employers.ts documents.ts
│  ├─ admin.ts announcements.ts corrections.ts notifications.ts ai.ts
│  └─ mappers.ts                # new
├─ types/index.ts               # extended (statuses, permissions, cover letter)
├─ tests/                       # empty until Task 8 (demo-store spec removed in Task 1)
├─ vitest.config.ts / playwright.config.ts
├─ e2e/                         # new specs + helpers
├─ public/                      # Next static assets
├─ AGENTS.md                    # rewritten for new layout
├─ plan/2026-11-03-joblinked-frontend-migration.md
├─ docs/arch/adr-035…041-*.md
├─ db/
│  ├─ schema.sql                # + saved_jobs, announcements, employment_corrections, cover_letter
│  ├─ migrations/010_frontend_migration.sql
│  └─ seed.sql                  # unchanged
└─ server/
   ├─ src/auth.js               # + requirePermission()
   ├─ src/routes/auth.js        # /auth/me returns custom_role
   ├─ src/routes/saved-jobs.js  # new
   ├─ src/routes/announcements.js # new
   ├─ src/routes/corrections.js # new
   ├─ src/routes/applications.js# + cover_letter
   ├─ src/app.js                # mount new routers
   └─ scripts/seed-e2e.js       # new (Task 24)
```

---

## §4 Config & Environment

Root `package.json`:

```json
{
  "name": "peso_project",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "concurrently -n web,api -c blue,green \"npm:dev:web\" \"npm:dev:api\"",
    "dev:web": "next dev",
    "dev:api": "npm --prefix server run dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": { "…Next app dependencies…” },
  "devDependencies": { "…Next app devDependencies…", "concurrently": "^10.0.5" }
}
```

The moved app's dependencies/devDependencies move into the root `package.json` (no separate app package). Root `package-lock.json` is the only lockfile.

`.env.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
The three old `VITE_*` values move into `.env.local` (values, not names). Root `.env.local`/`.env.example` frontend entries are removed.

`server/.env.example`: `CORS_ORIGIN=http://localhost:3000,http://localhost:5173` (keep 5173 until Task 25). Default fallback in `server/src/app.js` changes to `http://localhost:3000`.

Ports: web `3000`, api `4000`.

---

## §5 Routing

### §5.1 New route inventory (from moved app, unchanged unless stated)

Public: `/`, `/jobs`, `/jobs/[id]`, `/login`, `/signup`, `/signup/[role]`, `/[slug]` (about, how-it-works, peso-services, contact, faq, privacy, terms), **new** `/forgot-password`, `/reset-password`, `/auth/callback`, `/accept-invite`.

Jobseeker (`app/(portals)/jobseeker/*`): `dashboard`, `profile`, `recommended`, `saved`, `applications`, `applications/[id]`, `employment-tracking`, **added sections** `notifications`, `settings` (nav already lists both; the `[section]` switch must render them).

Employer: `dashboard`, `accreditation`, `profile`, `jobs`, `jobs/new`, `jobs/[id]/edit`, `applicants`, `applicants/[id]`, `employees-tracking`, `notifications`, `settings`.

Admin: `[section]` = `dashboard`, `profile`, `accreditation`, `users`, `role-management`, `employment-tracking`, `jobs`, `applications`, `reports`, `announcements`, `audit`, `notifications`, `settings`.

### §5.2 Old → new screen parity ledger

| Old screen (functional) | New screen | Primary API |
|---|---|---|
| Landing | `/` | GET `/jobs?pageSize=6` for featured (optional) |
| Public jobs / detail | `/jobs`, `/jobs/[id]` | GET `/jobs`, GET `/jobs/:id` |
| Portal select | `/` (delete screen) | — |
| Login (3 portals) | `/login` (role auto-redirect) | Supabase + GET `/auth/me` |
| Register chooser / seeker / employer | `/signup`, `/signup/jobseeker`, `/signup/employer` | Supabase signUp + POST `/auth/provision` |
| Forgot / reset password | `/forgot-password`, `/reset-password` | Supabase |
| Email confirm | `/auth/callback` | Supabase + POST `/auth/provision` |
| Admin invite accept | `/accept-invite` | Supabase + GET `/auth/me` + POST `/auth/provision` |
| Seeker dashboard | `/jobseeker/dashboard` | GET `/applications/mine`, GET `/jobs` |
| Seeker browse jobs (+AI match button becomes help chat) | `/jobseeker/recommended` | GET `/jobs`, POST `/ai/help` |
| Seeker job detail/apply | `/jobs/[id]` (inside portal shell when signed in) | GET `/jobs/:id`, GET `/files/resumes/mine`, POST `/applications` |
| Seeker applications | `/jobseeker/applications`, `/[id]` | GET `/applications/mine` |
| Seeker employment | `/jobseeker/employment-tracking` | GET `/seekers/me/employment`, POST `/seekers/me/employment/:id/corrections` |
| Seeker profile/resumes/education/experience | `/jobseeker/profile` | GET/PATCH `/seekers/me`, `/seekers/me/education|experience`, `/files/resumes*` |
| Seeker notifications | `/jobseeker/notifications` | GET `/notifications/mine`, POST read/read-all, DELETE |
| Seeker account settings | `/jobseeker/settings` | Supabase password change |
| Employer dashboard | `/employer/dashboard` | GET `/applications/employers/me/dashboard`, GET `/employers/me` |
| Employer job posts CRUD | `/employer/jobs`, `new`, `[id]/edit` | GET `/employers/:id/jobs`, POST/PATCH `/jobs`, POST `/jobs/:id/status|duplicate`, DELETE `/jobs/:id` |
| Employer applicants | `/employer/applicants`, `/[id]` | GET `/applications/company/:id`, POST `/applications/:id/status` |
| Employer employees | `/employer/employees-tracking` | GET `/applications/company/:id` (Accepted/Terminated) |
| Employer company profile | `/employer/profile` | GET/PATCH `/employers/me` |
| Employer accreditation + documents | `/employer/accreditation` | `/accreditations*`, `/documents*`, `/files/documents`, `/files/:bucket/*` |
| Employer status page | `/employer/accreditation` (banner + timeline) | GET `/employers/me`, `/accreditations/company/:id` |
| Employer notifications | `/employer/notifications` | notifications API |
| Admin dashboard | `/admin/dashboard` | GET `/admin/stats` |
| Admin accreditation review + docs | `/admin/accreditation` | GET `/admin/accreditations`, PATCH `/accreditations/:id`, `/documents/:id` |
| Admin job moderation | `/admin/jobs` | GET `/admin/jobs`, PATCH `/admin/jobs/:id`, POST `/admin/jobs/:id/publish|unpublish` |
| Admin users + invite | `/admin/users` | `/admin/users*`, `/admin/permissions`, `/admin/roles` |
| Admin roles (system + custom) | `/admin/role-management` | GET `/admin/permissions`, CRUD `/admin/roles*`, POST `/admin/users/:id/custom-role` |
| Admin employment oversight + corrections | `/admin/employment-tracking` | GET `/admin/employees`, GET/PATCH `/admin/employment-corrections` |
| Admin applications monitoring | `/admin/applications` | GET `/admin/applications` |
| Admin reports + CSV | `/admin/reports` | GET `/admin/jobs`, `/admin/applications`, `/admin/users`; client CSV |
| Admin broadcast | `/admin/announcements` | announcements CRUD (publishes fan out) |
| Admin audit logs | `/admin/audit` | GET `/admin/audit-logs` |
| Admin settings | `/admin/settings` | `/admin/reference/:category` |
| Admin profile | `/admin/profile` | PATCH `/admin/users/:id` (self name only) |
| Admin notifications | `/admin/notifications` | notifications API |
| Shared notification bell | `PortalShell` header | notifications API (SWR key `['notifications']`) |
| AI help chat (old: seeker global) | floating button in jobseeker shell | POST `/ai/help` |
| AFK auto-logout | `PortalShell` | Supabase signOut + POST `/audit` |

### §5.3 Redirects (`next.config.mjs`)

```js
async redirects() {
  return [
    { source: '/portals', destination: '/', permanent: true },
    { source: '/register', destination: '/signup', permanent: true },
    { source: '/register/job-seeker', destination: '/signup/jobseeker', permanent: true },
    { source: '/register/employer', destination: '/signup/employer', permanent: true },
    { source: '/register/employer/status', destination: '/employer/accreditation', permanent: true },
    { source: '/super-admin/login', destination: '/login', permanent: false },
    { source: '/employer/login', destination: '/login', permanent: false },
    { source: '/job-seeker/login', destination: '/login', permanent: false },
    { source: '/super-admin', destination: '/admin/dashboard', permanent: true },
    { source: '/super-admin/:path*', destination: '/admin/:path*', permanent: true },
    { source: '/job-seeker', destination: '/jobseeker/dashboard', permanent: true },
    { source: '/job-seeker/jobs', destination: '/jobseeker/recommended', permanent: true },
    { source: '/job-seeker/jobs/:id', destination: '/jobs/:id', permanent: true },
    { source: '/job-seeker/:path*', destination: '/jobseeker/:path*', permanent: true },
    { source: '/employer/status', destination: '/employer/accreditation', permanent: true },
  ]
}
```

Remove `job-posts → vacancies` naming mismatch by keeping the new app's `/admin/jobs` (ledger already maps old `/super-admin/job-posts` through `/super-admin/:path*`; add explicit `{ source: '/super-admin/job-posts', destination: '/admin/jobs', permanent: true }` because the section slug differs).

Public logout policy stays (ADR-021): `PublicShell` signs out any active session on public pages (port from old `PublicRoute`), except `/jobs/[id]` while signed in? **No — keep exactly**: old app did not exclude it. E2E pins this behavior.

---

## §6 API Contracts

### §6.1 Reused endpoints (no change)

`GET /api/health`, `/api/auth/me|provision|audit`, `/api/jobs*`, `/api/employers/:id/jobs`, `/api/applications*`, `/api/employers/me`, `/api/seekers/me*`, `/api/accreditations*`, `/api/documents*`, `/api/files/*`, `/api/admin/*` (except permission gate), `/api/notifications*`, `/api/admin/reports/*`, `/api/ai/help`. See `server/src/routes/` for exact shapes; the web mapper layer consumes them as-is.

### §6.2 New: Saved jobs (`server/src/routes/saved-jobs.js`, mounted in `app.js`)

`GET /api/seekers/me/saved-jobs` — auth + job-seeker
```json
{ "data": [ { "id": "uuid", "job_id": "uuid", "created_at": "2026-11-03T…", "job": { "id": "uuid", "title": "…", "status": "published", "employers": { "id": "uuid", "company_name": "…" } } } ] }
```
`POST /api/seekers/me/saved-jobs` — body `{ "job_id": "uuid" }` → `201 { "saved": true }`; duplicate is idempotent `200`.
`DELETE /api/seekers/me/saved-jobs/:jobId` → `{ "deleted": true }` (own rows only; 404 otherwise).

Errors: `400 BAD_REQUEST` invalid uuid / job not visible, `403 FORBIDDEN` not seeker, `404 NOT_FOUND`.

### §6.3 New: Announcements (`server/src/routes/announcements.js`)

`GET /api/announcements` — any authed user, published only, newest first:
```json
{ "data": [ { "id": "uuid", "title": "…", "body": "…", "category": "General", "status": "published", "published_at": "…", "created_at": "…", "author_name": "…" } ] }
```
`GET /api/admin/announcements` — permission `announcements` → all rows, same shape.
`POST /api/admin/announcements` — `{ "title": "…", "body": "…", "category": "General", "publish": true }` → `201` row. `publish:true` sets `status='published'`, `published_at=now()`, and fans out one notification per active user (type `announcement`, link `/jobseeker/…` resolved client-side).
`PATCH /api/admin/announcements/:id` — `{ title?, body?, category?, status? }` → row; draft→published fans out exactly once (`published_at is null` guard).
`DELETE /api/admin/announcements/:id` → `{ "deleted": true }`.

### §6.4 New: Employment corrections (`server/src/routes/corrections.js`)

`POST /api/seekers/me/employment/:employmentId/corrections` — job-seeker, body `{ "message": "…" }` (1–1000 chars) → `201` row. Verifies employment row belongs to caller.
`GET /api/seekers/me/corrections` → `{ "data": [ { "id", "employment_id", "message", "status", "resolution", "created_at", "reviewed_at", "employment": { "employer_name", "position" } } ] }`
`GET /api/admin/employment-corrections?status=Pending|Reviewed` — permission `employees` → rows + seeker embed (`full_name,email`).
`PATCH /api/admin/employment-corrections/:id` — `{ "status": "Reviewed", "resolution": "…" }` → row + notify seeker.

### §6.5 Changed: Applications cover letter

`POST /api/applications` accepts optional `cover_letter` (string ≤3000); returns it; `GET /api/applications/mine` and `/company/:companyId` include `cover_letter`. `web` mapper exposes `coverLetter`.

### §6.6 Changed: Auth profile + permissions

`GET /api/auth/me` adds, for super-admins:
```json
{ "role": "super-admin", "custom_role": { "id": 7, "name": "PESO Staff", "permissions": ["jobs", "employees"] } }
```
`custom_role` is `null` when unassigned. All other fields unchanged.

### §6.7 Permission gate

Permission tokens: `jobs`, `employees`, `accreditation`, `reports`, `roles`, `announcements`, `audit` (add the last two to web `Permission` type and defaults).
Route → token: `admin/jobs*`→`jobs`; `admin/employees`, `admin/employment-corrections`, `admin/referrals`→`employees`; `admin/accreditations`, `PATCH /accreditations/:id`, `PATCH /documents/:id`→`accreditation`; `admin/reports/*`→`reports`; `admin/users*`, `admin/roles*`, `admin/permissions`→`roles`; `admin/announcements*`, `admin/system-notifications`→`announcements`; `admin/audit-logs`→`audit`; `admin/stats`→none (any active admin). `403 { error: { code: "FORBIDDEN", message: "Missing permission: <token>" } }`.

---

## §7 Database Schema & Migration Plan

### §7.1 `db/migrations/010_frontend_migration.sql`

```sql
begin;

create table if not exists public.saved_jobs (
  id         bigint generated always as identity primary key,
  seeker_id  uuid not null references public.job_seekers(id) on delete cascade,
  job_id     uuid not null references public.job_vacancies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (seeker_id, job_id)
);
create index if not exists saved_jobs_seeker_idx on public.saved_jobs(seeker_id);

create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  category     text not null default 'General',
  status       text not null default 'draft' check (status in ('draft','published')),
  author_id    uuid,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists announcements_status_idx on public.announcements(status, published_at desc);

create table if not exists public.employment_corrections (
  id            uuid primary key default gen_random_uuid(),
  employment_id uuid not null references public.employment_history(id) on delete cascade,
  seeker_id     uuid not null references public.job_seekers(id) on delete cascade,
  message       text not null,
  status        text not null default 'Pending' check (status in ('Pending','Reviewed')),
  resolution    text,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists employment_corrections_seeker_idx on public.employment_corrections(seeker_id);
create index if not exists employment_corrections_status_idx on public.employment_corrections(status);

alter table public.job_applications add column if not exists cover_letter text;

commit;
```

### §7.2 Mirror into `db/schema.sql`

Add the three tables next to their domains (saved jobs after `resumes`; announcements + corrections after `notifications`), with the same `if not exists` style; include `cover_letter text` in the `create table job_applications` body **and** keep the `alter table … add column if not exists` line for existing databases.

### §7.3 Apply + verify

```sh
psql -U postgres -h localhost -d joblinked -f db/migrations/010_frontend_migration.sql
psql -U postgres -h localhost -d joblinked -f db/schema.sql   # idempotent
psql -U postgres -h localhost -d joblinked -c "\d public.saved_jobs" -c "\d public.announcements" -c "\d public.employment_corrections" -c "\d public.job_applications"
```
Acceptance: all three tables exist with indexes; second `schema.sql` run is a no-op; no dropped existing column.

---

## §8 State Management & Mapping

### §8.1 Layer responsibilities

| Layer | Owns |
|---|---|
| `lib/supabase.ts` | browser auth client (in-memory session) |
| `services/api/client.ts` | base URL, auth header, query building, 204, JSON/FormData, 401 policy, blob downloads |
| `services/*.ts` | endpoint paths + request/response types (one module per domain) |
| `services/mappers.ts` | snake_case → camelCase domain types, enum translation, null/default normalization |
| `hooks/use-auth.tsx` | session listener, profile load (GET `/auth/me`), role mapping, `logout`, `refreshUser`, `customRole`/permissions |
| `hooks/queries.ts` | SWR keys + fetchers + `mutate` helpers |
| `hooks/use-action.ts` | pending flag + success/error toast |
| components | no `fetch`, no path strings, no enum logic |

SWR keys (exact strings): `['me']`, `['jobs', filters]`, `['job', id]`, `['saved-jobs']`, `['applications','mine']`, `['applications','company',companyId]`, `['applications','dashboard']`, `['notifications']`, `['employment']`, `['corrections']`, `['employer','me']`, `['employer','jobs',filters]`, `['accreditations',companyId]`, `['documents',companyId]`, `['admin','stats']`, `['admin','users',filters]`, `['admin','jobs',filters]`, `['admin','applications',filters]`, `['admin','accreditations',filters]`, `['admin','employees']`, `['admin','corrections',status]`, `['admin','audit',filters]`, `['admin','roles']`, `['admin','permissions']`, `['admin','reference',category]`, `['admin','announcements']`, `['announcements']`.

Mutation → invalidations: job write → `['jobs']`, `['employer','jobs']`, `['admin','jobs']`, `['job',id]`; application write → `['applications','mine'|'company'|'dashboard']`, `['admin','applications']`, `['notifications']`; accreditation/doc write → `['accreditations']`, `['documents']`, `['admin','accreditations']`, `['employer','me']`; profile write → `['me']` + relevant; saved job → `['saved-jobs']`; announcements publish → `['admin','announcements']`, `['announcements']`, `['notifications']`.

### §8.2 Enum translation tables (implement in `mappers.ts`, unit-tested exhaustively)

Job status (`job_vacancies.status` → UI `JobStatus`):
`draft→Draft`, `pending→Pending Approval`, `approved→Approved`, `rejected→Rejected`, `published→Published`, `closed→Closed`, `archived→Archived`. Extend `JobStatus` to `Draft|Pending Approval|Approved|Published|Closed|Archived|Rejected`. UI action → API: Publish→`/jobs/:id/status {status:'published'}`; Close→`{status:'closed'}`; Reopen→precheck deadline then `{status:'published'}`; Delete→`DELETE`; Duplicate→`/duplicate`; Admin flag→`PATCH /admin/jobs/:id {status:'rejected'}`; Admin remove→`{status:'archived'}`.

Application status (`job_applications.status` → UI `ApplicationStatus`):
`Applied→Submitted`, `Under Review→Under Review`, `Interview→Interview Scheduled`, `Accepted→Hired`, `Placed→Placed`, `Rejected→Rejected`, `Terminated→Terminated`. Extend UI union with `Placed|Terminated`. Remove `Shortlisted` everywhere. Employer action → API: Review→`Under Review`; Interview→`Interview` (+`interviewAt`); Hire→`Accepted`; Reject→`Rejected`; Terminate (employees view)→`Terminated`.

Accreditation status: `none→Not Submitted`, `pending→Pending Review`, `approved→Approved`, `rejected→Rejected`, `resubmission→Resubmission Requested`, `revoked→Revoked`.

Roles: API `super-admin→admin`, `job-seeker→jobseeker`, `employer→employer`; UI `staff` = `admin` + `custom_role != null`.

Other field maps: `company_id→employerId`, `company_name→name`, `employment_type→type`, `work_arrangement→arrangement`, `vacancies→openings`, `tags→skills`, `requirements→qualifications[]` (split on newline; inverse joins on write), `benefits→benefits[]` (newline split/join), `applied_at→submittedAt`, `resume.file_name→resumeName`, `employer_notes→notes`, `interview_at/interview_instructions→interview {date, location}`, `is_read→read`, `created_at→date/createdAt`, `barangay_district→barangay`, `full_name→name`, `description→description`, `salary_min/max` numeric strings → `number|null`.

Deadline: map with a date-only helper (`'YYYY-MM-DD'` stays a calendar date; never `new Date(iso)` for comparisons).

---

## §9 Testing Strategy & Gates

| Level | Tool | Scope |
|---|---|---|
| Backend routes | Vitest + supertest (existing harness `server/src/__tests__/helpers/app.js`) | one file per new/changed route group; permission matrix; ownership; fan-out counts |
| Client unit | Vitest + jsdom | `client.ts` (401/refresh/bounce, query, FormData, blob), `mappers.ts` (all enums + unknown fallback), `permissions.ts`, `use-auth` state machine |
| Component | Vitest + RTL | login form, apply dialog, job form validation, correction request form, permission-gated nav |
| End-to-end | Playwright (Chromium) | all routes load; portal flows; legacy redirects; uploads; permission gating; notifications fan-out |

Commands (gate order):
```sh
npm --prefix server test
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

**Repeat-until-green protocol:** run the full gate after every task; a failing gate blocks the next task; fix root cause, re-run the failed command, then the full gate. An e2e failure is never "flaky" until the spec has run twice at `--workers=1`; only then may the spec be hardened (never deleted or skipped).

E2E prerequisites: seeded accounts (Task 24) `e2e.seeker@peso.test`, `e2e.employer@peso.test`, `e2e.admin@peso.test`, password `E2ePassw0rd!`; one approved employer, one pending employer, two published jobs, one application, one pending accreditation for the pending employer. Because the session is in-memory, each e2e test logs in through `/login` in its own context.

---

## §10 Task Plan

> Ordered; each task is independently reviewable and ends with the gate command(s) that prove it. Do not start a task before its "Consumes" interfaces exist.

### Task 1: Restructure repository, purge Vite, update docs/config

**Files:**
- Move: `new_frontend/Joblinked/*` → repository root (`app/`, `components/`, `constants/`, `hooks/`, `lib/`, `public/`, `services/`, `tests/`, `types/`, `components.json`, `next.config.mjs`, `postcss.config.mjs`, `tsconfig.json`) — no containing folder
- Delete: `src/`, `index.html`, `vite.config.js`, `dist/`, `eslint.config.js`, root `test_samples.mjs`, stale root `testout2.txt`/`lintout2.txt`/`commitout*.txt`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, root `vercel.json`
- Rewrite: root `package.json` (app package + orchestrator), `.env.example`, `AGENTS.md`
- Modify: `server/.env.example`, `server/src/app.js` (CORS default `http://localhost:3000`)
- Create: `docs/arch/adr-035-nextjs-frontend.md` … `adr-041-legacy-route-redirects.md`
- Create: root `eslint.config.mjs` (flat, `eslint-config-next/core-web-vitals`), `vitest.config.ts` + `tests/setup.ts` so `npm run lint` / `npm test` / `npm run typecheck` are green from day one; delete the dead `tests/tracking.test.ts` (node:test demo-store spec — its assertions move to the real-API tests in Task 24)

**Produces:** runnable Next app at the repo root; merged package/scripts; ADRs.

- [ ] Move the app contents to the repository root (strip its nested `.git`; no `web/` folder is created).
- [ ] Delete the Vite surface listed above.
- [ ] Merge the app's dependencies, devDependencies and Next scripts into the root `package.json` exactly as §4; one `package-lock.json` at root.
- [ ] Run `npm install` at root only; commit the single `package-lock.json`.
- [ ] Copy the three `VITE_*` secret values into root `.env.local` as `NEXT_PUBLIC_*`; write the new example file.
- [ ] Update `AGENTS.md` project-structure/build sections to describe the flat root layout + `server/` and the new commands.
- [ ] Write ADRs 035–041 (short: context, decision, consequences, alternatives).
- [ ] Verify: `npm run dev` starts both; `curl http://localhost:4000/api/health` → `{"ok":true,...}`; `http://localhost:3000/` renders the JobLinked home; `git grep -n "VITE_"` returns nothing; `npm run build` succeeds.
- [ ] Commit: `chore: replace Vite frontend with Next.js app at repository root`.

**Interfaces:** `@/*` alias → `./*` intact; `NEXT_PUBLIC_*` env names available to all later tasks.

---

### Task 2: Database migration 010 + schema mirror

**Files:** Create `db/migrations/010_frontend_migration.sql`; modify `db/schema.sql`.

- [ ] Write migration exactly per §7.1.
- [ ] Mirror into `schema.sql` per §7.2 (tables + `cover_letter` in create body + idempotent alter).
- [ ] Apply both via psql (§7.3) to a scratch database first, then dev database.
- [ ] Verify re-running `schema.sql` twice raises no error and preserves data (`select count(*) from job_applications`).
- [ ] Commit: `feat(db): schema for saved jobs, announcements, employment corrections, cover letter`.

---

### Task 3: Backend permission gate + auth profile custom role

**Files:** Modify `server/src/auth.js`, `server/src/routes/auth.js`, `server/src/routes/admin.js`, `server/src/app.js`; Create `server/src/routes/admin.permissions-db.test.js`.

**Produces:** `requirePermission(token)`; `/api/auth/me` → `custom_role`; admin routes gated.

- [ ] Write failing tests: super-admin without custom role passes `jobs` and `users`; admin with custom role `['jobs']` passes `GET /api/admin/jobs`, gets `403 FORBIDDEN / Missing permission: roles` on `GET /api/admin/users`; `/auth/me` returns `custom_role.permissions`; tables created with permission list.
- [ ] Implement `requirePermission(permission)` in `auth.js`:
  - role must be `super-admin` (else 403);
  - `roleFrom(req, id)` profile `custom_role_id` null → `next()`;
  - else `select details->'permissions' from reference_data where id=$1` (per-request memo), `permissions.includes(token)` → `next()` else 403.
- [ ] Replace `const admin = [auth, requireRole('super-admin')]` with per-group arrays `[auth, requireRole('super-admin'), requirePermission(token)]` per §6.7; keep `admin/stats` unpermissioned.
- [ ] Extend `GET /auth/me` (and the invite/provision response if it carries profile) with `custom_role` joined from `reference_data`.
- [ ] Run `npm --prefix server test`; all green.
- [ ] Commit: `feat(api): staff permissions via restricted custom roles`.

---

### Task 4: Saved jobs API

**Files:** Create `server/src/routes/saved-jobs.js`, `server/src/routes/saved-jobs.test.js`; modify `server/src/app.js`.

- [ ] Tests: seeker saves a published job (201), duplicate returns 200 and one row; list joins job+employer; delete removes; other user cannot delete (404); non-seeker 403; invalid uuid 400; deleted job cascade removes save.
- [ ] Implement routes per §6.2 with `auth`, `requireRole('job-seeker')`, `isUuid`, single insert `on conflict do nothing`.
- [ ] Mount router in `app.js` `/api` chain.
- [ ] Run `npm --prefix server test`; commit: `feat(api): saved jobs`.

---

### Task 5: Announcements API + publish fan-out

**Files:** Create `server/src/routes/announcements.js`, `.test.js`; modify `server/src/app.js`, `server/src/util.js` (add `notifyAllActiveUsers`).

- [ ] Tests: public list excludes drafts; admin CRUD with `announcements` permission; publish creates exactly one notification per active user (count before/after); re-publishing does not duplicate notifications; delete cascades nothing else.
- [ ] Implement routes per §6.3; fan-out inserts into `notifications` for the union of active ids from the three role tables (reuse the pattern in `admin/system-notifications`); `published_at` guard makes publishing idempotent.
- [ ] Run tests; commit: `feat(api): announcements with publish notification fan-out`.

---

### Task 6: Employment corrections API

**Files:** Create `server/src/routes/corrections.js`, `.test.js`; modify `server/src/app.js`.

- [ ] Tests: seeker requests correction on own employment row (201) and cannot on another seeker's (404/403); message >1000 chars → 400; seeker lists own; admin with `employees` permission lists and reviews; reviewing notifies the seeker; non-permitted admin 403.
- [ ] Implement per §6.4.
- [ ] Run tests; commit: `feat(api): employment correction requests`.

---

### Task 7: Applications cover letter + contract fixes

**Files:** Modify `server/src/routes/applications.js`, `server/src/routes/applications.*.test.js` (add cases).

- [ ] Failing test: `POST /api/applications` with `cover_letter` stores and returns it; >3000 chars → 400; `GET /mine` and `/company/:id` include it.
- [ ] Implement allowlist/validation + select columns.
- [ ] Run tests; commit: `feat(api): store application cover letter`.

---

### Task 8: Web foundations — auth client, REST client, mappers, provider

**Files:**
- Create: `lib/supabase.ts`, `services/api/client.ts`, `services/mappers.ts`, `services/auth.ts`, `hooks/use-auth.tsx`, `services/api/client.test.ts`, `services/mappers.test.ts`, `hooks/use-auth.test.tsx`, `vitest.config.ts`, `vitest.setup.ts`
- Modify: `components/providers.tsx`, `types/index.ts`
- Delete: `services/api/http.ts`, `services/api/contracts.ts`, `services/mock/**`, `hooks/use-demo.ts`

**Produces (exact signatures later tasks consume):**
```ts
// services/api/client.ts
export class ApiError extends Error { readonly status: number; readonly code?: string }
export const api: {
  get<T>(path: string, params?: Record<string, unknown>): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  del<T>(path: string): Promise<T>
  blob(path: string): Promise<Blob>
}
// mappers.ts
toRole(apiRole): Role; toUser; toSeeker; toEmployer; toJob; toApplication; toAccreditation;
toNotification; toEmployment; toCorrection; toAnnouncement; toAuditLog; toAdminUser;
toJobStatus; toApplicationStatus; toAccreditationStatus; toPermission
// hooks/use-auth.tsx
useAuth(): { user: User|null; role: Role|null; customRole: {id,name,permissions}|null;
            loading: boolean; login(email,password): Promise<User>; logout(): Promise<void>;
            refreshUser(): Promise<void>; provision(metadata): Promise<User>; can(permission): boolean }
```

- [ ] Write `client.test.ts` first: auth header from mocked supabase session; query omits `undefined/null/''`; FormData not JSON-stringified; 204→null; `{error:{message}}` → `ApiError` with status/code; 401 → one refresh + retry; second 401 → signOut + `location.assign('/login?next=…')`. Run → fail.
- [ ] Implement `client.ts` mirroring old `src/shared/lib/api.js` semantics (§4 constraints), base URL from `NEXT_PUBLIC_API_URL` (dev fallback `http://localhost:4000`, prod throw).
- [ ] Write `mappers.test.ts` covering every row of §8.2, unknown status fallback, deadline date-only, numeric salary. Run → fail; implement `mappers.ts`.
- [ ] Write `use-auth.test.tsx`: initial session null → loading false no user; session → GET `/auth/me` → user+role; SIGNED_IN re-emit for same id does not refetch; profile fetch failure keeps prior user; logout clears. Run → fail; implement `use-auth.tsx` + `services/auth.ts` (signIn, signUp, signOut, reset, changePassword, provision, getProfile, audit), mapping `custom_role`→`customRole` and role `super-admin→admin`.
- [ ] Mount `<AuthProvider>` inside `providers.tsx` (wrapper order: SWRConfig → AuthProvider → Tooltip → Toaster).
- [ ] Extend `types/index.ts` per §8.2 (`JobStatus`, `ApplicationStatus`, `AccreditationStatus`, `Permission` + `announcements|audit`, `JobApplication.coverLetter`, `User.customRole`).
- [ ] Delete the demo layer and `use-demo`; fix compile errors by temporarily stubbing nothing — components will be wired in later tasks, so keep imports compiling by replacing `useDemo` consumers in the same task? **No:** this task ends with the app still compiling. Replace each `useDemo()/useAction()` consumer with temporary local `const { user, api: noop } = …` is wrong. Instead, delete demo consumers in Tasks 10–22; here, keep `use-demo.ts` compiling against mappers? Simplest correct boundary: this task deletes only `services/mock` after Tasks 10–22 are done. Amend: **delete demo files in Task 23 (last wiring task)**, here only add new files and `git grep` the removal checklist. (Recorded so executors do not break the build mid-migration.)
- [ ] Run `npm --prefix web run typecheck && npm --prefix web test` → green (demo layer still present, unused by new code).
- [ ] Commit: `feat(web): supabase auth, REST client, mappers, auth provider`.

---

### Task 9: Portal shells — real gating, AFK, notification bell, route redirects

**Files:** Modify `components/layout/portal-shell.tsx`, `components/layout/public-shell.tsx`, `app/layout.tsx`; create `components/layout/notification-bell.tsx`, `hooks/use-afk-timer.ts`, `lib/route-guard.ts`; modify `next.config.mjs`.

**Consumes:** `useAuth`, `api`, SWR keys.

- [ ] Add redirect table from §5.3 and a Playwright redirect spec skeleton (Task 24 completes it).
- [ ] Implement `use-afk-timer.ts` (port semantics: 4-min warning, 5-min signOut; activity listeners; disabled on auth pages) with unit test using fake timers.
- [ ] `PortalShell`: replace demo gate:
  - `loading` → skeleton; no user → `router.replace('/login?next=' + pathname)`;
  - wrong portal role → destroy session then `/login` (ADR-021 parity);
  - staff section check via `canOpenSection(customRolePermissions, section)` → "no access" panel;
  - add notification bell (unread badge, mark read/all, delete) using `['notifications']`;
  - mount AFK timer; remove `DemoSwitcher` usage and the `DemoSwitcher` component file.
- [ ] `PublicShell`: sign out any active session on public routes (port `PublicRoute`), keep skip-link/footer.
- [ ] Unit tests: guard function (4 cases), AFK hook; run green; commit: `feat(web): authenticated portal shells with AFK and notifications`.

---

### Task 10: Auth pages — login, signup, callback, invite, password recovery

**Files:** Replace demo logic in `components/forms/auth-pages.tsx`; modify `components/forms/registration-form.tsx` + steps; create `components/forms/resume-autofill.ts` usage is kept; create `app/(public)/auth/callback/page.tsx`, `app/(public)/accept-invite/page.tsx`, `app/(public)/forgot-password/page.tsx`, `app/(public)/reset-password/page.tsx`; remove those slugs from `components/public/info-pages.tsx`.

- [ ] Login: email/password → `useAuth().login` → `router.replace(next || portalHome(role))`; wrong-role `?portal=` handling matches old behavior (session destroyed, message shown); surface suspended/unprovisioned errors.
- [ ] Signup jobseeker/employer: keep multi-step + zod + resume autofill; on submit call `supabase.auth.signUp` with the same metadata keys the backend `POST /auth/provision` expects (read `server/src/routes/auth.js` allowlist — do not invent names); `emailRedirectTo = ${origin}/auth/callback`; employer success → `/employer/accreditation`, seeker → `/jobseeker/dashboard`; no-session case → "check your email" panel.
- [ ] Callback page: read session, `POST /auth/provision` if `GET /auth/me` 404s, then role redirect; error panel for expired links.
- [ ] Invite page: session → set password (`supabase.auth.updateUser`) → provision if needed → `/admin/dashboard`.
- [ ] Forgot/reset: `resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`; reset page `updateUser({password})` then `/login`.
- [ ] Unit tests: login redirect per role, suspended message, wrong-role message; reset form validation. Run green.
- [ ] Commit: `feat(web): Supabase auth screens and recovery flows`.

---

### Task 11: Public site — jobs browser/detail + apply entry

**Files:** `components/jobs/job-browser.tsx`, `job-details.tsx`, `application-modal.tsx`, `job-card.tsx`; `app/(public)/jobs/**`; `services/jobs.ts`; `hooks/queries.ts`.

**Produces:** `services/jobs.ts`: `listJobs(filters)`, `getJob(id)`, `createJob`, `updateJob`, `changeJobStatus`, `duplicateJob`, `deleteJob`, `listEmployerJobs(companyId, params)`, `listSavedJobs`, `saveJob`, `unsaveJob`; hooks `useJobs(filters)`, `useJob(id)`, `useSavedJobs()`.

- [ ] Map filters to API params (`search, location, employmentType, workArrangement, employer, salaryMin, skills, order, page, pageSize`); URL search params stay the source for `/jobs`.
- [ ] Job detail renders mapped job (description/qualifications/benefits/skills/deadline badge); guest "Apply" → `/login?next=/jobs/:id`; signed-in seeker → application modal.
- [ ] Application modal: resume picker from `GET /files/resumes/mine` (upload shortcut → Task 14 endpoint), cover letter ≤3000 with counter, submit `POST /applications`; 409 duplicate → "already applied" state; deadline/status guard hides the action.
- [ ] Unit test: filter serialization + mapper fields; e2e covered in Task 24.
- [ ] Commit: `feat(web): public job browsing and application entry`.

---

### Task 12: Jobseeker — dashboard, opportunities, saved jobs

**Files:** `components/jobseeker/dashboard.tsx`, `opportunities.tsx`, `resumes.tsx` (list only here), `app/(portals)/jobseeker/[section]/page.tsx` (wire `recommended`, `saved`).

- [ ] Dashboard: profile completion from real seeker fields; application counts by mapped status; recommended jobs = `GET /jobs` scored client-side by skills/preferred position/barangay (port old `scoreJob` logic); no mock data.
- [ ] Opportunities: browse (reuse public filters) + saved tab (`GET /seekers/me/saved-jobs`), save/unsave toggles calling new endpoints, optimistic `mutate(['saved-jobs'])`.
- [ ] Commit: `feat(web): jobseeker dashboard, opportunities, saved jobs`.

---

### Task 13: Jobseeker — applications list/detail

**Files:** `components/jobseeker/applications.tsx`, `app/(portals)/jobseeker/applications/[id]/page.tsx`.

- [ ] List `GET /applications/mine`: job embed, status badge (mapped), applied date, deadline; empty state.
- [ ] Detail: application fields + `history` timeline (from embed), interview details, cover letter, resume name; no withdraw button (constant in plan).
- [ ] Unit test: status/timeline mapping; commit: `feat(web): jobseeker applications with real timeline`.

---

### Task 14: Jobseeker — profile, resumes, education/experience, password

**Files:** `components/jobseeker/profile.tsx`, `resumes.tsx`, `components/dashboard/account-settings.tsx`, `services/seekers.ts`, `services/documents.ts`.

**Produces:** `services/seekers.ts`: `getSeeker`, `updateSeeker`, `listEducation/experience`, `addEducation/experience`, `removeEducation/experience`, `getEmployment`, `requestCorrection`, `listCorrections`; `services/documents.ts`: `listResumes`, `uploadResume`, `activateResume`, `deleteResume`, `listDocuments(companyId)`, `uploadDocument`, `getFileBlob(bucket, path)`, `savedBlobUrl`.

- [ ] Profile form bound to `GET/PATCH /seekers/me` (allowlist fields only; skills tag input; barangay list from constants); save → `refreshUser`.
- [ ] Resumes: upload with `FormData` (`file`), 5 MB / PDF 2 MB pre-check mirrored client-side, activate, delete, preview via authenticated blob → `URL.createObjectURL` + revoke on unmount (R4).
- [ ] Education/experience CRUD against `/seekers/me/education|experience`; validation mirrors DB checks (year order, date order).
- [ ] Account settings: change password (verify current via `signInWithPassword`, then `updateUser`), remove demo notification-preference toggles.
- [ ] Unit tests: upload size/type guard, blob URL revoke, education form validation; commit: `feat(web): seeker profile, resume and credential management`.

---

### Task 15: Jobseeker — employment tracking, corrections, notifications, help chat

**Files:** `components/tracking/employment-tracking.tsx` (jobseeker mode), `components/jobseeker/…`; create `components/help-chat.tsx`; wire `app/(portals)/jobseeker/[section]/page.tsx` for `employment-tracking`, `notifications`, `settings`; `services/ai.ts`, `services/notifications.ts`.

- [ ] Employment list from `GET /seekers/me/employment` (trigger-written): employer, position, start/end, current badge.
- [ ] Correction request dialog → `POST /seekers/me/employment/:id/corrections`; list own requests with status/resolution.
- [ ] Notifications section: list/mark read/read-all/delete via `/notifications/*`; `mutate(['notifications'])`.
- [ ] Help chat: floating launcher in jobseeker portal; `POST /ai/help` with last 10 turns; loading/error states; rate-limit 429 message.
- [ ] Unit tests: correction form validation, chat message trimming, notification mutations; commit: `feat(web): seeker employment tracking, corrections, notifications, AI help`.

---

### Task 16: Employer — dashboard, job management, job form

**Files:** `components/employer/dashboard.tsx`, `job-management.tsx`, `job-form.tsx`; `app/(portals)/employer/jobs/**`; `services/employers.ts`; `services/jobs.ts` (employer ops).

- [ ] Dashboard: `GET /applications/employers/me/dashboard` (stats + recent), `GET /employers/me` company card + accreditation status banner.
- [ ] Job list: `GET /employers/:companyId/jobs` with status filter/page; actions publish/close/reopen/duplicate/delete; publish disabled with reason when accreditation ≠ approved; expired deadline must be fixed before reopen (client pre-check + server 403/400 message).
- [ ] Job form (RHF+zod): create/edit mapped fields; qualifications/responsibilities → `requirements` text, benefits list → text, skills → `tags`; salary validation (`min ≤ max`); deadline required; success → `mutate(['employer','jobs'])`.
- [ ] Unit tests: create payload mapping, publish gate, expired-deadline guard; commit: `feat(web): employer job management on real API`.

---

### Task 17: Employer — applicants and status workflow

**Files:** `components/employer/applicants.tsx`, `app/(portals)/employer/applicants/[id]/page.tsx`, `services/applications.ts`.

- [ ] List `GET /applications/company/:companyId` (embed seeker/job), filters by job/status.
- [ ] Detail: seeker profile card, resume preview (authenticated blob), application timeline; actions Review/Interview/Hire/Reject via `POST /applications/:id/status` with remarks, interview date+instructions; employer note via the same endpoint (`employerNotes`).
- [ ] Hide `Shortlisted`; statuses per §8.2; confirm dialog for destructive transitions.
- [ ] Unit test: action→payload mapping, timeline rendering; commit: `feat(web): employer applicant workflow`.

---

### Task 18: Employer — accreditation, company profile, employees tracking, notifications

**Files:** `components/employer/accreditation.tsx`, `company-profile.tsx`, `components/tracking/employment-tracking.tsx` (employer mode), `components/dashboard/notifications-page.tsx` usage; `app/(portals)/employer/[section]/page.tsx` wiring.

- [ ] Accreditation: submit/re-submit with `POST /accreditations` + document upload (`POST /files/documents` with `doc_type` from constants), timeline/history from `GET /accreditations/company/:id`, document statuses and previews; pending banner replaces the old dedicated status page.
- [ ] Company profile: `GET/PATCH /employers/me` allowlist; barangay/address; website/description.
- [ ] Employees: accepted/terminated applications from company list, employment records via `GET /applications/seekers/:id/employment` (linked-employer access), detail card.
- [ ] Notifications section wired to API.
- [ ] Unit tests: doc-type upload validation, profile payload allowlist; commit: `feat(web): employer accreditation, profile, employee tracking`.

---

### Task 19: Admin — dashboard, accreditation review, job moderation

**Files:** `components/admin/dashboard.tsx`, `accreditation.tsx`, `vacancies.tsx`, `components/dashboard/document-preview.tsx`; `services/admin.ts`; `app/(portals)/admin/[section]/page.tsx`.

**Produces:** `services/admin.ts`: `getStats`, `listUsers`, `patchUser`, `inviteUser`, `setUserRole`, `setCustomRole`, `listCompanies`, `listAdminJobs`, `patchAdminJob`, `publishJob`, `unpublishJob`, `listAdminApplications`, `listEmployees`, `listAdminAccreditations`, `getAuditLogs`, `listReference`, `createReference`, `deleteReference`, `listPermissions`, `listRoles`, `createRole`, `patchRole`, `deleteRole`, `sendSystemNotification`.

- [ ] Dashboard stats cards from `/admin/stats`; recent accreditations list.
- [ ] Accreditation review: table + filters, document drill-down/preview, approve/reject/revoke/request-resubmission with remarks (`PATCH /accreditations/:id`), document verify (`PATCH /documents/:id`).
- [ ] Jobs: `GET /admin/jobs` filters, edit drawer (`PATCH /admin/jobs/:id`), publish/unpublish endpoints, status labels per §8.2 (flag→rejected, remove→archived).
- [ ] Commit: `feat(web): admin dashboard, accreditation review, vacancy moderation`.

---

### Task 20: Admin — users, custom roles, staff permissions

**Files:** `components/admin/users.tsx`, `role-management.tsx`, `lib/permissions.ts`, `app/(portals)/admin/[section]/page.tsx`.

- [ ] Users: list with role/search/status filters + pagination; edit (name/phone/status), suspend/activate, role change (`POST /admin/users/:id/role`), invite modal (`POST /admin/users/invite`), custom role assignment (`POST /admin/users/:id/custom-role`).
- [ ] Role management: system roles from `GET /admin/permissions` (read-only), custom roles CRUD with permission checkboxes using the canonical token list (`browse, apply, jobs, employees, accreditation, reports, roles, announcements, audit`), base role selector.
- [ ] Staff behavior: admin with custom role shows "staff" label; `canOpenSection` consumes `customRole.permissions` from `/auth/me`; section blocked message for missing tokens; nav items hidden/disabled consistently.
- [ ] Unit tests: `canOpenSection` matrix (all tokens × sections), last-admin self-guard; commit: `feat(web): admin users, custom roles and staff permissions`.

---

### Task 21: Admin — applications monitoring, reports + CSV

**Files:** `components/admin/monitoring.tsx`, `reports.tsx`, `lib/format.ts` (existing CSV helper), `services/admin.ts`.

- [ ] Monitoring: `GET /admin/applications` (status/search/pagination), seeker+j employer+job display, referral badge (read-only).
- [ ] Reports: date range validation (≤10 years, from ≤ to), aggregate client-side from `GET /admin/jobs` + `GET /admin/applications` + `GET /admin/users` (seekers) into the existing `Report` shape; barangay/monthly breakdowns; charts from recharts; CSV download via `format.downloadCsv` (includes formula-injection guard).
- [ ] Unit test: report aggregation from fixture pages, date validation, CSV escaping; commit: `feat(web): admin monitoring, reports and CSV export`.

---

### Task 22: Admin — announcements, audit log, employment oversight, settings, profile

**Files:** `components/admin/announcements.tsx`, `audit-log.tsx`, `tracking/employment-tracking.tsx` (admin mode), `components/forms`/settings section, profile; `services/announcements.ts`, `corrections.ts`.

- [ ] Announcements: list all (`GET /admin/announcements`), create/edit/delete, publish action (fan-out hint in copy); reuse old broadcast expectations (system notification remains available for non-article messages).
- [ ] Audit: `GET /admin/audit-logs` with user/action/date filters, detail drawer.
- [ ] Employment oversight: `GET /admin/employees` + correction queue `GET /admin/employment-corrections`, review dialog → `PATCH` with resolution.
- [ ] Settings: reference data categories (`employment_type`, `education_level`, system requirements/privacy/terms text rows) CRUD via `/admin/reference/*`; renders the strings used by public privacy/terms if present.
- [ ] Profile: edit own name only (`PATCH /admin/users/:id`, server blocks role/status self-edit); change password.
- [ ] Commit: `feat(web): admin announcements, audit, employment oversight, settings`.

---

### Task 23: Remove the demo layer + shared polish (typecheck hard gate)

**Files:** Delete `services/mock/**`, `hooks/use-demo.ts`, `components/layout/demo-switcher.tsx`, demo constants (`DEMO_ACCOUNTS`, `DEMO_PASSWORD`, `DEMO_QUERY_KEY`), any `useDemo` references; modify `constants/index.ts`, `lib/permissions.ts`, `components/layout/portal-shell.tsx`, `components/dashboard/account-settings.tsx`.

- [ ] `git grep -n "useDemo\|demoApi\|DemoSwitcher\|DEMO_"` → only docs/history references; remove each consumer.
- [ ] Remove demo-only UI copy ("demo account", "preview only", "backend not wired yet"), demo password hints, prefilled demo credentials.
- [ ] `npm --prefix web run typecheck` → zero errors; `npm --prefix web run lint` → zero errors.
- [ ] Commit: `refactor(web): remove mock data layer and demo surfaces`.

---

### Task 24: E2E harness + full verification loop

**Files:** Create `playwright.config.ts`, `e2e/helpers/auth.ts`, `e2e/{redirects,public,auth,jobseeker,employer,admin,gating}.spec.ts`, `server/scripts/seed-e2e.js`; modify `package.json` (`test:e2e`).

- [ ] Seed script (idempotent, service role): three confirmed users with `app_metadata.role`, role rows, approved employer (`employer_accreditations` approved + trigger sync), pending employer, two published jobs, one application, one pending accreditation, one custom role `['jobs','employees']` assigned to a fourth `e2e.staff@peso.test`.
- [ ] Playwright config: `webServer` = root `npm run dev` with `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SUPABASE_*` from env; `baseURL http://localhost:3000`; workers 1; global setup runs the seed script.
- [ ] `auth.ts` helper: UI login helper (`goto /login`, fill, submit) used per test; helper returns after portal dashboard visible.
- [ ] Specs (each assertion named):
  - `redirects`: every §5.3 source → final URL (14 cases).
  - `public`: `/`, announcement-free landing, `/jobs` filter applies, `/jobs/[id]`, info slugs, `/signup` role picker, forgot/reset pages render.
  - `auth`: login each role lands correct dashboard; suspended user message; login `?next` honored; logout clears session; hard reload signs out (ADR-036 pinned).
  - `gating`: seeker opening `/admin/dashboard` → `/login`; staff opening `/admin/users` → no-access panel, `/admin/jobs` → allowed.
  - `jobseeker`: dashboard counts; save/unsave job; apply (resume + cover letter) → appears in applications; profile save persists; resume upload+preview; correction request appears; help chat reply.
  - `employer`: dashboard; create→publish job (approved employer) and blocked publish (pending employer); edit; duplicate; delete; applicant status interview→hired; accreditation resubmit; company profile save.
  - `admin`: stats; approve accreditation (pending employer becomes approved); publish/unpublish job; user suspend+reactivate; assign custom role; announcement publish → seeker notification appears; audit log entry exists; reports CSV downloads.
- [ ] Run `npm run test:e2e` → green at `--workers=1` twice. Fix root causes; repeat until two consecutive clean runs.
- [ ] Commit: `test(web): end-to-end coverage of all portals and legacy routes`.

---

### Task 25: Documentation, cleanup, final gate

**Files:** Update `AGENTS.md`, `README.md`, `docs/arch/adr-*`, `.env.example`; delete `new_frontend/` (now fully verified); remove temporary root artifacts.

- [ ] Confirm `` has no reference to `new_frontend` or pnpm; delete the directory.
- [ ] Document: dev workflow, env vars (three `NEXT_PUBLIC_*` + `CORS_ORIGIN`), DB migration command, test commands, staff/custom-role model, ADR-036 session behavior.
- [ ] Full gate from a clean shell: `npm --prefix server test && npm run lint && npm run typecheck && npm test && npm run test:e2e`.
- [ ] Manual smoke: `npm run dev`, log in as all four accounts, reload behavior, files preview, CSV download.
- [ ] Commit: `docs: frontend migration runbook and cleanup`.

---

## §11 Cutover / Rollback

- **Cutover:** migration branch contains Tasks 1–25; deployment target is the repository root (Vercel project root = repo root) using `NEXT_PUBLIC_API_URL` pointing at the deployed API; API `CORS_ORIGIN` must list the deployed web origin. Keep 5173 in CORS until the new deploy is verified, then drop it.
- **Rollback:** the old frontend is recoverable from git (`src/` at the pre-migration commit). Database migration 010 is additive-only (three new tables + one nullable column); rollback SQL (not part of normal flow):
  ```sql
  drop table if exists public.employment_corrections;
  drop table if exists public.announcements;
  drop table if exists public.saved_jobs;
  alter table public.job_applications drop column if exists cover_letter;
  ```
- **Data safety:** no existing columns/tables are altered destructively; announcements `author_id` and corrections `reviewed_by` intentionally carry no FK (deleted users must not erase history).

---

## §12 Self-Review Coverage Check (performed while writing this plan)

| Requirement | Task(s) |
|---|---|
| Every old route reachable | 1 (redirects), 9, 24 (`redirects` spec) |
| Every old screen has a new home | §5.2 ledger → Tasks 10–22 |
| All six ported features | 9 (AFK, bell), 10 (reset/callback/invite), 15 (help chat) |
| Four schema features + cover letter | 2–7, 15, 18, 20, 22 |
| Auth + 401 policy | 8, 10, 24 |
| File uploads/previews | 14, 18, 24 (R4) |
| Staff permissions end-to-end | 3, 8, 20, 24 (`gating`) |
| Status enum drift | 8 (`mappers.test`), 24 |
| Legacy URLs | 9, 24 |
| Docs/ADR/config | 1, 25 |

No task leaves the app in a non-compiling state after Task 8 (demo layer is deleted only in Task 23, once every consumer is rewired).
