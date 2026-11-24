# Show the profile save toast immediately (optimistic)

Status: approved 2026-11-25 — implement via `frontend`.

## Confirmed brief

- **What:** the green “Changes saved” toast appears as soon as the save starts, not after
  the API round-trip, so the UI feels faster.
- **How:** in the profile submit handler, after validation passes and a save is actually
  attempted, set the success toast before awaiting `updateProfile`; leave the existing
  catch replacing it with the red “Changes not saved” toast.
- **Done when:** the success toast is visible while the request is still in flight; a
  failure still ends with the red toast; tests/lint pass.
- **Out of scope:** Toast component, other pages, server changes.

## Changes (`src/features/job-seeker/Profile.jsx`)

- In `handleSubmit`, keep `setToast(null)` at the start.
- After the `if (!draft && !profileValid) return` guard (i.e. when a save will be
  attempted), set `{ message: 'Changes saved', variant: 'success' }` immediately.
- Remove the late success `setToast(...)` after `refreshUser` so the 4-second timer is not
  restarted.
- The catch keeps setting `{ message: 'Changes not saved', variant: 'error' }`.

## Tests (`src/features/job-seeker/__tests__/Profile.address.test.jsx`)

- Add a test with a deferred `updateProfile` promise: click save, assert “Changes saved”
  is visible before resolving, then resolve and confirm the form still completes.
- Keep the existing success and failure tests passing.

## Acceptance

`npx vitest run src/features/job-seeker/__tests__/Profile.address.test.jsx`, then
`npm test` and `npm run lint`, all passing.
