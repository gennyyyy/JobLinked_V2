# Free-Form Skills — Implementation Plan

> **For agentic workers:** implement one task per dispatch. Read this whole file before editing. Do not revert other agents' uncommitted work in the tree.

**Goal:** Any trimmed text typed as a skill is accepted and saved — seeker profile, signup, and employer job postings. PESO's `reference_data` skill list becomes autocomplete + canonical casing only, not a gate.

**Architecture:** One server validation change (`canonicalizeSkills`) shared by profile PATCH and job create/update; the three UIs stop dropping unlisted chips, showing the "Unrecognized skills… not saved" note, and filtering resume autofill. No schema or response-shape change.

**Tech Stack:** Express + PostgreSQL (`server/`), React JSX + Vite + Vitest/RTL (`src/`).

**Confirmed brief:** 2026-11-25, user-approved. Supersedes the "recognized skills only" behavior recorded in `docs/plan/done/2026-11-21-profile-skills-tag-box.md`.

## Global Constraints

- Accept any non-blank trimmed skill string, including gibberish.
- Keep limits: blanks ignored; case-insensitive dedupe; max 20 (`MAX_SKILLS`); listed values stored in PESO's canonical casing; unlisted values stored as typed.
- No database schema or migration change. No API request/response shape change.
- Out of scope: `field` vocabulary, job tags, matching weights, reference-data seeds, signup server-side cap (signup already accepts free text and stays as-is).
- JavaScript/JSX only. Follow nearby code style.

## Review Focus

- Mixed list `['ms excel', 'Underwater Basket Weaving']` → `['MS Excel', 'Underwater Basket Weaving']` (listed canonical, unlisted raw).
- 21 distinct skills still returns the `at most 20` 400, not a silent truncation.
- All-blank / null entries still succeed with an empty list and never 500.
- A previously stored unlisted value can be re-submitted unchanged (legacy rows stay editable).
- Autofill must not push a form past 20 chips when the user already picked some.

---

## Task 1 — Server: accept unlisted skills

**Files:**
- Modify: `server/src/vocabulary.js`
- Modify: `server/src/vocabulary.test.js`
- Modify: `server/src/routes/profiles.field-skills.test.js`
- Modify: `server/src/routes/jobs.field-skills.test.js`

**Interfaces:**
- Produces: `canonicalizeSkills(list) -> { ok: true, value: string[] } | { ok: false, tooMany: true }` (no `invalid` result).
- Produces: `validateJobVocabulary(body) -> { ok: true, values: { field?, skills? } } | { ok: false, message }`; skills failures are now only non-array and tooMany.

- [ ] **Step 1: Change `canonicalizeSkills` in `server/src/vocabulary.js`**

For each trimmed non-blank unique entry push `vocab.skill.get(key) ?? typed` instead of returning `{ ok: false, invalid: raw }`. Keep the `seen` dedupe and the `out.length > MAX_SKILLS` → `{ ok: false, tooMany: true }` check. Update the comment above it: unlisted skills are kept as typed; the vocabulary only supplies canonical casing. In `validateJobVocabulary`, the failure message for skills becomes only the tooMany branch (`skills must contain at most ${MAX_SKILLS} values`); remove the `skills contains an unknown value` branch.

- [ ] **Step 2: Update `server/src/vocabulary.test.js`**

- The "ignores blank entries and names the first unknown value" test becomes "ignores blank entries and keeps unlisted values as typed":
  - `canonicalizeSkills(['', null, 'driving', '  '])` → `{ ok: true, value: ['Driving'] }` (unchanged)
  - `canonicalizeSkills(['MS Excel', 'Underwater Basket Weaving'])` → `{ ok: true, value: ['MS Excel', 'Underwater Basket Weaving'] }`
- In the `validateJobVocabulary` contract-failure test, replace the unknown-value expectation with an accepted value:
  - `validateJobVocabulary({ skills: ['Astrology'] })` → `{ ok: true, values: { skills: ['Astrology'] } }`
  - Keep the field-unknown and non-array expectations.

- [ ] **Step 3: Run the unit test**

Run: `npx vitest run server/src/vocabulary.test.js`
Expected: all tests pass.

- [ ] **Step 4: Flip the route tests**

`server/src/routes/profiles.field-skills.test.js`:
- Replace the "400s an unknown skill…" test with one that PATCHes `['MS Excel', 'Underwater Basket Weaving']`, expects `200`, and expects the update params to be `[SEEKER, ['MS Excel', 'Underwater Basket Weaving']]`.
- Keep the 20-cap and non-array tests unchanged.

`server/src/routes/jobs.field-skills.test.js`:
- `POST` with `['MS Excel', 'Underwater Basket Weaving']` now expects success (match the file's existing successful-create expectations, including any required employer setup) and the inserted skills param to contain both values.
- `PATCH /api/jobs/:id` with `skills: ['Farming']` expects success and the update params to store `['Farming']`.
- `PATCH /api/admin/jobs/:id` with `skills: ['Farming']` expects success and stores `['Farming']`.
- Keep the field-unknown, 20-cap, and non-array tests unchanged.

- [ ] **Step 5: Run the route tests**

Run: `npx vitest run server/src/routes/profiles.field-skills.test.js server/src/routes/jobs.field-skills.test.js`
Expected: all pass.

- [ ] **Step 6: Lint and report**

Run: `npx eslint server/src/vocabulary.js server/src/vocabulary.test.js server/src/routes/profiles.field-skills.test.js server/src/routes/jobs.field-skills.test.js`
Expected: no errors. Report changed files and the exact test output.

**Acceptance:** any unlisted skill round-trips through `PATCH /api/seekers/me`, `POST/PATCH /api/jobs`, and the admin job PATCH; listed values keep canonical casing; the 20 cap still rejects.

---

## Task 2 — Client: stop filtering skills

**Files:**
- Modify: `src/features/job-seeker/Profile.jsx`
- Modify: `src/features/employer/JobPostFormDialog.jsx`
- Modify: `src/features/auth/useResumeAutofill.js`
- Modify: `src/features/auth/JobSeekerRegister.jsx`
- Modify: `src/features/auth/JobSeekerBackgroundStep.jsx`
- Modify: `src/shared/utils/resumeAutofill.js`
- Modify tests: `src/features/job-seeker/__tests__/Profile.skills.test.jsx`, `src/features/job-seeker/__tests__/Profile.address.test.jsx`, `src/features/auth/__tests__/JobSeekerRegister.test.jsx`
- Verify (no change expected): `src/features/job-seeker/__tests__/ProfileResumeAutofill.test.jsx`, `src/features/employer/__tests__/JobPostFormDialog.vocabulary.test.jsx`

**Interfaces:**
- Consumes: Task 1 server now accepts unlisted skills.
- Produces: profile/job payloads include every chip; resume autofill appends every detected skill up to 20.

- [ ] **Step 1: `Profile.jsx`**

- Remove the `getReferenceValues` and `matchSkills` imports (no other use remains).
- Keep `skillByLower` / `skillChips` (they canonicalize known values for display and payload). Delete the `matchSkills` destructure (`recognizedSkills`, `unrecognizedSkills`).
- `validate()`: replace the vocabulary loading/error/recognized branches with a single check — if `!skillChips.length`, `next.skills = 'Add at least one skill.'`
- PATCH: send `skills: skillChips` (not `recognizedSkills`).
- `applyAutofill`: delete the `getReferenceValues('skill')` + `matchSkills` block; append `splitList(details.skills)` as typed, skipping case-insensitive duplicates and stopping when the list reaches 20. Remove the now-stale comment about recognized/unrecognized.
- Delete the "Unrecognized skills: … They are not in PESO's list, so they are not saved." paragraph.

- [ ] **Step 2: `JobPostFormDialog.jsx`**

- Remove the `matchSkills` import and the `unrecognizedSkills` derivation.
- Keep `skillByLower` / `skillChips` canonicalization and `updateSkills`.
- Delete the unrecognized-skills paragraph.
- Change the skills help copy to say PESO's list suggests skills but any typed skill counts (drop "Only these skills count towards matching.").

- [ ] **Step 3: `useResumeAutofill.js`**

- Remove the `getReferenceValues` and `matchSkills` imports and the `unrecognizedSkills` state.
- Build the detected list directly from `mapped.skills` and append all of them, case-insensitively deduped against existing chips, capped at 20 total.
- Use the full detected list for `skillsAdded` and the `touchedKeys` `skills` entry so the autofill status still reports Skills.
- Return only `{ autofillStatus, touched, handleResumeChange }`.

- [ ] **Step 4: Signup components**

- `JobSeekerRegister.jsx`: stop destructuring and passing `unrecognizedSkills`.
- `JobSeekerBackgroundStep.jsx`: remove the `unrecognizedSkills` prop and its note block; add `max={20}` to the Skills `TagField`.

- [ ] **Step 5: Delete dead helper**

- Remove `matchSkills` and its comment from `src/shared/utils/resumeAutofill.js`. Leave `mapResumeText` and `mapSkills` untouched. Confirm no references remain (`grep matchSkills src`).

- [ ] **Step 6: Update the client tests**

`Profile.skills.test.jsx`:
- The unlisted-chip test now expects the save to succeed with `skills: ['MS Excel', 'Underwater Basket Weaving']` and no note.
- Replace the "blocks saving when no chip matches PESO's list" test: with zero chips, saving shows `Add at least one skill.` and does not call `updateProfile`; add a case where a gibberish-only chip saves with that chip in the payload.
- The autofill test now expects `UpdateProfile` skills `['MS Excel', 'Welding', 'Underwater Basket Weaving']` and no note.

`Profile.address.test.jsx`: change the expected message to `Add at least one skill.`

`JobSeekerRegister.test.jsx`:
- The first autofill test now expects `Welding` to appear as a chip (it is unlisted in that fixture).
- The "lists a resume skill outside the vocabulary without sending it" test becomes "sends a resume skill outside the vocabulary": no note, the unlisted chip is visible, and `parked().skills` equals `['Data Entry', 'Communication', 'Underwater Basket Weaving']` (match the actual detected order).

- [ ] **Step 7: Run the client tests**

Run:
`npx vitest run src/features/job-seeker/__tests__/Profile.skills.test.jsx src/features/job-seeker/__tests__/Profile.address.test.jsx src/features/job-seeker/__tests__/ProfileResumeAutofill.test.jsx src/features/auth/__tests__/JobSeekerRegister.test.jsx src/features/employer/__tests__/JobPostFormDialog.vocabulary.test.jsx`
Expected: all pass.

- [ ] **Step 8: Lint and report**

Run: `npm run lint`
Expected: clean. Report changed files and the exact test output.

**Acceptance:** typing or autofilling any skill text produces a chip that is sent in the PATCH/create payload; the note is gone; profile still requires at least one skill; all listed test files and lint pass.
