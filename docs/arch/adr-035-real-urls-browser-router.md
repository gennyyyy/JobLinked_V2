# ADR-035 — Real URLs: BrowserRouter replaces the frozen-address MemoryRouter

**Status:** Superseded 2026-11-04 — product owner directed the frozen address bar
(no URL changes during in-app navigation). `App.jsx` uses `MemoryRouter` seeded
from the entry URL again; the `lazyRoute` chunk guard and `usePageTitle` stay.
This ADR's rationale still stands for a public, shareable job board, so reopen it
deliberately if shareable `/jobs/:jobId` links become a requirement — do not flip
the router back and forth per session.
**Original status:** Accepted 2026-11-04 (Lead Architect; plan `plan/2026-11-04-02-routing-seo-plan.md` signed off)

## Context

A public jobs portal needs shareable, bookmarkable job links. On 2026-11-04 the
app used `MemoryRouter` seeded once from `window.location`: the address bar was
frozen, the back button left the app, and `/jobs/:jobId` could not be shared. An
uncommitted v2-structure experiment kept the freeze and added a `lazyRoute`
one-reload guard for failed chunks — that guard now solves the stale-chunk
failure mode, so freezing the URL no longer buys anything. `vercel.json` already
rewrites every path to `index.html`, so the host is ready.

## Decision

- Use `BrowserRouter`; every route is a real URL and hard-loadable.
- Keep the `lazyRoute` chunk guard (sessionStorage one-shot reload).
- Keep ADR-021 portal-scoped sessions and `PublicRoute`/`ProtectedRoute` behavior.
- Keep the legacy alias routes working.
- Unifed `/login` stays the only sign-in page (no per-portal login routes).

## Consequences

- Deep links, refresh, back/forward, and per-route `<title>`/meta become possible.
- Route tests may still use `MemoryRouter` as their test harness; only tests
  asserting frozen-URL behavior change (none should exist).
- Stale-chunk recovery is delegated to `lazyRoute`; removing it would regress
  deploy-mid-session behavior.
