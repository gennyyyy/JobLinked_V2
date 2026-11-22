# Employer profile: login email lives in Account settings only

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** remove the redundant "Login Email (read-only)" field from the
  employer Company Profile Representative tab. The login email is already shown
  in the embedded Account settings tab's "Account overview" panel
  (`AccountSettings` renders `user.email` there), so Account settings is the one
  place it belongs.
- **How:** delete that read-only field block from
  `src/features/employer/CompanyProfile.jsx`. No change to `AccountSettings`
  itself, the account overview email, the profile payload, or the `email`
  exclusion in the save patch.
- **Done when:** the Representative tab no longer renders a login-email field,
  the Account tab still shows the login email, tests and lint pass.
- **Out of scope:** making the login email editable, adding an email-change
  panel, job seeker/super-admin profiles.

## Test

`src/features/employer/__tests__/CompanyProfile.address.test.jsx` — assert the
Representative tab has no "Login Email" field, while the Account settings tab
still shows `user.email` (the existing account-overview assertion already covers
the latter).

## Acceptance

Focused CompanyProfile suite, then `npm test` and `npm run lint`, all passing.
