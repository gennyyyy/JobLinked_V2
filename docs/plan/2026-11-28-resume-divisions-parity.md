# Resume Labeled Divisions & Modal↔Output Parity Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The resume modal becomes a clearly labeled, properly spaced resume; the PDF and DOCX render the *same* labeled structure so the output looks like the modal.

**Architecture:** Presentation-only, one shared layout spec applied to `src/features/auth/CreateResumeModal.jsx` (Task 2) and `server/src/resumeDoc.js` (Task 1). No field, payload, contract, or persistence changes. Single column, left-aligned. Supersedes the visual specs of `2026-11-28-resume-modal-wysiwyg.md` and `2026-11-28-resume-typography-reskin.md` (their typographic palette survives).

## Shared layout spec

**Page:** white, single column, **left-aligned**, content width ~A4 minus margins (modal: paper panel; PDF: 56pt margins; DOCX: ~1in margins). No centered text anywhere.

**Division label style** (all divisions): uppercase, letter-spacing ~0.3em, ~10pt doc / `text-xs` modal, regular weight, `#444440`. Content gap below label ~4pt.

**Divisions, in order:**

| # | Label | Content |
|---|---|---|
| 1 | `NAME` | Full name — 32pt doc / `text-4xl` modal, regular, `#111111` |
| 2 | `CONTACT` | `email · phone` — 10pt / `text-sm`, `#111111` |
| 3 | `ADDRESS` | `street, barangay, city, province, postal` — 10pt / `text-sm`, `#111111` |
| 4 | `PERSONAL` | `Birthdate: MMMM D, YYYY · Nationality: …` — 10pt / `text-sm`, `#111111` |
| — | divider | 1px `#D9D9D9`, full content width, 16pt space above and below |
| 5 | `EDUCATION` | label has a 1px `#D9D9D9` bottom rule, 8pt gap; `Level — School` then `Field · Year` |
| 6 | `EXPERIENCE` | same ruled label; per entry: `Job Title — Company` (regular `#111111`), `Month YYYY – Month YYYY` (9pt `#444440`, blank end = `Present`), description |
| 7 | `SKILLS` | same ruled label; comma-separated skills |

**Spacing:** gap between header divisions 12pt; gap between sections 20pt; between experience entries 12pt. Empty sections are skipped in documents; the modal always shows them.

### Task 1: Backend — renderers follow the shared spec

**Files:** Modify `server/src/resumeDoc.js` only.

- [ ] **Step 1:** Replace the centered header with the left-aligned labeled divisions from the spec (NAME → CONTACT → ADDRESS → PERSONAL), using the division label style. Remove `align: 'center'` everywhere.
- [ ] **Step 2:** Draw the full-width 1px `#D9D9D9` divider between PERSONAL and EDUCATION (PDF: `moveTo/lineTo`; DOCX: border on the block boundary paragraph).
- [ ] **Step 3:** Keep the ruled section labels (EDUCATION / EXPERIENCE / SKILLS) with the existing tracked uppercase style, the entry structure, and empty-section skipping. Apply the spacing values from the spec.
- [ ] **Step 4:** Run `npm --prefix server test` → 987 PASS; render a module-level smoke and confirm the extracted PDF text / DOCX XML label order is `NAME, CONTACT, ADDRESS, PERSONAL, EDUCATION, EXPERIENCE, SKILLS`. Commit — `feat: labeled resume divisions and spacing in PDF/DOCX output`.

### Task 2: Frontend — modal is the same labeled resume (run AFTER the date-picker task is committed)

**Files:** Modify `src/features/auth/CreateResumeModal.jsx` (+ tests only if required).

- [ ] **Step 1:** Left-align the paper page (remove `text-center`/centering from header rows; inline fields flow left). Keep the inline-edit styling, field-sizing name inputs, barangay dropdown, fixed city/province/postal, date pickers.
- [ ] **Step 2:** Add visible group labels `NAME`, `CONTACT`, `ADDRESS`, `PERSONAL` above their rows, using the existing heading style (uppercase, tracking, `#444440`, 10pt). Keep each input's individual `sr-only` label and `htmlFor`/`id` association unchanged (tests + a11y).
- [ ] **Step 3:** Add the 1px `#D9D9D9` divider between PERSONAL and EDUCATION. Apply the spec's spacing (12pt header gaps, 16pt divider margins, 20pt section gaps, 12pt entry gaps).
- [ ] **Step 4:** Keep the ruled EDUCATION / EXPERIENCE / SKILLS headings, all handlers, button names, and payload logic untouched.
- [ ] **Step 5:** Run `npm test -- JobSeekerRegister` (29/29), `npm test`, `npm run lint`. Commit — `feat: labeled resume divisions and spacing in Create a Resume modal`.

### Task 3: Parity verification

- [ ] Full suites + lint green.
- [ ] Extract label order from the modal structure and from live PDF/DOCX output — must match exactly: `NAME, CONTACT, ADDRESS, PERSONAL, EDUCATION, EXPERIENCE, SKILLS`.
- [ ] User visual check: modal and downloads look like the same document.
