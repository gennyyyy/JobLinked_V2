# Resume Typography — Canva Reference Makeover Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the Create-a-Resume modal and the PDF/DOCX renderers with the typography of `sample_pdf/resume_sample.pdf` (Canva black-and-white resume) while keeping the current single-column layout, fields, and content.

**Architecture:** Presentation-only. Two independent file sets: `src/features/auth/CreateResumeModal.jsx` and `server/src/resumeDoc.js`. Supersedes the *visual* spec of `docs/plan/2026-11-28-resume-modal-wysiwyg.md`; its structural spec (single column, inline editing, section order) still stands.

**Reference:** `E:/code_ni_hans/peso_project/sample_pdf/resume_sample.pdf` — extract its type treatment, not its two-column layout.

## Global Constraints

- No content, field, payload, service, route, or DB changes. Header stays centered; section order EDUCATION → EXPERIENCE → SKILLS stays.
- No new dependencies. JavaScript/JSX only.
- Keep every `Label`↔input association, button name, and dialog role unchanged — existing tests must pass untouched.
- Remove the dark-blue/mono heading treatment; the reference is a neutral black-and-white system.

## Typography spec (both sides)

| Element | Spec |
|---|---|
| Palette | text `#111111`; headings/secondary `#444440`; rules `#D9D9D9`; page white |
| Name | large (~32pt doc / `text-4xl` modal), **regular weight** (reference is not bold), `#111111`, centered |
| Contact / address / personal lines | small (~10pt doc / `text-xs`), `#444440`, centered |
| Section headings | UPPERCASE, wide letter-spacing (~0.3em / characterSpacing ~3), **regular weight**, `#444440`, 1px `#D9D9D9` bottom rule |
| Body | small (~10.5pt doc / `text-sm`), `#111111` |
| Experience entry | title line regular `#111111`; dates small `#444440`; description `#111111` |

### Task 1: Frontend — modal typography

**Files:** Modify `src/features/auth/CreateResumeModal.jsx` only.

- [ ] **Step 1:** Update the shared class constants: `NAME` → `text-4xl font-normal tracking-tight text-[#111111]`; section heading class → `text-xs font-normal uppercase tracking-[0.3em] text-[#444440] border-b border-[#D9D9D9] pb-1.5` (replace the mono/primary/semibold styling); `FIELD` and inline inputs → `text-[#111111]` (secondary header fields `text-[#444440]`); education/experience entry titles drop `font-medium` to regular.
- [ ] **Step 2:** Keep every handler, id, label, button, and structural class unchanged. Only typography/colors change.
- [ ] **Step 3:** Run `npm test -- JobSeekerRegister` (29/29 PASS, unchanged), `npm test`, `npm run lint`. Commit — `style: canva-reference typography for Create a Resume modal`.

### Task 2: Backend — renderer typography

**Files:** Modify `server/src/resumeDoc.js` only.

- [ ] **Step 1:** Replace the palette constants with the spec (`BODY #111111`, `MUTED #444440`, `RULE #D9D9D9`; drop dark blue). Name: Helvetica **normal** 32pt `#111111` centered. Header sub-lines 10pt `#444440` centered. Section headings: Helvetica normal 11pt `#444440`, uppercase, `characterSpacing` ~3 (pdfkit text option), 0.75pt `#D9D9D9` rule. Body 10pt `#111111`. Experience title regular (not Helvetica-Bold), dates 9pt `#444440`, description 10pt `#111111`.
- [ ] **Step 2:** DOCX mirrors it: name `size: 64` (32pt) regular `#111111` centered; header sub-lines `size: 20` `#444440` centered; headings `size: 22` regular `#444440` with `characterSpacing` (verify the installed `docx` version supports the TextRun option; if not, skip tracking and note it) and a `#D9D9D9` bottom border; entry titles regular; dates `size: 18` `#444440`.
- [ ] **Step 3:** Run `npm --prefix server test` (987 PASS, unchanged). Commit — `style: canva-reference typography for resume PDF/DOCX renderers`.

### Task 3: Verification

- [ ] `npm test`, `npm run lint`, `npm --prefix server test` — green output seen (unrelated parallel-load timeout flakes verified in isolation if they appear).
- [ ] Live smoke both formats; extract PDF text and DOCX `document.xml` text to confirm content order unchanged and no encoding loss.
- [ ] User visual check of modal + downloads.
