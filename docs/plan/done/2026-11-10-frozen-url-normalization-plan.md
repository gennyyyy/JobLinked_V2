# Frozen URL Normalization Plan (address bar shows the app root, never /login)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`
> (or `superpowers:executing-plans`) after Lead Architect sign-off. Track with
> `- [ ]`.

**Goal:** Keep the address bar static (ADR-036) but stop it from showing the
transient page the tab opened on — today `/login` sits in the bar for the whole
session even while you are inside the portals. Normalize the frozen URL to the
app root (`/`) on load, except for one-time auth flows.

**Architecture:** `src/shared/lib/StaticUrlRouter.jsx` already freezes the bar by
re-pushing `window.location.href` on every in-app navigation and seeds its
in-memory stack from `window.location` (`App.jsx:71`). The fix changes only the
*bar's seed value*, not routing: before the first paint, replace the seeded
history entry with one normalized URL. In-app navigation, Back/Forward mapping
(`joblinkedEntry` state), and emailed deep-link landing keep working.

**Tech Stack:** React 19 · react-router-dom `Router` · Vitest/jsdom. No new
dependency, no server or schema change.

**Spec:** this file is the spec; verified against the code on 2026-11-10. Grep
shows no component re-reads `window.location.search/href` after load — only the
router, the `src/dev/*` preview harness pages, and `api.js`'s hard redirect to
`/login` (a full reload, which re-seeds normally).

## Behaviour

1. Tab opens at any URL (`/login`, `/jobs/abc`, a Vercel deep link).
2. The app routes by the real entry URL (emailed links still land), then
   replaces the history entry so the bar reads `origin + '/'` — for the whole
   session, on every navigation.
3. **Exception — keep the entry URL** when the tab is a one-time auth flow whose
   URL must survive a mid-flow refresh: `/auth/callback*`, `/reset-password*`,
   `/accept-invite*`, `/complete-registration*`. Private/parameterized links
   must not break, and their URLs should not linger on the login page's bar.
4. Back/Forward still walk the in-app pages (unchanged mechanism).
5. Reloading after normalization reloads `/` (landing). Entry screen resume by
   F5 is only expected for the exception flows; for everything else that is
   accepted and recorded in ADR-041.

## Task 1: ADR-041 (gate — no code before the owner's sign-off)

**Files:**
- Create: `docs/arch/adr-041-normalized-frozen-url.md`
- Modify: `docs/arch/adr-036-frozen-url-with-history.md` (one line: "Amended by ADR-041")

- [ ] **Step 1:** Write ADR-041: context (bar stuck on `/login`, owner request),
      decision (freeze at `origin + '/'`; keep the four exception prefixes),
      consequences (F5 reloads `/`; no per-session URL history heading), and
      rollback (delete the normalization; bar returns to the entry URL).
- [ ] **Step 2:** Repo owner approves. Implementation stops here until then.

## Task 2: Normalize the frozen URL in the router

**Files:**
- Modify: `src/shared/lib/StaticUrlRouter.jsx`
- Modify: `src/App.jsx:65-71` (comment only)
- Test: `src/shared/lib/__tests__/StaticUrlRouter.test.jsx`

**Interfaces:**
- Consumes: existing `StaticUrlRouter({ entry })` contract (unchanged).
- Produces: on mount, `window.history.replaceState({ [ENTRY_INDEX]: 0 }, '', frozenUrl)`
  where `frozenUrl` = current `window.location.href` only when
  `isTransientRoute(pathname)` (the four prefixes above, prefix match, else
  `false`), else `new URL('/', window.location.origin).href`.

- [ ] **Step 1: Write the failing tests** — same file as the existing two tests:
  - entry `/login` with `/login` mapped to `Home` in the harness → after mount
    `window.location.pathname` is `'/'` and the `Home` route still renders.
  - entry `/reset-password?code=x` → the URL is left untouched.
  - navigating (`Link` click) keeps `window.location.href` unchanged from the
    post-mount value (strengthens the existing navigation test).
- [ ] **Step 2:** `npx vitest run src/shared/lib/__tests__/StaticUrlRouter.test.jsx`
      → FAIL.
- [ ] **Step 3: Implement** — inside `StaticUrlRouter`, a `const TRANSIENT_ROOTS`
      list and one `useLayoutEffect` running before the first navigation:
      `window.history.replaceState({ [ENTRY_INDEX]: 0 }, '', frozenUrl)`.
      `push`/`replace` keep using `window.location.href` (now normalized).
      Update the two file comments (`StaticUrlRouter.jsx` header, `App.jsx:65-70`).
- [ ] **Step 4:** Run → PASS; the two existing tests stay untouched.
- [ ] **Step 5:** Lint + commit
      `tweak(router): normalize the frozen address bar to the app root`.

## Task 3: Config/docs and full-gate smoke

- [ ] **Step 1:** `npm test`, `npm run build`, `npx eslint src server db`.
- [ ] **Step 2:** Manual smoke on the dev server (user's `npm run dev` may be
      running): open `/login`, sign in, walk into a portal — the bar must read
      `/` and never `/job-seeker/...`; confirm `/auth/callback?code=…` still
      lands in the portal, and `/reset-password?code=…` still opens the reset
      screen with the URL intact.
- [ ] **Step 3:** Anything broken: per Task 2 the fallback is deleting the new
      effect (old behavior returns); nothing else to unwind.

## Failure modes

1. Do not `replaceState` to `/` before React has read the entry URL — `entry`
   is read once at module scope, so its first paint must still have the
   original URL in the location (only the *displayed* bar needs the change).
2. Never push the transient entry URL again: `push`/`replace` are only
   called with the current location's `href` (they never re-read the
   pathname), so the bar cannot drift back to `/login`.
3. Do not "fix" this by switching to `BrowserRouter`; ADR-035 was superseded
   on purpose and flipping routers is owner-approved change work.
