# Header account image syncs for employer (company logo)

Status: approved 2026-11-23 — implement via `fullstack-developer`.

## Finding

- **Job seeker:** works. `GET /api/auth/me` returns `has_avatar` /
  `avatar_updated_at`, the profile upload calls `refreshUser`, and the header
  fetches the seeker avatar as an object URL.
- **Employer:** broken. The only picture an employer can set is the company logo
  (`employers/me/logo` → `profile_images` kind `employer-logo`), but:
  1. `GET /api/auth/me` does not return `has_logo` / `logo_updated_at`, so the
     auth user has no image signal.
  2. `TopNavLayout` only handles a seeker avatar (`user.has_avatar`), so the
     header falls back to initials.
  3. `CompanyProfile.handleLogo` / `handleRemoveLogo` refresh the company row but
     not the auth user, so even a known logo would not update the header until a
     later reload.
- **Super-admin:** no picture upload exists (header is initials by design), so
  there is nothing to sync. Adding an admin avatar is a separate feature and is
  out of scope here.

## Fix (use the seeker path as the guide)

Server, `server/src/routes/auth.js` (`GET /auth/me`):

- For `found.role === 'employer'`, query
  `profile_images (owner_id = req.user.id, kind = 'employer-logo')` for
  `updated_at` only (never bytes) and return
  `has_logo: Boolean(row), logo_updated_at: row?.updated_at || null` in the JSON,
  alongside the existing fields.
- Keep the job-seeker `has_avatar` branch and the super-admin response unchanged.
- No schema change: `profile_images.kind` already supports the logo kind.

Frontend, `src/shared/components/TopNavLayout.jsx`:

- Import `logoUrl` from `../services/images`.
- Compute a single header image:
  - employer and `user.has_logo === true` → `logoUrl(user.id, user.logo_updated_at)`
    (public, tokenless URL);
  - otherwise the existing seeker `avatarUrl` when `user.has_avatar === true`.
- Render `<AvatarImage>` when that image exists; keep the initials fallback.
- Keep the seeker object-URL effect; it already skips users without `has_avatar`.

Frontend, `src/features/employer/CompanyProfile.jsx`:

- After a successful `uploadLogo`, and after a successful `removeLogo`, call
  `refreshUser(user)` (in addition to `refreshCompany()`), matching the job
  seeker profile's `handlePicture`/`handleRemovePicture`. This makes
  `has_logo`/`logo_updated_at` change immediately, so the header updates.

## Tests

- `server/src/routes/auth.provision.role.test.js` (`auth/me` suite): employer
  response includes `has_logo: false, logo_updated_at: null`; with a mocked
  logo row it returns `has_logo: true` + `updated_at`, and the JSON never
  contains bytes.
- `src/shared/components/__tests__/TopNavLayout.permissions.test.jsx` (or a
  small sibling test): an employer user with `has_logo: true` renders an
  `AvatarImage` whose `src` includes `/api/employers/<id>/logo`; an employer
  without a logo falls back to initials. No seeker-avatar request for employers.
- `src/features/employer/__tests__/CompanyProfile.address.test.jsx`: logo upload
  and removal call `refreshUser` after the API succeeds.

## Acceptance

Focused server + frontend suites, then `npm test` and `npm run lint`, all
passing. Report commands and counts.
