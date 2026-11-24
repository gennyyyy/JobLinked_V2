# Resume staged on selection, committed on "Save my profile"

Status: approved 2026-11-25 — implement via `frontend` agent.

Supersedes the ADR-049 plan line "Keep the autofill checkbox gating for upload".
The consent acknowledgement is about autofill accuracy, not about uploading a
file to the user's own profile, so it gates only "Apply detected details" now.

## Confirmed brief

- **What:** In Profile → My resumes, choosing a resume file selects it
  immediately (no separate "Add resume" click). The file is uploaded and the
  `resumes` row created/replaced only when the user presses **Save my profile**.
  Until then the tab shows the chosen file as pending.
- **Why:** users read file selection as the upload. Today selection sends
  nothing, the real upload is hidden behind a consent box and an "Add resume"
  button inside a panel headed "Autofill from your resume", so the tab keeps
  saying "No resume added." and looks broken.
- **How:** browser-side staging. The `File` stays in `Profile` state (`draft`,
  already present); `handleSubmit` posts it through the existing
  `POST /files/resumes`, refreshes the list, then continues the profile save.
  No server, API, schema, or migration change.
- **Done when:**
  - picking a file sends no request and shows it as pending;
  - clicking "Save my profile" uploads it and the card renders the new resume;
  - an upload failure shows the message, uploads nothing, and does not report
    "Profile saved.";
  - `npm test` and `npm run lint` pass.
- **Out of scope:** server routes, DB/schema/migrations, JobDetail apply flow,
  registration resume autofill (`useResumeAutofill` is unchanged).

## Global constraints

- Keep `id="resume-upload"` on the file input — the resume card's **Replace**
  button clicks it by id.
- Keep the resume card's View / Download / Replace / Delete behaviour and copy
  unchanged.
- Keep the `{ error: { code, message } }` API shape — no API change.
- The staged file must upload even when profile-field validation fails: a new
  seeker without education must still be able to save a resume with the same
  Save action. Field errors keep blocking only the profile PATCH, as today.
- One resume per seeker: reuse the existing replace-in-place POST as-is.

## Files

- Modify `src/features/job-seeker/Profile.jsx`
- Modify `src/features/job-seeker/ResumeAutofill.jsx`
- Modify `src/features/job-seeker/__tests__/ProfileResumeUpload.test.jsx`
- Verify only: `ProfileResumeAutofill.test.jsx`, `ProfileResumeDelete.test.jsx`,
  `Profile.skills.test.jsx`, `Profile.a11y.test.jsx` (they mock `uploadResume`;
  no changes expected).

## Tasks

### Task 1 — Stage on selection, upload on save (`Profile.jsx`)

- `pickResume(file)`: validate with `validateFile`; on error set
  `uploadError`, set `draft` to `null` and return. On success clear
  `uploadError` and set `draft` to the file. Do **not** call `uploadResume`.
  Delete the `setResumeReviewConfirmed(false)` call.
- Delete `handleResumeUpload`, the `uploading` and `resumeStatus` state, and the
  `resumeReviewConfirmed` state.
- `handleSubmit(event)`: keep `event.preventDefault()`, then:
  - `const profileValid = validate()`.
  - If there is no staged file and the profile is invalid → return (today's
    behaviour).
  - Otherwise `setSaving(true)` / `setSaved(false)` and, inside one try block:
    - if a staged file exists: `await uploadResume(userId, draft)`,
      `setResumes(await listResumes(userId))`, `setDraft(null)`, clear
      `uploadError`; mark locally that the upload happened;
    - if the profile is invalid → return (resume is already committed, field
      errors are already rendered);
    - run the existing `updateProfile` block unchanged.
  - On error: route it to `uploadError` when the upload was the failing step,
    otherwise to `error` as today. Always clear `saving` in `finally`.
- Resume tab UI:
  - remove the `uploadControl` and `onReviewConfirmedChange` props passed to
    `ResumeAutofill`;
  - keep passing `uploadError` (the picker renders it);
  - render the pending line under the card / empty state:
    `{draft && <p role="status">Selected {draft.name}. Save my profile to upload it as your resume.</p>}`
  - keep the **Replace** button and the delete modal as they are.

### Task 2 — Autofill panel is autofill-only (`ResumeAutofill.jsx`)

- Remove the `uploadControl` and `onReviewConfirmedChange` props and every
  `onReviewConfirmedChange?.(...)` call.
- The review checkbox keeps its `required` marker and error text and continues
  to gate only the "Apply detected details" button (already the case there).
- Add one line to the picker help: the chosen file is uploaded when the profile
  is saved.

### Task 3 — Tests (`ProfileResumeUpload.test.jsx`)

- Selecting a file asserts `expect(uploadResume).not.toHaveBeenCalled()`.
- Clicking **Save my profile** asserts `uploadResume` was called with
  `('u1', expect.any(File))` and the `resume.pdf` card is shown.
- Add one case: `uploadResume.mockRejectedValue(new Error('Upload failed.'))`
  → the error text is shown and `updateProfile` was not called.

### Task 4 — Verify

- `npm test`
- `npm run lint`
