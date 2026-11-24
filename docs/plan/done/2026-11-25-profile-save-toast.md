# Profile save toast

Status: approved 2026-11-25 — implement via `frontend`.

## Confirmed brief

- **What:** saving the job-seeker profile shows a toast: green **“Changes saved”** on
  success, red **“Changes not saved”** on failure.
- **How:** reuse `src/shared/components/Toast.jsx`; replace the existing transient
  “Profile saved.” save-hint flip with the toast; keep the static hint text.
- **Done when:** success and failure paths each show the correct toast, the old transient
  hint is gone, tests/lint pass.
- **Out of scope:** other profile pages, toast component redesign, server/API.

## Changes (`src/features/job-seeker/Profile.jsx`)

- Import `Toast`.
- Add `const [toast, setToast] = useState(null)` and
  `const closeToast = useCallback(() => setToast(null), [])`.
- Remove the `saved` state, `setSaved(false)`/`setSaved(true)` and the 3 s timeout.
- `handleSubmit`: clear the toast at the start (`setToast(null)`); on the success path
  (after `refreshUser`) `setToast({ message: 'Changes saved', variant: 'success' })`; in
  the catch block, alongside the existing inline error routing,
  `setToast({ message: 'Changes not saved', variant: 'error' })`.
- `saveHint` becomes the constant `"Changes are saved to your JobLinked account."`.
- Render `<Toast message={toast?.message} variant={toast?.variant} onClose={closeToast} />`
  next to the delete confirmation modal at the end of the component.

## Tests (`src/features/job-seeker/__tests__/Profile.address.test.jsx`)

- In the existing successful-save test, assert `Changes saved` appears after saving.
- New test: make `updateProfile` reject, save, assert `Changes not saved` appears and the
  inline error still renders.
- Existing assertions about `Profile saved.` being absent stay valid.

Preserve any concurrent edits; change only the save-feedback logic.

## Acceptance

`npx vitest run src/features/job-seeker/__tests__/Profile.address.test.jsx`, then
`npm test` and `npm run lint`, all passing.
