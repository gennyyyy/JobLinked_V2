# Refresh Route Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page refresh keeps the signed-in user on the exact page they were on, with the session intact.

**Architecture:** No new session-caching layer. The better-auth signed HttpOnly cookie + server-side `auth.session` row already restore the session on every reload (verified: `AuthProvider.useSession()` → `GET /api/auth/get-session`). The logout-on-refresh bug is a routing collision: `StaticUrlRouter` freezes the address bar at `/` (ADR-041), so a reload re-enters `/`, which is wrapped in `PublicRoute`, and ADR-021's "destroy the session on arrival at a public route" (`src/App.jsx` `PublicRoute`) signs the user out. Fix: persist the current in-app route in `history.state` (native per-history-entry storage) so a reload re-seeds the router on the protected route; `PublicRoute` never fires. ADR-021 stays untouched: deliberately navigating to a public page while signed in still logs out.

**Tech Stack:** React 19, react-router-dom (custom `Router` driver), Vitest + Testing Library.

**Spec:** Approved in-chat design (2026-11-28, this session). ADR-041 (frozen URL bar) and ADR-021 (public-route session policy) remain unchanged in intent.

## Global Constraints

- JavaScript/JSX only — no TypeScript (repo rule).
- No session storage changes: nothing in `localStorage`/`sessionStorage`; no cookie, Supabase, or better-auth configuration changes; no DB or API changes.
- The only new persisted data is `{ pathname, search, hash }` in `history.state` — a route path, never a credential.
- ADR-041 behavior preserved: the address bar stays frozen; pages remain non-bookmarkable; a new tab or bookmark lands on `/`.
- ADR-021 behavior preserved: a signed-in user who deliberately navigates to a public route is still logged out.
- Run `npm test` and `npm run lint` before submitting.

## Review Focus

1. **Recovery links win over a stale stored route** — opening `/reset-password#...type=recovery` after the tab previously sat on `/employer` must route to the reset screen, not the stored route. (Pinned by Task 1, step 1, test 3.)
2. **A forged or foreign-role stored route leaks nothing** — seeding `/super-admin` with a job-seeker session renders `ProtectedRoute`, which logs out on role mismatch. Pinned by the existing `src/shared/components/__tests__/ProtectedRoute.test.jsx` suite — no new test needed; the stored route is a navigation request, not an authorization.
3. **Back/Forward after reload must not dead-end** — after a reload, `popstate` entries whose in-memory stack entry is gone must restore from the stored route. (Pinned by Task 1, step 1, test 4.)
4. **The stored route is a path, not an identity** — the seed must re-run the full server-validated session restore (`get-session` → `/auth/me` profile); nothing client-side asserts who the user is.
5. **Fresh tabs and bookmarks are unchanged** — no `history.state` → current-URL seeding, exactly as today. (Pinned by Task 1, step 1, test 5.)

## Follow-up (architect review, post-implementation)

The committed implementation seeds the post-reload stack at index `0` and overwrites the current entry's `joblinkedEntry` with `0`. Every history entry before the reloaded one still carries its own index, so the tab's **oldest** entry (index 0 of the pre-reload stack) collides with the seed and renders the reloaded page once instead of its own route. Fix: on mount, preserve the current entry's real index when `history.state.joblinkedEntry` is a non-negative integer (fallback `0`), seed the sparse stack at that index, and write that index back in `replaceState(stateOf(startIndex, initial), ...)`. Update test 4 to simulate the reload the way `App.jsx` does (fresh router seeded with `restoredEntry()` and the saved state) and add an assertion that popping back to an older entry restores *that entry's* stored route. All existing tests stay green.

### Task 1: Persist the in-app route in history state and seed from it on reload

**Files:**
- Modify: `src/shared/lib/StaticUrlRouter.jsx`
- Modify: `src/App.jsx:82-85` (`entryPath` derivation)
- Test: `src/shared/lib/__tests__/StaticUrlRouter.test.jsx` (new)

**Interfaces:**
- Consumes: existing `StaticUrlRouter({ entry, children })` default export; `history.pushState/replaceState/popstate` (native).
- Produces: `export function restoredEntry(): string | null` from `src/shared/lib/StaticUrlRouter.jsx` — returns `${pathname}${search}${hash}` of the current history entry's stored route, or `null` when absent/malformed. The state key `'joblinkedLocation'` stays module-private. `App.jsx` consumes `restoredEntry()`; nothing else imports it.

- [ ] **Step 1: Write the failing tests**

Create `src/shared/lib/__tests__/StaticUrlRouter.test.jsx` with these five tests (jsdom; render `StaticUrlRouter` with a small `useNavigate()` probe component to drive navigation; assert on the rendered probe's received `location.pathname`):

1. `push persists the route in history state` — render with entry `/`, navigate to `/employer/jobs`; expect `window.history.state.joblinkedLocation` to deep-equal `{ pathname: '/employer/jobs', search: '', hash: '' }`.
2. `restoredEntry returns the persisted route` — after the navigation in test 1, expect `restoredEntry()` to equal `'/employer/jobs'`.
3. `recovery-style entry URL wins in App seeding` — expect `restoredEntry()` to be *ignored* by `App.jsx` when `window.location.hash` matches `type=recovery`: assert the `entryPath` expression prefers `/reset-password` + hash. Implement as a unit test of the `App.jsx` expression if it is extracted, else as the documented manual check in Step 5 (state which in the test file comment).
4. `popstate restores a route after the stack is lost` — after navigating to `/employer/jobs`, unmount and re-render a fresh `StaticUrlRouter` with entry `/` (simulates post-reload empty stack); dispatch `popstate` on `window` with the saved `history.state`; expect the rendered location pathname to be `/employer/jobs`.
5. `restoredEntry returns null without stored state` — fresh `window.history.state` is `null`; expect `restoredEntry()` to be `null`.

Run: `npx vitest run src/shared/lib/__tests__/StaticUrlRouter.test.jsx`
Expected: FAIL — `restoredEntry` is not exported / `joblinkedLocation` is undefined.

- [ ] **Step 2: Implement in `src/shared/lib/StaticUrlRouter.jsx`**

- Add module constant `LOC_INDEX = 'joblinkedLocation'`.
- Add `stateOf(index, location)` returning `{ [ENTRY_INDEX]: index, [LOC_INDEX]: { pathname, search, hash } }`.
- `push()` and `replace()`: build history state via `stateOf(index.current, location)` instead of the bare `{ [ENTRY_INDEX]: index.current }`.
- Mount `useLayoutEffect`: `replaceState(stateOf(0, initial), '', frozenHref())` so the seeded entry also carries its route.
- `onPopState`: when `stack.current[target]` is undefined (post-reload stack), fall back to `event.state?.[LOC_INDEX]` — build `{ pathname, search, hash, state: null, key: `pop-${target}` }`, memoize it at `stack.current[target]` (sparse; the ref is never rendered), and proceed as today. Return early when neither exists.
- Export `restoredEntry()` reading `window.history.state?.[LOC_INDEX]`, returning `null` for a missing/non-string `pathname`.

- [ ] **Step 3: Seed `App.jsx` from the stored route**

In `src/App.jsx`, change the non-recovery branch of `entryPath` to prefer the stored route:

```js
const entryPath = recoveryLanding
  ? `/reset-password${window.location.hash}`
  : restoredEntry() || `${window.location.pathname}${window.location.search}${window.location.hash}`
```

(`restoredEntry` is computed at module load — exactly once, at the reload moment, before the mount `replaceState` normalizes state.)

- [ ] **Step 4: Run tests, lint, and the suite**

Run: `npx vitest run src/shared/lib/__tests__/StaticUrlRouter.test.jsx && npm test && npm run lint`
Expected: new tests PASS; existing suites (`src/__tests__/App.recovery.test.jsx`, auth, route tests) stay green.

- [ ] **Step 5: Manual verification (the done-check that proves the user story)**

With `npm run dev` (web 5173 / API 4000): sign in as any role → navigate into the portal (e.g. `/employer/job-posts`) → press F5. Expect: the same page re-renders, still signed in, with `GET /api/auth/get-session` 200 and **no** `sign-out` request in the network tab. Repeat a back/forward press after the reload — pages restore. Then click the logo to `/` while signed in — expect logout (ADR-021 unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/StaticUrlRouter.jsx src/App.jsx src/shared/lib/__tests__/StaticUrlRouter.test.jsx
git commit -m "Restore the last route on reload via history state"
```
