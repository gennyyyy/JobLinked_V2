# ADR-041 — The frozen address bar shows the app root

**Status:** Accepted 2026-11-10 (product owner). Amends ADR-036.

## Context

ADR-036 froze the address bar at whatever URL the tab opened with. In practice
that URL is usually `/login`, so the bar kept showing `/login` for the whole
session even deep inside a portal — it looked like the app was stuck on the
login page. The product owner wants the bar static, but not stuck on a page the
visitor has left.

## Decision

`src/shared/lib/StaticUrlRouter.jsx` keeps the ADR-036 mechanism (same-URL
`pushState` entries, in-memory location stack, `popstate` mapping) and routes by
the real entry URL, but replaces the displayed entry URL with the app root
(`/`) before the first paint.

One-time auth flows keep their real URL, because it is the only copy of the
credential and must survive a mid-flow refresh: `/auth/callback`,
`/reset-password`, `/accept-invite`, `/complete-registration`.

## Consequences

- The bar always reads `origin + '/'` inside the app; it never shows `/login`
  or a portal path.
- Refreshing a normalized session reloads `/` (the landing page). Resuming the
  last page by F5 was never part of ADR-036 and is accepted.
- Emailed deep links still land on their screen — routing reads the entry URL
  before it is normalized, and the four exception routes also keep it visible.
- Back/Forward behavior is unchanged. Pages remain un-bookmarkable/shareable.
- Rollback: delete the mount-time `replaceState` in `StaticUrlRouter`; the bar
  returns to the entry URL.
