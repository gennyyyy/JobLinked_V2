# Dedicated expired-link page

- **Status:** Approved by user 2026-11-26. Dispatch: `frontend`.
- **Owner of contract:** architect. No backend, email, or schema change.

## Confirmed brief

- **What:** One dedicated `/link-expired` page. Expired/missing reset, verification, and legacy invite links redirect there instead of rendering their own error screens. `?type=reset|verify|invite` picks the copy and action; missing/unknown type gets the generic version.
- **How:** New `src/features/auth/LinkExpired.jsx` using `PublicShell` + `AuthFrame`; register the route; `ResetPassword`, `AuthCallback`, and `AcceptInvite` navigate there with `replace` when the link cannot be used. Not under `PublicRoute` (change-email verification may involve a signed-in user). The reset form's post-submit `INVALID_TOKEN` message stays inline — that is a failed submit, not a link click.
- **Done when:** frontend tests cover the page by type and the three redirects; `npm test`, `npm run lint`, `npm run build` pass.
- **Out of scope:** token durations, Better Auth error codes, email copy, `StaticUrlRouter` behavior.

## Page copy

Title: `This link has expired.`
Subtitle: `It’s no longer valid.`

| `type` | Body | Actions |
|---|---|---|
| `reset` | `This password reset link is invalid or has expired.` | `Request a new reset link` → `/forgot-password`; `Go to sign in` → `/login` |
| `verify` | `This verification link is invalid or has expired.` | `Go to sign in` → `/login` (resend lives there) |
| `invite` | `This invite link is invalid or has expired. Ask your administrator to send a new invite.` | `Go to sign in` → `/login` |
| missing/unknown | `This link is invalid or has expired.` | `Request a new reset link` → `/forgot-password`; `Go to sign in` → `/login` |

Style with the existing `AuthFrame`/`PublicShell` patterns and theme tokens; no new icons or CSS.

## Wiring

- `src/features/auth/LinkExpired.jsx` (new): read `type` with `useSearchParams`, render the table's copy/links.
- `src/shared/lib/routeLoaders.js`: add `'/link-expired': () => import('../../features/auth/LinkExpired')`.
- `src/App.jsx`: `const LinkExpired = route('/link-expired')` and `<Route path="/link-expired" element={<LinkExpired />} />` near the auth routes. Do not wrap in `PublicRoute`.
- `src/features/auth/ResetPassword.jsx`: when `!token`, return `<Navigate to="/link-expired?type=reset" replace />` instead of the current invalid screen. Keep the inline error when `resetPasswordWithToken` rejects.
- `src/features/auth/AuthCallback.jsx`: on `error` query param, or when `verifyEmailToken` throws, return `<Navigate to="/link-expired?type=verify" replace />` instead of the current error screen. Keep the verified and loading states.
- `src/features/auth/AcceptInvite.jsx`: when there is no token, return `<Navigate to="/link-expired?type=invite" replace />`; keep token forwarding.

## Tests

- New `src/features/auth/__tests__/LinkExpired.test.jsx`: each `type` renders its body and actions; unknown/missing type renders the generic copy.
- Update `ResetPassword.test.jsx`, `AuthCallback.test.jsx`, `AcceptInvite.test.jsx`: assert the redirect to `/link-expired` and the right `type`; keep the valid-flow tests green (reset form, verified screen, invite forwarding).
- Full `npm test` (root), `npm run lint`, `npm run build`.

## Note

The worktree contains another agent's uncommitted design-system work. Do not revert or modify it; build on the current tree (its last reported state was green).
