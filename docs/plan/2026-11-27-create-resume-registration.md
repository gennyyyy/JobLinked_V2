# "Create a Resume" Registration Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace registration's "Autofill from resume" file picker with a "Create a Resume" button that opens a resume-builder modal; the built resume fills the registration form and downloads as PDF or DOCX.

**Architecture:** The modal edits the registration form state directly (no draft copy, no apply-drift). Work-experience entries live only in `JobSeekerRegister` state and ride into the generated document. A new stateless Express endpoint renders the resume server-side (`pdfkit` for PDF, `docx` for DOCX) and returns bytes — nothing persisted, no auth (registration has no session). Spec: `docs/arch/adr-061-registration-create-resume.md`.

**Tech Stack:** React 19 (JS/JSX, no TypeScript), Express + `pdfkit` + `docx` (new server deps), Vitest + Testing Library + supertest.

**Spec:** `docs/arch/adr-061-registration-create-resume.md` — read it first; this plan implements it.

## Global Constraints

- JavaScript/JSX only — no TypeScript (repo rule).
- Tailwind classes use theme tokens from `src/index.css` (`primary`, `danger`, `dark-blue`, `muted-foreground`, etc.).
- All API calls go through `src/shared/lib/api.js` — no raw `fetch` in features.
- Server errors use the `err(res, status, 'CODE', 'message')` helper from `server/src/util.js`; body always `{ error: { code, message } }`.
- Browser never touches PostgreSQL/Supabase DB directly (auth only).
- The endpoint is unauthenticated and stateless — payload caps are a security requirement, not polish.
- `docs/db/schema.sql` is NOT touched (no schema change in this feature).
- Profile page's `ResumeAutofill` panel and `src/shared/utils/resumeAutofill.js` are NOT modified — the parser stays in service there.
- Registration still never uploads a resume file (ADR-049).

## Review Focus

- **Empty resume download** — user clicks Download before entering anything: expect a valid one-page PDF/DOCX with name "Resume" and no crash or 500.
- **Special characters** — `ñ`, `é`, quotes in names/skills/descriptions: expect correct glyphs in both PDF and DOCX (PDFKit needs the font embedded — Helvetica builtin handles Latin-1; verify `ñ` renders).
- **Experience with missing end date** — blank `endDate` must render "Present", never "Invalid Date" or blank.
- **Duplicate modal open** — opening the modal, editing, closing without saving, reopening: form edits made in the modal persist (live-edit), experience entries persist (parent state). Never reseeded from stale defaults.
- **Anonymous rate-limit bucket** — the generate endpoint is anonymous; verify the apiLimiter's IP bucket applies (no crash when `req.user` is undefined).

---

### Task 1: Server — resume renderers + generate endpoint

**Files:**
- Modify: `server/package.json` (add `pdfkit`, `docx`)
- Create: `server/src/resumeDoc.js`
- Create: `server/src/routes/resumes.js`
- Modify: `server/src/app.js:22,135` (import + mount)
- Test: `server/src/routes/resumes.generate.test.js`

**Interfaces:**
- Consumes: `err` from `server/src/util.js`; existing app harness `server/src/__tests__/helpers/app.js`.
- Produces:
  - `renderResumePdf(resume) -> Promise<Buffer>` and `renderResumeDocx(resume) -> Promise<Buffer>` in `server/src/resumeDoc.js`, where `resume` is the normalized object below.
  - `POST /api/resumes/generate` — request `{ format: 'pdf'|'docx', resume }`, response 200 with file bytes; errors 400 `VALIDATION_ERROR`.

**Resume payload contract** (validated at the boundary, then trusted):

```js
{
  format: 'pdf' | 'docx',
  resume: {
    firstName, middleName, lastName, suffix,   // strings, ≤ 100 chars each
    email,                                      // string ≤ 200
    phone,                                      // string ≤ 30
    birthdate,                                  // 'YYYY-MM-DD' or ''
    nationality,                                // string ≤ 100
    address: { street, barangay, cityMunicipality, provinceState, postalCode }, // each ≤ 200
    education: { level, school, field, year } | null,  // strings ≤ 200
    skills: [string],                           // ≤ 20 items, each ≤ 60
    experience: [{ jobTitle, company, startDate, endDate, description }],
      // ≤ 10 entries; jobTitle/company ≤ 120; startDate/endDate 'YYYY-MM' or ''; description ≤ 2000
  }
}
```

- [ ] **Step 1: Add deps** — `npm --prefix server install pdfkit docx`. Verify `server/package.json` updated and `node --prefix server -e "import('pdfkit')"`-style import works (or just proceed; Step 4's test proves it).

- [ ] **Step 2: Write the failing test** (`server/src/routes/resumes.generate.test.js`, supertest against the shared app harness — follow the pattern in `server/src/routes/reports.export.test.js`):

```js
// Core assertions (body = valid minimal payload from the contract above):
it('renders a PDF', async () => {
  const res = await request(app).post('/api/resumes/generate')
    .send({ format: 'pdf', resume: minimalResume });
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toBe('application/pdf');
  expect(res.headers['content-disposition']).toMatch(/attachment/);
  expect(res.body.toString('latin1').startsWith('%PDF-')).toBe(true); // supertest binary — use .parse if needed
});
it('renders a DOCX (zip magic)', ...)   // content-type application/vnd.openxmlformats-officedocument.wordprocessingml.document; bytes start with 'PK'
it('rejects unknown format', ...)        // format: 'txt' -> 400, error.code === 'VALIDATION_ERROR'
it('rejects oversized fields', ...)      // skills with 25 items -> 400
it('accepts an empty resume', ...)       // all strings '' , empty arrays -> 200
```

- [ ] **Step 3: Run test to verify it fails** — `npm --prefix server test -- resumes.generate`. Expected: FAIL (404 route not found).

- [ ] **Step 4: Implement `server/src/resumeDoc.js`**

Two exports. Shared normalization helper first (both renderers use it):

```js
// normalize(resume) -> display model: fullName = parts joined skipping blanks;
// addressLine = [house?no — street, barangay, city, province, postal].filter(nonempty).join(', ');
// birthdate 'YYYY-MM-DD' -> 'MMMM D, YYYY' (or ''); month 'YYYY-MM' -> 'MMMM YYYY' (or '');
// experience entry endDate '' -> 'Present'. Trim every string.
export async function renderResumePdf(resume) { /* pdfkit: doc = new PDFDocument({ size: 'A4', margins }); collect chunks into a Buffer via doc.on('data')/doc.on('end'); fixed layout: name (18pt bold, dark), contact line (10pt), address line, section headings (12pt bold) for Education / Experience / Skills — skip a section when empty; experience entries as "Job Title — Company, StartDate–EndDate" + description paragraph. Wrap long text with doc.text(str, { width }). End with doc.end(). */ }
export async function renderResumeDocx(resume) { /* docx lib: Document with Paragraphs mirroring the PDF order; return Packer.toBuffer(doc). Heading via TextRun bold+size; skip empty sections. */ }
```

- [ ] **Step 5: Implement `server/src/routes/resumes.js`**

```js
import { Router } from 'express';
import { err } from '../util.js';
import { renderResumePdf, renderResumeDocx } from '../resumeDoc.js';
// validateResume(body): returns normalized { format, resume } or null.
// Manual checks (no schema lib installed): format whitelist; typeof string + length caps
// per the contract above; coerce undefined arrays to []. Any violation -> null.
const router = Router();
router.post('/resumes/generate', async (req, res) => {
  const parsed = validateResume(req.body);
  if (!parsed) return err(res, 400, 'VALIDATION_ERROR', 'Invalid resume data.');
  const fileName = sanitize(parsed.resume) + '-Resume.' + (parsed.format === 'pdf' ? 'pdf' : 'docx');
  // sanitize: name parts joined '-', strip [^A-Za-z0-9-], collapse repeats, fallback 'Resume'
  const buffer = parsed.format === 'pdf' ? await renderResumePdf(parsed.resume) : await renderResumeDocx(parsed.resume);
  res.setHeader('Content-Type', parsed.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.send(buffer);
});
export default router;
```

- [ ] **Step 6: Mount in `server/src/app.js`** — add `import resumesRoutes from './routes/resumes.js';` next to the other route imports (line ~22), and add `resumesRoutes` to the `app.use('/api', ...)` list (line 135). No new limiter: the app-wide `apiLimiter` (line 120) already throttles this anonymous endpoint by IP.

- [ ] **Step 7: Run test to verify it passes** — `npm --prefix server test -- resumes.generate`. Expected: PASS. Also run `npm --prefix server test` to confirm nothing else broke.

- [ ] **Step 8: Commit** — `feat: server-side resume PDF/DOCX generation endpoint`

### Task 2: Client — modal builder, wiring, and autofill removal

**Files:**
- Modify: `src/shared/lib/api.js` (add `postBlob`)
- Modify: `src/shared/services/documents.js` (add `generateResume`)
- Create: `src/features/auth/CreateResumeModal.jsx`
- Modify: `src/features/auth/JobSeekerPersonalStep.jsx` (replace picker with button)
- Modify: `src/features/auth/JobSeekerRegister.jsx` (experience state, modal mount, prop cleanup)
- Modify: `src/features/auth/jobSeekerRegistration.js` (remove dead flags)
- Delete: `src/features/auth/useResumeAutofill.js`
- Modify: `src/features/auth/__tests__/JobSeekerRegister.test.jsx` (rewrite autofill block)
- Test: same file.

**Interfaces:**
- Consumes: `POST /api/resumes/generate` (Task 1 contract); `useDialog` hook (`src/shared/hooks/useDialog`) used by `TermsModal` for portal/focus/Esc handling; `EDUCATION_LEVELS` from `jobSeekerRegistration.js`; `buildFullName` from `@/shared/utils/names`.
- Produces:
  - `api.postBlob(path, body) -> Promise<Blob>` in `src/shared/lib/api.js` — same error handling as `blob()`, but POST + JSON body; response headers are not exposed cross-origin, so the client names the file itself.
  - `generateResume(payload) -> Promise<Blob>` in `src/shared/services/documents.js` — thin wrapper over `api.postBlob('resumes/generate', payload)`.
  - `<CreateResumeModal open onClose experience setExperience set setEducation form education />` — controlled by `JobSeekerRegister`.
  - `experience` state in `JobSeekerRegister`: `[{ jobTitle: '', company: '', startDate: '', endDate: '', description: '' }]`, held in `useState([])` so it survives step navigation.

- [ ] **Step 1: Write the failing tests** — rewrite the `JobSeekerRegister autofill` describe block in `src/features/auth/__tests__/JobSeekerRegister.test.jsx` (remove the `resumeText` mock, `pickFile`, and review-checkbox helper — they test deleted behavior). New cases:

```js
it('opens the Create a Resume modal from the button', ...)
  // click button named /create a resume/i -> dialog with 'Create a Resume' heading appears
it('edits form fields through the modal', ...)
  // type firstName 'Juan' inside the modal -> close -> step 1 firstName input has value 'Juan'
it('adds an experience entry and keeps it across steps', ...)
  // fill jobTitle in modal, close, Next to step 2, Back, reopen modal -> jobTitle still filled
it('downloads a PDF via the service', ...)
  // mock documents.generateResume to resolve a Blob; spy URL.createObjectURL/click;
  // click 'Download PDF' in modal -> generateResume called with format 'pdf' and resume.skills as array
```

- [ ] **Step 2: Run tests to verify they fail** — `npm test -- JobSeekerRegister`. Expected: FAIL (no button/modal).

- [ ] **Step 3: Add `postBlob` to `src/shared/lib/api.js`** — copy `blob(path)` and change: `fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' })` (and the retry inside `settleAuth` likewise). Export in the `api` object: `postBlob: (path, body) => ...`.

- [ ] **Step 4: Add `generateResume` to `src/shared/services/documents.js`**

```js
export async function generateResume(payload) {
  return api.postBlob('resumes/generate', payload);
}
```

- [ ] **Step 5: Implement `CreateResumeModal.jsx`** — portal modal via `useDialog` (copy the structural pattern from `TermsModal.jsx`: overlay click + Esc to close, focus trap, `role="dialog"` `aria-modal` `aria-labelledby`). Sections:
  - Personal: first/middle/last/suffix, email, mobile (reuse `formatPhoneDisplay`/`withPrefix`/`normalizePhone` as `JobSeekerPersonalStep` does), birthdate (`type="date"`), nationality (`FormSelect` with `NATIONALITIES`).
  - Address: streetAddress, barangayDistrict, cityMunicipality, provinceState, postalCode. (Lot/block are intentionally not editable here — they pass through untouched.)
  - Education: level (`FormSelect` from `EDUCATION_LEVELS`), school, field, year, studying checkbox — bound to the `education` state object via `setEducation`.
  - Skills: single text input bound to `form.skills` — display `form.skills.join(', ')`, onChange split on commas and trim.
  - Experience: `experience.map(...)` — jobTitle, company, `type="month"` start/end, description textarea; "Add experience" button appends a blank entry; per-entry remove button. Bound via `setExperience` (array replace).
  - All inputs write through `set`/`setEducation`/`setExperience` — the form is the single source of truth; there is no separate draft or "apply" action.
  - Footer: `Download PDF`, `Download DOCX` buttons (busy state while fetching; on resolve, `URL.createObjectURL` → temp `<a download="My-Resume.pdf|docx">` → click → `revokeObjectURL`; on reject, render `error.message` in the modal) and a `Done` button that just closes.

- [ ] **Step 6: Rewire `JobSeekerPersonalStep.jsx`** — replace the whole `<ResumePicker ...>` block (lines 19–37) with a "Create a Resume" button + one-line help text ("Fill your details as a resume — we'll apply them to this form. Download it as PDF or DOCX anytime."); button calls `onOpenResumeBuilder` prop. Remove `autofillStatus`, `autofillTouched`, `handleResumeChange` props and the `ResumePicker` import. Signature becomes `JobSeekerPersonalStep({ form, errors, set, onOpenResumeBuilder, inputClass, labelClass, reqMark })`.

- [ ] **Step 7: Rewire `JobSeekerRegister.jsx`** — add `const [experience, setExperience] = useState([])` and `const [resumeBuilderOpen, setResumeBuilderOpen] = useState(false)`; remove the `useResumeAutofill` import/call; pass `onOpenResumeBuilder={() => setResumeBuilderOpen(true)}` to step 0; remove `"resumeReviewConfirmed"` from `STEP_FIELDS[0]`; render `<CreateResumeModal open={resumeBuilderOpen} onClose={() => setResumeBuilderOpen(false)} experience={experience} setExperience={setExperience} set={set} setEducation={setEducation} form={form} education={education} />` next to the other modals.

- [ ] **Step 8: Delete the dead autofill pieces in `jobSeekerRegistration.js`** — remove `resumeAttached: false,` and `resumeReviewConfirmed: false,` from `EMPTY_FORM` (lines 30–31) and the `if (values.resumeAttached && !values.resumeReviewConfirmed)` line from `validate` (line 56). Delete `src/features/auth/useResumeAutofill.js`. Then `grep -r "useResumeAutofill\|resumeReviewConfirmed\|resumeAttached" src/` — expected: zero matches (the `MAX_PDF_SIZE`/`MAX_RESUME_SIZE` exports may go too if now unreferenced).

- [ ] **Step 9: Run tests to verify they pass** — `npm test` (full suite: register tests + Profile tests untouched and green) and `npm run lint`. Expected: PASS.

- [ ] **Step 10: Commit** — `feat: replace registration resume autofill with Create a Resume builder`

### Task 3: Verification sweep

- [ ] **Step 1:** `npm test` and `npm run lint` — full green output seen.
- [ ] **Step 2:** `npm --prefix server test` — green output seen.
- [ ] **Step 3:** Manual smoke (`npm run dev`): register step 1 → "Create a Resume" → fill sections incl. one experience entry → Download PDF (opens in a viewer, `ñ` renders) → Download DOCX (opens in Word) → Done → form fields populated → complete registration → confirm no resume uploaded to the account.

---

## Skipped deliberately (per ADR-061)

- Persisting the built resume to the account — user uploads the downloaded file in Profile after signup; revisit if asked.
- Multiple resume templates / layout picker — one fixed layout is the product point.
- Draft persistence across page refresh — optional helper; localStorage if ever requested.
