# Routing & Discoverability Plan (MemoryRouter → real URLs)

> **SUPERSEDED 2026-11-04 — DO NOT EXECUTE AS WRITTEN.** The product owner chose a
> frozen address bar with working Back/Forward in ADR-036
> (`docs/arch/adr-036-frozen-url-with-history.md`, Accepted 2026-11-04), which
> **supersedes ADR-035 (real URLs)**. That decision is already implemented:
> `src/shared/lib/StaticUrlRouter.jsx`, wired at `src/App.jsx:77`. Steps below that swap
> `MemoryRouter` → `BrowserRouter` (Task 1, step 3) must not run. Bookmarkable/shareable
> URLs and URL-dependent SEO need a new ADR first. The SEO-basics items are already
> shipped (`index.html` meta description + OG tags); re-verified in
> `docs/plan/2026-11-04-01-system-gap-analysis.md` rows G1 and G16. If you are asked to
> execute this plan, stop and take it to the Lead Architect for re-scope.

**For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
(after Lead Architect signs off; this plan starts with an ADR).

**Goal:** Make every URL real: bookmarkable, shareable, refreshable, back/forward
working, with basic SEO meta — for a PUBLIC jobs portal, an unshareable
`/jobs/:jobId` is a product-level defect.

**Tech stack:** unchanged (React Router 7, Vite, lazy route chunks).

## Scope

Frontend routing + page metadata only. No server changes, no route table changes,
no session-flow changes (ADR-021 portal-scoped sessions / PublicRoute behavior stays).

## Baseline (verified 2026-11-04)

- `src/App.jsx:63-68`: `MemoryRouter` seeded once from `window.location` — address
  bar frozen; the browser back button exits the app; links can't be shared.
- `vercel.json` already rewrites `/.* → /index.html`, so the server side is ready.
- Stale-chunk guard already in `src/shared/lib/routeLoaders.js:66-82`
  (sessionStorage flag + auto-reload) — must survive the swap.
- ~30 legacy aliases (`/jobseeker/*`, `/admin/*`) → canonical paths (App.jsx:80-130).
- `index.html` has no meta description / OG tags.
- `PublicRoute` destroys any session on arrival (ADR-021, App.jsx:204-217);
  `ProtectedRoute` logs out wrong-role visitors.

## Task order (small batches, each verifiable)

1. **Task 0 — due diligence before touching anything.** `git log --follow
   src/App.jsx` + read the commit that introduced `MemoryRouter`. If it was chosen
   for a real blocker (e.g. Vercel rewrite mishandling, stale chunks before the
   routeLoaders guard), STOP and report — the ADR must address that reason or no
   swap. Write findings into the ADR.
2. **ADR-035** (`docs/arch/adr-035-real-urls-browser-router.md`): decision + why
   + the stale-chunk guard must remain; sign-off gate.
3. Swap `MemoryRouter` → `BrowserRouter` in `src/App.jsx` (one-line diff if Task 0
   found no blocker). Keep `entryPath` logic only if the ADR justifies it.
4. Route sweep in dev: hard-load `/jobs`, `/jobs/:jobId`, `/login`,
   `/register/job-seeker`, each portal index + one sub-page per portal, `/privacy`,
   `/terms`, `/accept-invite`, `/auth/callback`, all 2–3 legacy alias forms.
   Acceptance: every listed path renders correct content on hard load; back/forward
   works inside portals; refresh in a portal keeps the session.
5. Auth interaction tests (update existing route tests if they assert MemoryRouter):
   - logged-out deep link to `/jobs/:jobId` → public detail renders (no login needed);
   - logged-out deep link to `/employer/job-posts` → login → correct portal;
   - wrong-role deep link to `/job-seeker` as employer → logout → `/login` (unchanged).
6. Metadata: add a tiny `usePageTitle` (or a single title-map keyed by pathname in
   `routeLoaders.js`) setting `document.title`; set static fallback titles per
   layout. Add `description`/`og:title`/`og:image` static tags to `index.html`.
7. Optional (cheap): per-job dynamic `document.title` on `PublicJobDetail` only —
   no server-side OG, no sitemap (skip; lg_SHARE links work once G1 is fixed).

## Failure modes to guard (Likeliest bite first)

1. **Deep link while logged out then login** — user must land in the right portal
   (current behavior: role default). Keep current behavior; do not silently change it.
2. **PublicRoute on hard load** destroys session — verify no /auth or /account route
   accidentally wrapped as public.
3. **Stale-chunk guard** — must still auto-reload on a deploy-mid-session; test by
   bumping a chunk hash.
4. **Aliases** — `/jobseeker/jobs` etc. must still land on the canonical portal page
   (they're real `<Route>` aliases, not redirects — verify they still match).
5. **Tests** — jsdom route tests using MemoryRouter as the test harness remain valid;
   only tests asserting frozen-URL behavior change (there should be none).

## Acceptance

- Dev-server + `vite preview` sweep: every route hard-loadable and shareable.
- `npm test` green (route tests updated first), `npm run lint` clean, `npm run build` fine.
- `index.html` carries description + OG tags; `/jobs/:jobId` sets its own title.
