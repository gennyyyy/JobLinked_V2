# Applicants: move "View resume" into the Review candidate modal

**Status:** approved by user 2026-11-26 (screenshot of the Review column).

## Change — `src/features/employer/Applicants.jsx`

1. Remove the row-level "View resume" ghost Button from the Review cell; keep only
   "Review candidate".
2. Remove the page-level `{resumeError && <div className="mb-4"><InlineError …/></div>}` block —
   the error must surface where the button now lives.
3. `Applicants` dialog passes `onViewResume={() => openResume(selected)}` and
   `resumeError={resumeError}` into `CandidateDetail`.
4. Opening a candidate clears the stale error: the "Review candidate" click does
   `setResumeError(''); setSelected(application)`.
5. `CandidateDetail` gains `onViewResume` / `resumeError` props. In the "Candidate profile"
   Panel, set `action` to an outline `size="sm"` Button "View resume" (same `aria-label`
   pattern as before) **only when `application.resume?.file_path` exists**, and render the
   `InlineError` above `SeekerProfileCard` when `resumeError` is set.

`openResume` itself is unchanged (signed URL + the 403 message).

## Test — `src/features/employer/__tests__/Applicants.actionError.test.jsx`

Update the resume 403 test: open the "Review candidate" dialog first, click the "View resume"
button **inside the dialog**, assert the alert is inside the dialog, and the row still exists
behind it.

## Done when

- `/employer/applicants` rows show only "Review candidate"; the resume action lives in the modal
  and its failure is shown in the modal.
- `npx vitest run src/features/employer/__tests__/Applicants.actionError.test.jsx` and
  `npm run lint` pass.
