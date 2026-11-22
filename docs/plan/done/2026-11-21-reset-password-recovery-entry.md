# Fix: reset-password email lands on the public site

Status: confirmed with user, dispatched. ADR: `docs/arch/adr-055-recovery-link-entry.md`.
Owner: frontend agent.

## Confirmed brief

- **Bug:** clicking the password-reset email lands on `https://www.joblinked.site/#access_token=…&type=recovery…` (Supabase Site-URL fallback). The app renders the public landing page, never the reset screen. Additionally `/reset-password` sits under `PublicRoute`, which signs out the incoming recovery session before a password can be saved.
- **What:** a tab opened with a recovery fragment must render the reset screen and keep that one-time session alive. Nothing else about ADR-021 changes.
- **How:** in `src/App.jsx` only:
  - Snapshot the entry fragment at module load, before `@supabase/supabase-js` clears it: `const recoveryLanding = /(^|[#&])type=recovery\b/.test(window.location.hash)`.
  - `entryPath`: when `recoveryLanding`, seed the router with `` `/reset-password${window.location.hash}` `` instead of the real pathname/search/hash.
  - `PublicRoute`: skip the sign-out effect and its LoadingScreen return when `recoveryLanding` is true (both the `useEffect` guard and the `if (user && !done)` return need the extra condition, or the route hangs on the loading screen).
- **Out of scope:** `resetPassword()` (its `redirectTo` is already `${origin}/reset-password`), the email template, Better Auth migration, `ResetPassword.jsx` behaviour, any server/API code.
- **Ops (not code):** add `https://www.joblinked.site/reset-password` and the localhost equivalents to Supabase → Authentication → URL Configuration → Redirect URLs. Do not block the code fix on it.

## Files

- `src/App.jsx` (only)
- Test: new `src/__tests__/App.recovery.test.jsx` (or the nearest existing app-level test directory; `src/shared/lib/__tests__/` is acceptable if the harness fits better there)

## Acceptance

1. New test A: set `window.location` to `/#access_token=x&type=recovery`, dynamic-import `src/App.jsx` after the location is set (module-scope snapshot), render with a mocked signed-in auth context; expect the reset form (e.g. "New Password" label) and assert `logout` was **not** called. Mock the lazy `/reset-password` route only if the real one makes the test heavy; the assertion is about routing and no-logout, not the form's internals.
2. New test B (pins ADR-021): entry `/` with a signed-in user and **no** recovery fragment → `logout` **is** called.
3. Existing `src/shared/lib/__tests__/StaticUrlRouter.test.jsx`, `src/features/auth/__tests__/ResetPassword.test.jsx` still pass.
4. `npm run lint` clean.
5. Report the exact commands and pass/fail counts.

Keep the diff to `App.jsx` + one test file. No helper module, no context state, no new dependency.
