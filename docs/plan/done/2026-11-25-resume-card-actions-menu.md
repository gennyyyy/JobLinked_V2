# Resume card actions under a "…" menu

Status: approved 2026-11-25 — implement via `frontend` agent.

## Confirmed brief

- **What:** On Profile → My resumes, the resume card's View / Download /
  Replace / Delete button row moves into a single "…" actions menu in the card
  header, matching the employer Job management row menu.
- **How:** reuse the existing `@/components/ui/dropdown-menu` primitives and the
  `JobPosts.jsx` trigger pattern (ghost icon `Button` via `render`, `MoreHorizontal`,
  `align="end"`, destructive last item). `ResumeLinks` becomes `ResumeActions`,
  keeping the lazy View/Download fetch logic unchanged.
- **Done when:** the card shows only the "…" trigger instead of four buttons;
  the menu offers View (with the "(opens in new tab)" announcement), Download,
  Replace (opens the existing `#resume-upload` picker), separator, Delete
  (opens the existing confirmation dialog); `npm test` and `npm run lint` pass.
- **Out of scope:** server/API/schema, card copy, the delete confirmation dialog,
  the resume upload-on-save flow.

## Files

- Modify `src/features/job-seeker/Profile.jsx`
- Modify `src/features/job-seeker/__tests__/ProfileResumeDelete.test.jsx`
- Modify `src/features/job-seeker/__tests__/Profile.a11y.test.jsx`

## Task 1 — `Profile.jsx`

- Imports: add `MoreHorizontal` to the lucide import; drop `Eye` (only
  `ResumeLinks` used it); keep `Trash2` (photo remove). Add
  `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator` from `@/components/ui/dropdown-menu`.
- Replace `ResumeLinks({ resume })` with
  `ResumeActions({ resume, onReplace, onDelete })`:
  - keep the existing `busy` state and `open(kind)` function verbatim (fetch
    `signedUrl('resumes', resume.file_path)` on click; `window.open` inside the
    gesture for view; anchor download for download);
  - render the menu exactly like `JobPosts.jsx:483-514`:
    trigger `render={<Button variant="ghost" size="icon" aria-label={`Actions for ${resume.file_name}`} />}`
    with `MoreHorizontal`; content `align="end"`;
  - items in order: **View** (include `<span className="sr-only"> (opens in new tab)</span>`,
    `disabled={Boolean(busy)}`), **Download** (`disabled={Boolean(busy)}`),
    **Replace** (`onClick={onReplace}`), `DropdownMenuSeparator`, **Delete**
    (`variant="destructive"`, `onClick={onDelete}`).
- Resume card markup: header becomes `flex items-start gap-3`; file name + date
  stay in the `min-w-0 flex-1` block; `<ResumeActions … />` sits at the end with
  `shrink-0`. Remove the `mt-3 flex flex-wrap gap-2` row and the standalone
  Replace/Delete buttons.
- Wire handlers: `onReplace={() => document.getElementById('resume-upload')?.click()}`,
  `onDelete={() => setPendingDelete(resumes[0])}`.
- Keep `id="resume-upload"`, the confirmation modal, all copy, and the
  upload-on-save flow unchanged.

## Task 2 — tests

- `ProfileResumeDelete.test.jsx`: open the menu first via
  `getByRole('button', { name: /actions for old\.pdf/i })`, click
  `getByRole('menuitem', { name: 'Delete' })`, then the dialog's Delete; the
  rest of the assertions stay.
- `Profile.a11y.test.jsx`: open the same menu, then assert the
  `/opens in new tab/i` announcement lives inside the View `menuitem`
  (`closest('[role="menuitem"]')`).

## Verify

- `npx vitest run src/features/job-seeker/__tests__/ProfileResumeDelete.test.jsx src/features/job-seeker/__tests__/Profile.a11y.test.jsx src/features/job-seeker/__tests__/ProfileResumeUpload.test.jsx src/features/job-seeker/__tests__/ProfileResumeAutofill.test.jsx`
- `npm test`
- `npm run lint`
- Manual: Replace from the menu opens the file picker (it is a direct user
  gesture inside the menu item handler).
