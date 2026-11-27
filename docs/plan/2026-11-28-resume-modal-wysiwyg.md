# Resume Modal WYSIWYG Makeover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Create a Resume" modal look like a paper resume with inline editing, and restyle the PDF/DOCX renderers to mirror the same layout.

**Architecture:** Presentation-only change. No API, payload, service, DB, or test-selector changes. Two independent file sets: `src/features/auth/CreateResumeModal.jsx` (frontend) and `server/src/resumeDoc.js` (backend). Both share the visual spec below.

**Spec:** `docs/arch/adr-061-registration-create-resume.md` (unchanged contract). Follow-up to `docs/plan/2026-11-27-create-resume-registration.md`.

## Global Constraints

- JavaScript/JSX only. Tailwind theme tokens (`primary`, `dark-blue`, `muted-foreground`, `danger`).
- `buildResume`, `download()`, the POST contract, and all data flow stay byte-identical in behavior.
- Existing tests must stay green without weakening assertions: keep every `Label`↔input association (labels become `sr-only` where needed — `getByLabelText` still finds them). Button names ("Download PDF", "Download DOCX", "Done", "Add experience", "Remove") stay unchanged.
- Keep axe accessibility: `role="dialog"`, focus trap via `useDialog` (unchanged), visible focus styles on all inline fields.
- No new dependencies.

## Visual spec (both sides must match)

- **Page:** white (`bg-white`), generous padding (~p-8), near-black body text; name and section headings in `dark-blue`.
- **Header (centered):** Full Name — large bold (~text-2xl); contact line — email · phone (muted, ~text-xs); address line — street, barangay, Santa Maria, Bulacan, postal; personal line — Birthdate · Nationality.
- **Sections, in order:** EDUCATION → EXPERIENCE → SKILLS. Heading uppercase, tracking-wide, ~text-xs bold, `dark-blue`, with a 1px bottom rule and ~16px bottom margin. Skip empty sections in documents; in the modal the sections always show (editing surface).
- **Education:** line 1 `Level — School`; line 2 `Field · Year` (omit year when currently studying).
- **Experience entry:** line 1 `Job Title — Company` (bold); line 2 `Month YYYY – Month YYYY` (small, muted; blank end = `Present`); description paragraph.
- **Skills:** single comma-separated line.
- Spacing between sections ~20px; between entries ~12px.

### Task 1: Frontend — paper-resume modal with inline editing

**Files:**
- Modify: `src/features/auth/CreateResumeModal.jsx`
- Test: `src/features/auth/__tests__/JobSeekerRegister.test.jsx` (should pass unchanged; only adjust if a selector legitimately moves)

- [ ] **Step 1:** Restyle the modal to the visual spec. Panel becomes a white paper page (keep `modal-panel` structure/`useDialog`). Keep a small title row ("Create a Resume" + one-line hint) and the footer (error + Download PDF / Download DOCX / Done) as-is.
- [ ] **Step 2:** Header area: inline editable fields rendered like resume text — full-name inputs on one centered row (first, middle, last, suffix); centered contact row (email · phone with existing +63 handling); centered address row (street, barangay, disabled Santa Maria / Bulacan, postal); centered personal row (birthdate, nationality select). All labels `sr-only` with the current `htmlFor`/`id` pairs preserved.
- [ ] **Step 3:** Inline field style (single shared class): transparent background, no box border, `border-b border-transparent hover:border-dashed hover:border-muted-foreground/40 focus:border-primary`, `rounded-none`, reduced horizontal padding, `text-sm` body (name fields may use larger text). Keep `form-field` sizing where it does not fight the paper look; placeholder text doubles as the empty-state hint.
- [ ] **Step 4:** Sections: uppercase `dark-blue` heading with `border-b` rule. Education as two inline rows (`level select — school`, `field · year` + studying checkbox small). Experience entries as paper entries: jobTitle — company on one row, start–end month inputs on one row, description as a borderless textarea; "Add experience" as a small outline button in the heading row (unchanged name), "Remove" unchanged (small, danger). Skills as one inline comma input (unchanged onChange logic) + hint.
- [ ] **Step 5:** Keep the scroll container (`max-h-[85vh]` page area) so long resumes scroll inside the paper; footer stays fixed at panel bottom.
- [ ] **Step 6:** Run `npm test -- JobSeekerRegister` → PASS unchanged; `npm test` → full suite PASS; `npm run lint` → clean.
- [ ] **Step 7:** Commit — `feat: paper-resume layout for Create a Resume modal`

### Task 2: Backend — renderers mirror the modal layout

**Files:**
- Modify: `server/src/resumeDoc.js`
- Test: `server/src/routes/resumes.generate.test.js` (must pass unchanged)

- [ ] **Step 1:** PDF (`renderResumePdf`): centered name (Helvetica-Bold ~20), centered contact/address/personal lines (~10, `muted-foreground`-like gray), `dark-blue` uppercase section headings (~11 bold) each followed by a 1px horizontal rule drawn with `doc.moveTo(...).lineTo(...).strokeColor(...).lineWidth(0.75).stroke()`; body ~10 with the entry structure from the visual spec; keep page-break-safe text wrapping (`width`); same section order and empty-section skipping.
- [ ] **Step 2:** DOCX (`renderResumeDocx`): `AlignmentType.CENTER` for header lines; name `size: 40` bold; heading paragraphs with `border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '<light gray>' } }`, `color: '<dark blue>'`, uppercase, spacing to match; entry lines per spec (job title bold, dates small, description normal).
- [ ] **Step 3:** Look up the exact `dark-blue` hex in `src/index.css` and use it in both renderers (do not invent a color).
- [ ] **Step 4:** Run `npm --prefix server test` → full server suite PASS (the generate route tests assert bytes/headers only; layout must not break them).
- [ ] **Step 5:** Commit — `feat: resume PDF/DOCX layout mirrors the Create a Resume modal`

### Task 3: Verification sweep

- [ ] `npm test`, `npm run lint`, `npm --prefix server test` — green output seen.
- [ ] Live smoke both formats against the dev API; extract PDF text (pdfjs) and DOCX `word/document.xml` text to confirm order: name → contact → address → EDUCATION → EXPERIENCE → SKILLS → "Present" handling.
- [ ] Manual browser check by user: modal reads like a paper resume, inline fields discoverable, downloads visually match.
