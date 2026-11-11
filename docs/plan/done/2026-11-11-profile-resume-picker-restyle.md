# Job seeker profile — resume picker restyle

**Status:** Approved (Lead Architect, 2026-11-11). Implementation delegated to `frontend`.

## Goal

Make the "Add a resume" panel on the job seeker profile use the same file-picker treatment as job seeker registration (`JobSeekerPersonalStep.jsx`): dashed primary-tinted field, primary label, native file input styled as a chip via `file:` utilities.

## Contract (binding)

File: `src/features/job-seeker/Profile.jsx`, the `<Panel title="Add a resume">` block only.

1. Replace the drag-and-drop wrapper and the plain `Input` with the registration treatment:
   - `<Field className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4" data-invalid={!!uploadError}>`
   - `<FieldLabel htmlFor="resume-upload" className="text-primary">Choose a resume</FieldLabel>` — label text must stay exactly `Choose a resume` (existing test and accessible name depend on it).
   - `<Input id="resume-upload" type="file" accept=".pdf,.doc,.docx" ... />` with the registration's `file:` class set (`file:my-1 file:mr-3 file:h-8 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-4 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-hover`) plus `h-11 py-0 block w-full border-0 bg-transparent text-xs text-muted-foreground`.
2. Keep the upload flow unchanged: `pickResume`, `handleResumeUpload`, `uploadError`, `resumeStatus`, draft reset, and the "Add resume" button (disabled until a draft exists).
3. Remove the now-dead drag-and-drop plumbing: `onDragOver`/`onDrop`, the dashed wrapper `div`, and the `event.dataTransfer` fallback in `pickResume`.
4. Show the selected file as text under the input: `{draft.name} · {fileSize(draft.size)}`; otherwise accurate limits: PDF up to 2 MB, DOC or DOCX up to 5 MB. Also correct the Panel `description` to those limits.
5. `id="resume-upload"` must remain — the "Replace" button on listed resumes clicks it by id.
6. Keep the existing note about applications and active-resume behavior.

Out of scope: resume list markup, `ResumeAutofill` panel, service layer, API, schema.

## Verification

- `npx vitest run src/features/job-seeker/__tests__/ProfileResumeUpload.test.jsx src/features/job-seeker/__tests__/ProfileResumeDelete.test.jsx src/features/job-seeker/__tests__/Profile.a11y.test.jsx` — all pass, including the picker's accessible name.
- `npm test` and `npm run lint` stay clean.
- Confirm `UploadCloud`/`CheckCircle2` imports: remove `CheckCircle2` if unused after the change; keep `FileText` (still used in the resume list) and `UploadCloud` (button icon).
