# Employer registration confirmation modal

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** mirror the job-seeker confirmation flow on the employer registration form:
  **Submit Accreditation Application** validates, then opens a confirmation modal with
  employer-specific next steps; only the modal's confirm action creates the account.
- **How:** generalize the dedicated account-creation dialog into one presentational
  component (`RegistrationConfirmModal`) with content props; job-seeker and employer pass
  their own copy. Split the employer submit into validate-then-open and confirm-then-create,
  exactly like the seeker form.
- **Done when:** employer submit opens the modal; confirm creates the account; cancel
  creates nothing; errors stay in the modal; the seeker modal is unchanged visually and
  behaviorally; tests/lint pass.
- **Out of scope:** server changes, success screens, step navigation, captcha.

## Shared component (`src/features/auth/RegistrationConfirmModal.jsx`, new)

Rename/replace `AccountCreationModal.jsx` (delete it). Props:

`open, error, busy, title, description, heading, points (string[]), note (node),
confirmLabel, busyLabel, cancelLabel = 'Keep editing', onConfirm, onCancel`

Render the current layout unchanged (`sm:max-w-xl p-6 gap-5`, visible title/description,
explanation panel with `<ol>` over `points`, `note` paragraph, error alert, bordered
footer with `min-h-10` buttons). Confirm label uses `busyLabel` while busy.

## Job-seeker call site (`src/features/auth/JobSeekerRegister.jsx`)

Swap the import to `RegistrationConfirmModal` and pass the current copy:

- title "Confirm account creation"
- description "Your account isn't active until you open the verification link and sign in."
- heading "What happens after you create your account"
- the existing three points
- note with the existing **“Verified”** clarification
- confirmLabel "Confirm & Create Account", busyLabel "Creating account…"

No behavior change.

## Employer form (`src/features/auth/EmployerRegister.jsx`)

- Add `confirmOpen`; extract `requestSubmission()` (existing validate + captcha check,
  then `setConfirmOpen(true)`) and `finalizeSubmission()` (the current `signUp` body with
  busy/captcha.reset/error/submitted; close the modal on success).
- `handleSubmit`: step 0 → `handleNext()`; final step → `requestSubmission()`.
- Final **Submit Accreditation Application** button becomes `type="button"` with
  `onClick={requestSubmission}`; keep label/style. Hide the inline error while the modal
  is open (as the seeker form does) so it shows only inside it.
- Render `RegistrationConfirmModal` with:
  - title "Confirm accreditation submission"
  - description "Your employer account isn't active until you verify the company email and sign in."
  - heading "What happens after you submit"
  - points:
    1. "We email a verification link to the official company email you entered."
    2. "Your account activates only after you open that link and sign in — the link expires in 1 hour."
    3. "Once verified, PESO reviews your accreditation. You can post jobs after approval."
  - note: **“Verified”** means we confirmed the email belongs to you. It is not PESO
    accreditation — that review happens separately.
  - confirmLabel "Confirm & Submit Application", busyLabel "Submitting…"

## Tests

- `EmployerRegister.test.jsx`: update the `submit()` helper to click the trigger, assert
  the dialog, then click "Confirm & Submit Application". Keep all existing assertions.
  Add: the dialog shows the employer heading and PESO-review point; "Keep editing" closes
  without signUp.
- `JobSeekerRegister.test.jsx`: unchanged assertions must keep passing after the
  component swap.
- Keep the shared `ConfirmationModal`/`dialogA11y` suites green.

## Acceptance

Focused runs for both register suites, then `npm test` and `npm run lint`, all passing.
