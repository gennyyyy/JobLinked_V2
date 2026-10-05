# ADR-021 — Session resets on foreign pages [SIGNED OFF]

Rule: an authenticated session survives ONLY inside its own portal
(`/super-admin/*`, `/employer/*`, `/job-seeker/*`). Everywhere else the
session is destroyed on arrival and the page renders as guest.

Precise behavior:
1. Public routes (`/`, `/jobs`, `/jobs/:id`, `/portals`, `/register/*`,
   `/forgot-password`, `/reset-password`): session present → `signOut()`,
   then render the page as guest. Unauthenticated visits unchanged.
2. Portal login (`/X/login`): session with role X → redirect to X home
   (unchanged). Session with role Y≠X → `signOut()`, show X's login form.
3. `ProtectedRoute` mismatch (authenticated, wrong role): `signOut()`,
   then redirect to the ATTEMPTED portal's login (which renders as guest
   per rule 2) — replaces today's bounce-to-own-portal.
4. Own-portal routes: untouched. Consequences accepted: logo/home click
   while logged in logs you out; public job browsing while logged in is
   impossible (portal job boards cover it).

Implementation (frontend-only, no API/contract changes): a public-route
wrapper that signs out on mount when a session exists (show `LoadingScreen`
until sign-out settles, then render guest content); `ProtectedRoute`
mismatch path signs out before navigating; `Login.jsx` keeps the
role-match redirect and signs out on role mismatch. Reuse the existing
`logout()` from `AuthContext` — no new auth primitives.
