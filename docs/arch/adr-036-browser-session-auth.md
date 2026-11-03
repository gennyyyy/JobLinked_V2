# ADR-036 — Auth stays browser-side with an in-memory session [ACCEPTED 2026-11-03]

## Context
The current app authenticates with the Supabase browser SDK using `persistSession: false` and
`autoRefreshToken: false`, then loads the profile from `GET /api/auth/me`. The session lives in
memory only; a hard reload signs the user out. Portal guards are client-side (`AD-021`
role-mismatch logout) and the Express API enforces authorization on every request.

Next.js offers cookie-based SSR auth (`middleware.ts`, server components reading cookies). Adopting
it would change the security model already approved for this system and would let the UI act on
a session the API has not verified.

## Decision
- Keep Supabase **browser-only** and **in-memory**: `persistSession: false`, `autoRefreshToken: false`.
- Profile/role come from `GET /api/auth/me`, not from JWT claims or SSR cookies.
- **No `middleware.ts` auth checks** and no auth-dependent server components. Pages render, then the
  client guard decides.
- Client-side portal guards remain the UX layer; the API remains the enforcement layer.
- Supabase is used only for: `signInWithPassword`, `signUp`, `signOut`, `updateUser`,
  `resetPasswordForEmail`, `getSession`, `refreshSession`, `onAuthStateChange`. No `.from`,
  `.storage`, `.rpc`.

## Consequences
- Parity with today: a hard reload signs the user out. Documented, not a bug.
- No flash of protected content: shells render a loading skeleton until the profile resolves.
- Every request carries the bearer token through one REST client (`services/api/client.ts`), which
  owns the single 401 policy (refresh once, retry once, then sign out to `/login?next=…`).
- Server components cannot pre-fetch per-user data; they render shells only. Accepted cost.

## Alternatives
- **Cookie-based SSR auth + middleware** — a different security model, requires re-approval, and
  moves authorization decisions into the render layer. Rejected.
- **`localStorage` persistence** — survives reloads but increases token exposure in a shared-terminal
  (PESO office) context. Rejected; matches current behavior.
