# Profile Skills Tab — Implementation Plan

> **For agentic workers:** implement this task in one dispatch. Do not revert other agents' uncommitted work in the tree.

**Goal:** Give skills their own tab on the job-seeker profile. The Skills tab holds Field, Your Skills, and Work Experience; the Education tab holds only education history.

**Architecture:** `PROFILE_TABS` is data-driven and `Profile.jsx` renders one `TabsContent` per value. Move the existing matching-input block into a new `skills` tab and leave the education-history block in `education`. The single global Save button still saves the whole profile.

**Tech Stack:** React JSX, Radix tabs, Vitest + Testing Library.

**Confirmed brief:** 2026-11-25, user-approved. Tab order: Personal, Address, Skills, Education, My resumes, Account settings.

## Global Constraints

- No server, API, schema, validation-rule, autofill-logic, or styling-system changes.
- Keep the global save button and its existing behavior; only add the failed-save tab jump described below.
- JavaScript/JSX only. Follow nearby code style.
- The worktree has uncommitted changes from other agents (toasts, resume menus, etc.). Preserve them.

## Review Focus

- Tab labels and order: Personal, Address, Skills, Education, My resumes, Account settings.
- Skills tab contains Field, Your Skills, Work Experience; Education contains no Field/Skills/Work Experience input.
- A failed save from any tab lands on the tab that owns the first error, so required messages are not hidden.
- Education add/remove and status still work on the Education tab.
- Resume autofill still puts skills chips on the Skills tab and education details on the Education tab.

---

## Task — Split the tab

**Files:**
- Modify: `src/features/job-seeker/Profile.jsx`
- Modify: `src/features/job-seeker/__tests__/Profile.skills.test.jsx`
- Modify: `src/features/job-seeker/__tests__/Profile.address.test.jsx`
- Modify: `src/features/job-seeker/__tests__/Profile.a11y.test.jsx`
- Modify: `src/features/job-seeker/__tests__/ProfileResumeAutofill.test.jsx`

**Interfaces:**
- Produces: tab values `personal | address | skills | education | resumes | account`.
- Produces: failed `validate()` switches to `personal` (name/phone), `address` (barangay/address), `skills` (skills), or `education` (education), in that order.

- [ ] **Step 1: Tab definitions**

In `PROFILE_TABS`, insert before the education entry:

```js
{ value: 'skills', label: 'Skills', title: 'Skills, field & work experience', description: 'These details power simple, transparent skill matching.' },
```

Retitle the education entry:

```js
{ value: 'education', label: 'Education', title: 'Education history', description: 'Your schools, attainment, and graduation details.' },
```

- [ ] **Step 2: Move the markup**

Add `<TabsContent value="skills">` before the education content. Move the current education-tab block that contains `VocabularyPicker` (Field), the Skills `TagField` with its vocabulary loading/error messages, and the Work Experience `TagField` into it.

Leave in `<TabsContent value="education">`: the Education Status box, the saved education list, and the add-education form. Remove the now-unneeded `border-t ... pt-4` separator wrapper from the education history block so the tab starts cleanly.

- [ ] **Step 3: Jump to the first error tab**

At the end of `validate()`, after `setErrors(next)`, when `next` is non-empty choose the first matching tab and `setTab(...)`:

- `next.name || next.phone` → `personal`
- else `next.barangay || next.address` → `address`
- else `next.skills` → `skills`
- else `next.education` → `education`

No other validation change.

- [ ] **Step 4: Update `Profile.skills.test.jsx`**

- Rename the `openEducation` helper to `openSkills` and click the `/skills/i` tab instead of `/education/i`.
- In the autofill test, click `/skills/i` after applying the resume (the education assertions there are not used).
- All skill/field/work-experience interactions now happen on the Skills tab.

- [ ] **Step 5: Update `Profile.address.test.jsx`**

- In the first test, after the Education tab assert only the education status/list (`Completed — College`, `Business · Graduated 2022`); click `/skills/i` for `Work Experience`, `Cashier`, `2 years`, and the skill chip.
- In "saves the edited details", click `/skills/i` before typing the skill.
- In "blocks the save and explains what is missing", the save now auto-switches to the tab with the first error. Update the sequence: after save expect `Enter your full name.` on Personal, then Address for `Choose your barangay.`, then Skills for `Add at least one skill.`, then Education for `Add your education history.`.
- Other education-tab tests (add/remove, status, load error) are unchanged.

- [ ] **Step 6: Update the accessibility and autofill tests**

`Profile.a11y.test.jsx`:
- Include `/skills/i` in the tab-presence loop.
- On the Skills tab assert `Work Experience` and the `Your Skills` combobox.
- On the Education tab assert the `Level` combobox.

`ProfileResumeAutofill.test.jsx`:
- On the Education tab assert the `Level` value.
- Click `/skills/i` to assert the `Remove Data Entry` / `Remove Communication` buttons.

- [ ] **Step 7: Run the profile tests**

Run:

`npx vitest run src/features/job-seeker/__tests__/Profile.skills.test.jsx src/features/job-seeker/__tests__/Profile.address.test.jsx src/features/job-seeker/__tests__/Profile.a11y.test.jsx src/features/job-seeker/__tests__/ProfileResumeAutofill.test.jsx src/features/job-seeker/__tests__/Profile.barangay.test.jsx src/features/job-seeker/__tests__/ProfileResumeUpload.test.jsx src/features/job-seeker/__tests__/ProfileResumeDelete.test.jsx`

Expected: all pass.

- [ ] **Step 8: Lint and report**

Run: `npm run lint`
Expected: clean. Report changed files and exact test output.

**Acceptance:** tabs appear in the confirmed order; Skills holds Field + Your Skills + Work Experience; Education holds only education history; failed save moves to the first error tab; listed tests and lint pass.
