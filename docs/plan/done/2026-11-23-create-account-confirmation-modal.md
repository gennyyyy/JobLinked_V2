# Create Account confirmation modal (job-seeker registration)

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** on the job-seeker registration final step, clicking **Create Account**
  performs validation, then opens a confirmation modal. The modal contains the account
  creation explanation (moved out of the inline panel) and a confirmation button that
  actually creates the account.
- **How:** keep the final-step trigger as a `type="button"`; move the existing explainer
  into the modal; only the modal's confirm action calls `signUp`. Cancel/Esc closes the
  modal and leaves everything typed intact. Sign-up errors stay visible inside the modal.
- **Done when:** trigger opens the modal instead of creating the account; confirm creates
  it; cancel creates nothing; the inline explainer is gone; tests/lint pass.
- **Out of scope:** employer registration, server changes, the success screen, step
  navigation, captcha behaviour.

## Changes (`src/features/auth/JobSeekerRegister.jsx`)

- Remove the inline `<section aria-labelledby="create-account-explainer">` panel from the
  final step.
- Add `const [confirmOpen, setConfirmOpen] = useState(false)`.
- Split the current submit body:
  - `requestAccountCreation()` — runs the existing final-step validation (fields,
    education, captcha token). On success (errors cleared) `setConfirmOpen(true)`.
  - `finalizeAccount()` — the current `signUp` call, busy flag, `captcha.reset()` on
    failure, `setError(...)`. On success set `needsConfirmation`/`submittedEmail`/
    `submitted` as today and close the modal.
- `handleSubmit`: `preventDefault`; non-final step keeps `handleNext()`; final step calls
  `requestAccountCreation()` (so Enter cannot bypass the modal).
- Final-step **Create Account** button: `type="button"`, `onClick={requestAccountCreation}`.
  Keep its label and styling.
- Render `ConfirmationModal` (from `../../shared/components/ConfirmationModal`) at the
  root, next to `TermsModal`, when `confirmOpen`:
  - `title="Confirm account creation"`
  - `message="Your account isn't active until you open the verification link and sign in."`
  - children: the moved content — heading **What happens after you create your account**,
    the three ordered points, and the **“Verified”** clarification (same copy as today).
  - show the current `error` inside the modal as `role="alert"` when present.
  - `cancelLabel="Keep editing"`, `confirmLabel={busy ? 'Creating account…' : 'Confirm & Create Account'}`,
    `confirmDisabled={busy}`, `onConfirm={finalizeAccount}`,
    `onCancel={() => { if (!busy) setConfirmOpen(false) }}`.

### Shared (`src/shared/components/ConfirmationModal.jsx`)

- Add optional `confirmDisabled = false` prop and pass `disabled={confirmDisabled}` to the
  confirm button. No other change.

## Tests (`src/features/auth/__tests__/JobSeekerRegister.test.jsx`)

- Helper for submissions: click **Create Account**, assert the dialog opened, then click
  **Confirm & Create Account**. Update every existing submission test to go through the
  confirmation.
- Update the explainer test: the heading/list/clarification are no longer on the form;
  they appear inside the dialog after clicking Create Account.
- New: Cancel ("Keep editing") closes the dialog and `signUp`/`api.post` is not called.
- New: sign-up rejection keeps the dialog open and shows the alert inside it.
- Keep the final-step-actions test (Create Account still present; Next absent).

## Acceptance

`npx vitest run src/features/auth/__tests__/JobSeekerRegister.test.jsx`, then `npm test`
and `npm run lint`, all passing. Report counts.
