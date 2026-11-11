# Education Predefined (no training) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make education predefined (dropdown of education levels) everywhere it is currently free text, and drop the "or training" wording so the field means education only.

**Architecture:** The job seeker profile currently stores education as a free-text tag string (`education_summary`) labeled "Education or training". Replace it with a single select from the existing `EDUCATION_LEVELS` list (already used at registration). Keep the structured `education` table (level/school/field/year) untouched — it already uses predefined levels. Update labels, validation messages, resume-autofill wording, and tests. No schema changes.

**Tech Stack:** React/JSX, Vitest + Testing Library, Express/Postgres (unchanged).

**Spec:** User request 2026-11-11 ("rework the education logic … predefined … remove the training part … only education").

## Global Constraints

- No DB schema changes (education stays `education_summary text` + structured `education` table).
- Reuse existing `EDUCATION_LEVELS` from `src/features/auth/jobSeekerRegistration.js`; do not create a new list.
- Keep `JOB_EDUCATION_LEVELS` (job postings) and `EDUCATION_LEVELS` (seekers) separate — do not merge.
- "Training Provided" tag and "Training & Development" benefit are job attributes, out of scope (left as-is).

## Review Focus

- Autofill applies an education string like "College — PUP Santa Maria" to a now-single-select field; must extract the level or ignore, never store the whole string.
- Stored legacy values (free-text tags) must still render without crashing when loaded into a select.
- a11y tests assert the label text; update to "Education".
- Profile save must still send `education_summary` (now a level string or "").

---

### Task 1: Profile education becomes a predefined select

**Files:**
- Modify: `src/features/job-seeker/Profile.jsx`
- Modify: `src/features/job-seeker/__tests__/Profile.address.test.jsx`
- Modify: `src/features/job-seeker/__tests__/Profile.a11y.test.jsx`

**Interfaces:**
- Consumes: `EDUCATION_LEVELS` from `src/features/auth/jobSeekerRegistration.js`.
- Produces: `form.education` holds a single level string (or "") instead of comma-joined tags.

- [ ] **Step 1: Update tests first**

In `Profile.address.test.jsx`, change stored value to a level and update assertions:
- `education_summary: 'College'` (was `'College — PUP Santa Maria'`).
- Line 55: `expect(screen.getByText('College')).toBeInTheDocument()` (was the em-dash string).
- Line 79: `education_summary: 'College'`.

In `Profile.a11y.test.jsx`, change the expected label regex from `'Education or training'` to `'Education'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Profile.address Profile.a11y`
Expected: FAIL (label/select mismatch).

- [ ] **Step 3: Implement select in Profile.jsx**

Import `EDUCATION_LEVELS` (path: `../auth/jobSeekerRegistration`):

Replace the TagField education line (line ~333) with:
```jsx
<SelectField label="Education" value={form.education} onChange={(event) => setField('education', event.target.value)} options={EDUCATION_LEVELS} placeholder="Select education level" error={errors.education} />
```

Update validation message (line ~165):
```js
if (!form.education) next.education = 'Add your education.'
```
(was `form.education.trim().length < 5` / 'Add your education or training.')

Update completion check (line ~150) stays `form.education` (truthy).

Update applyAutofill (lines ~197-205) to handle education specially:
```js
function applyAutofill(details) {
  setForm((previous) => {
    const next = { ...previous }
    for (const [key, value] of Object.entries(details)) {
      if (!value) continue
      if (key === 'education') {
        const level = String(value).split('—')[0].trim()
        if (EDUCATION_LEVELS.includes(level)) next.education = level
        continue
      }
      if (key in next) next[key] = value
    }
    return next
  })
}
```

Keep submit sending `education_summary: form.education.trim()` (now a level or "").

- [ ] **Step 4: Run tests**

Run: `npm test -- Profile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/job-seeker/Profile.jsx src/features/job-seeker/__tests__/Profile.address.test.jsx src/features/job-seeker/__tests__/Profile.a11y.test.jsx
git commit -m "feat(profile): education is a predefined level, not free text"
```

---

### Task 2: Resume autofill wording

**Files:**
- Modify: `src/features/job-seeker/ResumeAutofill.jsx`

**Interfaces:** None new.

- [ ] **Step 1: Change label**

Line 14: `education: 'Education'` (was `'Education or training'`).

- [ ] **Step 2: Run tests**

Run: `npm test -- ResumeAutofill`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/job-seeker/ResumeAutofill.jsx
git commit -m "chore: education label no longer mentions training"
```

---

### Task 3: Lint + full test run

- [ ] **Step 1: Run lint and tests**

Run: `npm run lint && npm test`
Expected: no errors.

---

## Notes / deliberate simplifications (ponytail)

- `education_summary` remains a text column storing a single level string; no schema change. A real `education_level` enum/FK is deliberately not added (ADR-046 cut).
- Structured `education` table entries (registration) are unchanged; profile does not gain add/remove UI for them (YAGNI).
- "Training Provided" tag and "Training & Development" benefit left as job attributes; remove separately if wanted.
- Legacy free-text `education_summary` values won't match any select option and will render blank — acceptable migration (user re-selects).

---

**Plan complete. Please review. Does it capture what you want?**