# Shared resume file field

**Status:** Approved (Lead Architect, 2026-11-11). Implementation delegated to `frontend`.

## Problem

The registration resume picker is inline JSX in `src/features/auth/JobSeekerPersonalStep.jsx`. The same visual treatment is now copy-pasted into `src/features/job-seeker/Profile.jsx` (upload) and `src/features/job-seeker/ResumeAutofill.jsx` (autofill). Three copies of one class set and one file-input contract.

## Decision

Extract a presentational `ResumeFileField` into `src/shared/components/ResumeFileField.jsx`. The registration picker is the reference design; behavior stays in each caller (registration: `useResumeAutofill`; profile autofill: preview/apply state; profile upload: `validateFile` + `uploadResume`).

## Component contract (binding)

```jsx
<ResumeFileField
  id            // required; input id and label htmlFor
  label         // required
  accept        // string, default '.pdf,.docx'
  help          // ReactNode rendered as FieldDescription
  status        // ReactNode rendered as <p role="status" aria-live="polite">
  error         // string; sets data-invalid, aria-invalid, renders FieldError
  disabled      // boolean
  onChange      // file input handler
  className     // extra classes on the Field container
  children      // content after the error (e.g. the upload button)
/>
```

Rendering rules — must match today's registration picker exactly:

- `Field` container: `rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4` plus `className`.
- `FieldLabel` with `className="text-primary"`.
- `Input` `type="file"` `multiple={false}` with: `h-11 py-0 block w-full border-0 bg-transparent text-xs text-muted-foreground file:my-1 file:mr-3 file:h-8 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-4 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-hover`.
- `aria-describedby` = `${id}-help` and/or `${id}-error` when those exist.
- Import `Field`/`FieldLabel`/`FieldDescription`/`FieldError` from `@/components/ui/field`, `Input` from `@/components/ui/input`, `cn` from `@/lib/utils`.
- No state, no file reading, no upload logic inside the component.

## Call sites

1. `src/features/auth/JobSeekerPersonalStep.jsx` — id `resumeAutofill`, label `Autofill from resume (PDF or DOCX only)`, accept `.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document`, onChange `handleResumeChange`, help `PDF up to 2 MB or DOCX up to 5 MB. We'll fill in details below; review and edit them before continuing.`, status `autofillStatus`. Drop the now-unused `Input` import; keep `Field`/`FieldLabel`/`FieldError` for the mobile-number field.
2. `src/features/job-seeker/Profile.jsx` — id `resume-upload`, label exactly `Choose a resume`, accept `.pdf,.doc,.docx`, onChange `pickResume`, help `{draft ? name · size : 'PDF up to 2 MB · DOC or DOCX up to 5 MB.'}`, error `uploadError`, upload Button as `children`. Keep the `Panel` wrapper, `resumeStatus` line, and trailing note.
3. `src/features/job-seeker/ResumeAutofill.jsx` — id from `useId()`, label exactly `Choose a resume to autofill`, accept `.pdf,.docx`, onChange keeps the existing select-and-clear handler, disabled `busy`, help the existing long description, error `error`, status keeps the `Loader2` spinner. The outer `<section aria-label="Resume autofill">` loses the dashed/bordered container (`flex flex-col gap-3` only) so the shared field is the single visible box; the preview list and Apply button stay outside it.

## Non-goals

No changes to `useResumeAutofill`, `validateFile`, upload/delete services, API, or schema.

## Verification

- `npx vitest run src/features/auth/__tests__/JobSeekerRegister.test.jsx src/features/job-seeker/__tests__/ProfileResumeUpload.test.jsx src/features/job-seeker/__tests__/ProfileResumeAutofill.test.jsx src/features/job-seeker/__tests__/Profile.a11y.test.jsx src/features/job-seeker/__tests__/ProfileResumeDelete.test.jsx` — all pass; labels `Autofill from resume…`, `Choose a resume`, `Choose a resume to autofill` unchanged.
- `npm run lint` clean, `npm test` no regressions.
- No leftover duplicated `file:` class string outside the shared component (grep).
