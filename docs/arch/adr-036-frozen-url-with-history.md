# ADR-036 — Frozen address bar with working Back/Forward

**Status:** Accepted 2026-11-04 (product owner; supersedes ADR-035). Amended
2026-11-10 by ADR-041 (the frozen URL shows the app root, not the entry page).

## Context

Two earlier decisions conflicted: real URLs (`BrowserRouter`, ADR-035) versus a
frozen address bar. The product owner wants the URL to stay on whatever page the
tab was opened with — but browser Back/Forward must still move between the pages
visited in the app.

A browser history entry is normally a URL change. That is not a requirement
though: `history.pushState(state, '', sameUrl)` creates a new entry that keeps the
current URL, and `popstate` carries the state back. So both behaviours fit.

## Decision

`src/shared/lib/StaticUrlRouter.jsx` is a thin `<Router>` wrapper:

- keeps the page stack in memory (pathname/search/hash/state per entry),
- on push/replace calls `history.pushState`/`replaceState` with `window.location.href`
  (the URL never changes) and the entry index in the state object,
- on `popstate` maps `event.state.joblinkedEntry` back to the stored location, so
  Back/Forward render the right page with the URL untouched,
- is seeded from the URL the tab loaded with, keeping emailed
  `/auth/callback`, `/reset-password`, `/complete-registration?role=…` links working.

`App.jsx` renders `<StaticUrlRouter entry={window.location…}>` instead of
`MemoryRouter`/`BrowserRouter`.

## Consequences

- In-app pages remain un-bookmarkable and un-shareable by URL; that is accepted.
- Back past the entry page leaves the app (the browser's own entry below ours).
- History state is per tab: after a reload the stack restarts at the loaded URL.
- Per-route `<title>` (`usePageTitle`) and the `lazyRoute` chunk guard are unaffected.
- Do not replace this with `BrowserRouter` or `MemoryRouter` without the product
  owner's sign-off; both were tried and rejected.
