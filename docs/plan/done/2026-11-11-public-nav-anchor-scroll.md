# Public nav anchor scroll — FAQ

**Status:** Approved (Lead Architect, 2026-11-11). Implementation delegated to `frontend`.

## Problem

Clicking a section link (`/#faq`) in the public chrome does not reliably scroll to the section.

Root cause, from `src/App.jsx` + `src/shared/lib/StaticUrlRouter.jsx` (ADR-041): the address bar is frozen at `/`, so `window.location.hash` never becomes `#faq` and the browser performs no native anchor jump. Scrolling is entirely JS.

`src/features/public-site/Landing.jsx` scrolls inside `useEffect(..., [hash])`. The `hash` **string** only changes the first time an anchor is selected. A second click on the same anchor pushes a new router location with the same hash, so the effect never re-runs and the page does not move. The nav also has no FAQ item; only the footer links to `/#faq`.

## Contract (binding)

1. `src/shared/components/PublicShell.jsx` — add `['FAQ', '/#faq']` to the `links` array. Desktop nav and the mobile sheet both consume that array; do not duplicate the entry.
2. `src/features/public-site/Landing.jsx` — scroll on **every navigation**, not only on a hash-string change:
   - read the full `location` from `useLocation()`;
   - effect dependencies: `[location.key, location.hash]` (`location.key` is new on every push, including a repeat click on the same anchor);
   - no-op when `location.hash` is empty;
   - target `document.getElementById(location.hash.slice(1))`, `scrollIntoView({ block: 'start' })`.
3. No new dependencies, no URL/history changes, no router changes. Hosting rules in `AGENTS.md` still apply.

## Verification

New test `src/features/public-site/__tests__/Landing.anchorScroll.test.jsx` (Vitest + Testing Library):

- stub `Element.prototype.scrollIntoView`;
- render `Landing` in a `MemoryRouter` seeded at `/`, click the nav link named `FAQ`, assert `scrollIntoView` was called on `#faq`;
- click it again, assert it is called again (this assertion fails against the current `[hash]` dependency — it is the regression guard);
- render seeded at `/#faq`, assert the section scrolls on mount.

Acceptance: that test passes, `npm test` stays green, `npm run lint` clean.

## Handoff

`frontend` owns the three files above. No schema, API, or ADR change.
