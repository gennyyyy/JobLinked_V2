# Resume consent required only when a resume was attached

Status: approved 2026-11-23 — implement via `frontend` agent.

## Confirmed brief

- **What:** In the job seeker registration form (Step 1 — Personal Details), the
  acknowledgement "I understand resume autofill can make mistakes and will review
  and correct the extracted information before continuing." stays visible but is
  optional until a resume file has been read. When a resume has been attached and
  parsed, the red `*` appears and the checkbox must be checked before Next.
- **How:**
  - Track a transient `resumeAttached` flag in the registration form state,
    owned by `useResumeAutofill`. It is set `true` only after a valid PDF/DOCX is
    accepted, extracted, and merged into the form (inside the existing success
    path). Invalid format, oversized file, or no file leaves it false.
  - `validate()` in `jobSeekerRegistration.js` raises the
    `resumeReviewConfirmed` error only when `values.resumeAttached` is true.
  - `JobSeekerPersonalStep` passes `required: form.resumeAttached` to
    `ResumePicker`; `ResumePicker` already renders both the `required` attribute
    and the red `*` from that single prop.
- **Done when:** automated tests prove (a) with no file, the checkbox is not
  required, has no `*`, and Next advances with it unchecked; (b) after a
  successful resume read, the checkbox is required, shows `*`, and Next/Submit is
  blocked with the existing error message until checked. `npm test` and
  `npm run lint` pass.
- **Out of scope:** the consent on the Profile resume upload screen
  (`ResumeAutofill.jsx` / `Profile.jsx`), the shared `ResumePicker` component,
  server, and database. No API or schema change.

## Files

- `src/features/auth/useResumeAutofill.js` — set the flag on successful read.
- `src/features/auth/jobSeekerRegistration.js` — gate the validation rule.
- `src/features/auth/JobSeekerPersonalStep.jsx` — conditional `required`.
- `src/features/auth/__tests__/JobSeekerRegister.test.jsx` — update the test that
  asserts the old unconditional rule; add both-direction coverage.

## Assumption

"Used autofill" means a valid resume was successfully parsed; selecting a
rejected file (wrong format / too large / read error) does not require consent,
because no extracted information exists to review.
