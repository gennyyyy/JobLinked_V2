# Display Capitalization Plan (denormalized view layer)

> **Implemented 2026-11-12** — `titleCase` handles particles, ordinals, and Roman numerals; applied
> across display surfaces and profile edit inputs (names, company names, addresses, education
> history). Tests, lint, and build green.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show names, company names, and address fields to users with proper capitalization (title case) instead of the lowercase stored in the database, while preserving lowercase for search/matching. Handle particles ("the", "de", "del", "van", "von", …) and ordinal suffixes ("the third", "second") correctly, and keep Roman numerals upper-case ("III", "II", "IV"). No schema changes.

**Architecture:** The database stores names/addresses/company names in lowercase (via `LOWERCASE_FIELDS` in `server/src/routes/profiles.js`) so search and matching stay case-insensitive. Display is a *view-layer* concern: a single `titleCase()` helper (already in `src/shared/utils/titleCase.js`) is applied at render time in the components that show these fields. We do NOT add a `display_name` column — that would duplicate state, risk staleness, and violate ADR-046's normalization floor. The helper is the single source of the capitalization rule.

**Tech Stack:** React/JSX, Vitest + Testing Library. No new dependencies.

**Spec:** User request 2026-11-12 ("denormalize the data for displaying data to users … proper capitalization … mindful of prefix like 'the third'").

## Global Constraints

- No DB schema changes. No new columns. Lowercase stays the storage form.
- Single source of truth for capitalization: `src/shared/utils/titleCase.js`. Do not inline ad-hoc `.charAt(0).toUpperCase()` anywhere.
- Roman numerals (I, II, III, IV, V, VI, VII, VIII, IX, X) stay upper-case.
- Particles (the, of, de, del, la, las, los, van, von, der, da, do, dos, das, le, les, du, des, di, et) stay lowercase unless they are the first word.
- Ordinal words (second, third, fourth, fifth, sixth, seventh, eighth, ninth, tenth) stay lowercase unless first word.
- Emails, URLs, skills/tags (lowercase matching tokens), and enum values (statuses, employment types) are NOT title-cased.
- `titleCase(null/undefined/'')` returns `''`.

## Review Focus

- A naive first-char capitalization turns "iii" into "Iii" (wrong) and "the third" into "The Third" (unwanted). The helper must handle both.
- Stored legacy free-text values must not crash when title-cased.
- a11y tests assert label text, not values; value assertions must use the title-cased form.
- Search/filter inputs must keep raw lowercase (do not title-case query strings).

---

### Task 1: Improve `titleCase` for particles and ordinals

**Files:**
- Modify: `src/shared/utils/titleCase.js`
- Modify: `src/shared/utils/__tests__/titleCase.test.js`

**Interfaces:**
- Consumes: none.
- Produces: `titleCase(value: string | null | undefined) -> string`.

- [ ] **Step 1: Add failing tests**

Add to `titleCase.test.js`:
```js
it('keeps particles lowercase unless first word', () => {
  expect(titleCase('juan de la cruz')).toBe('Juan de la Cruz')
  expect(titleCase('maria van der berg')).toBe('Maria van der Berg')
  expect(titleCase('the duke')).toBe('The Duke') // first word stays capped
})
it('keeps ordinal suffixes lowercase', () => {
  expect(titleCase('john smith the third')).toBe('John Smith the third')
  expect(titleCase('jane doe second')).toBe('Jane Doe second')
})
it('keeps roman numerals upper-case (existing)', () => {
  expect(titleCase('jose iii')).toBe('Jose III')
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- titleCase`
Expected: FAIL (particles/ordinals not handled).

- [ ] **Step 3: Implement**

Rewrite `titleCase.js`:
```js
const UPPER_TOKENS = new Set(['i','ii','iii','iv','v','vi','vii','viii','ix','x']);
const LOWER_TOKENS = new Set(['the','of','de','del','la','las','los','van','von','der','da','do','dos','das','le','les','du','des','di','et','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth']);

export function titleCase(value) {
  if (value == null) return '';
  const str = String(value);
  if (!str) return '';
  const words = str.toLowerCase().split(/(\s+|[-'])/); // keep separators
  // Simpler: operate on tokens separated by spaces/hyphens/apostrophes
  return str
    .toLowerCase()
    .replace(/[^\s\-']+/g, (w, offset, full) => {
      if (UPPER_TOKENS.has(w)) return w.toUpperCase();
      // first word of the whole string stays capitalized
      const isFirst = offset === 0 || /[\s\-']$/.test(full.slice(0, offset));
      if (isFirst) return w.charAt(0).toUpperCase() + w.slice(1);
      if (LOWER_TOKENS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
}
```

Adjust to pass the tests. Keep hyphen/apostrophe handling (Maria-Clara, D'Cruz).

- [ ] **Step 4: Run tests**

Run: `npm test -- titleCase`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/titleCase.js src/shared/utils/__tests__/titleCase.test.js
git commit -m "feat(titleCase): particles and ordinals stay lowercase; roman numerals stay upper"
```

---

### Task 2: Document the display convention

**Files:**
- Modify: `src/shared/utils/titleCase.js` (add a header comment listing the rule and the "do not use for emails/skills/enums" note).

- [ ] **Step 1: Add comment block** at top of file.
- [ ] **Step 2: Commit**.

---

### Task 3: Apply `titleCase` to the seeker profile display

**Files:**
- Modify: `src/features/job-seeker/Profile.jsx` (display of full_name, address fields, company-less seeker fields)
- Modify: `src/features/job-seeker/__tests__/Profile.a11y.test.jsx` (value assertions if any)

Scope: render `titleCase(form.first_name)`, `titleCase(form.city_municipality)`, etc. in read-only/display spots. Form inputs keep raw (lowercase) values so the user can edit; only display/preview spots get titleCase.

- [ ] **Step 1: Identify display spots** (grep `form.first_name`, `form.last_name`, address fields in Profile.jsx).
- [ ] **Step 2: Wrap display values with titleCase**.
- [ ] **Step 3: Run `npm test -- Profile`**.
- [ ] **Step 4: Commit**.

---

### Task 4: Apply `titleCase` to job cards and job detail

**Files:**
- Modify: `src/shared/components/JobCard.jsx`
- Modify: `src/features/job-seeker/JobDetail.jsx`
- Modify: `src/features/public-site/PublicJobDetail.jsx`
- Modify: `src/features/public-site/PublicJobs.jsx`

Wrap `job.title`, `company_name`, `location` display with titleCase. Keep search/filter inputs raw.

- [ ] Steps as above; run `npm test -- JobCard JobDetail PublicJob`.

---

### Task 5: Apply `titleCase` to application lists (seeker + employer + admin)

**Files:**
- Modify: `src/features/job-seeker/Applications.jsx`
- Modify: `src/features/employer/Applicants.jsx`
- Modify: `src/features/super-admin/Applications.jsx`

Wrap seeker full_name, job title, company name in display.

---

### Task 6: Apply `titleCase` to admin tables and dashboards

**Files:**
- Modify: `src/features/super-admin/UserManagement.jsx`
- Modify: `src/features/super-admin/Employment.jsx`
- Modify: `src/features/super-admin/Accreditation.jsx`
- Modify: `src/features/super-admin/Dashboard.jsx`
- Modify: `src/features/employer/Dashboard.jsx`
- Modify: `src/features/job-seeker/Dashboard.jsx`
- Modify: `src/shared/components/SeekerProfileCard.jsx`
- Modify: `src/shared/components/SidebarAccount.jsx`

---

### Task 7: Apply `titleCase` to employer company profile display

**Files:**
- Modify: `src/features/employer/CompanyProfile.jsx`

Wrap company_name, representative names, address fields in display spots (not inputs).

---

### Task 8: Apply `titleCase` to auth/onboarding display spots

**Files:**
- Modify: `src/features/auth/EmployerStatus.jsx`
- Modify: `src/features/auth/CompleteRegistration.jsx` (if it shows names)

---

### Task 9: Sweep remaining display surfaces

**Files:** the ~46 files in `src/` that render name/address/company fields but don't yet call titleCase (per grep).

- [ ] **Step 1: Grep** for `full_name|company_name|first_name` in JSX display (not inputs/forms).
- [ ] **Step 2: Apply titleCase** to each display spot.
- [ ] **Step 3: Run `npm test`**.
- [ ] **Step 4: Commit**.

---

### Task 10: Full verification

- [ ] **Step 1: Run `npm run lint && npm test && npm run build`**.
- [ ] **Step 2: Commit** (if any remaining).

---

## Notes / deliberate simplifications (ponytail)

- Display-layer only: DB stays lowercase. No schema change, no sync burden, ADR-046 untouched.
- `titleCase` is a heuristic; exotic names (McDonald, O'Brien, hyphenated) may need manual overrides later. Add a `display_name` override column only if measured pain appears.
- Skills/tags stay lowercase (they are matching tokens, not display names).
- Emails, URLs, enums never title-cased.
- Form inputs keep raw lowercase so the user can edit; titleCase applies to read-only/display spots and previews.

---

**Plan complete. Please review. Does it capture what you want?**
```diff
+ Done — wrote display-capitalization plan to docs/plan/2026-11-12-display-capitalization-plan.md.
```