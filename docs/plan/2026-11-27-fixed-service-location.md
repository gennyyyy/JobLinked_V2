# Fixed Service Location (Santa Maria, Bulacan) Implementation Plan

> **For agentic workers:** Implement task-by-task with the `subagent` tool (one agent per task, in order). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Province and City/Municipality become fixed read-only values — Bulacan and Santa Maria — on every address surface, and the Express API clamps both fields on every write.

**Architecture:** Server owns the invariant (clamp at the two write boundaries); the UI only reflects it (disabled, prefilled selects). No schema change. See `docs/arch/adr-062-fixed-service-location.md`.

**Tech Stack:** React 18 + JSX, Express, Vitest + Testing Library, PostgreSQL (untouched).

**Spec:** `docs/arch/adr-062-fixed-service-location.md`

## Global Constraints

- Fixed values: Province = `Bulacan`, City/Municipality = `Santa Maria` (display case on the client).
- Server stores lowercase `'santa maria'` / `'bulacan'` (existing `LOWERCASE_*` convention).
- JavaScript/JSX only, Tailwind tokens, API calls stay in `src/shared/services/`.
- Postal code stays editable/optional. Barangay unchanged. No `db/schema.sql` change.
- One dev server already may be running on :4000 — reuse, never start a second (see AGENTS.md global rules).

## Review Focus

- A modified client sends `province_state: 'Cebu'` → server must still store `'bulacan'`/`'santa maria'`. Pinned by `auth.pending-signup.test.js` (Task 3).
- A PATCH that does not include address keys must behave exactly as before (including "Nothing to update"). Pinned by existing `profiles.*.test.js` — must keep passing unmodified.
- A legacy row stored as `'Angat'` → edit form shows `'Santa Maria'`; saving rewrites the row. Pinned by `Profile.address.test.jsx` (Task 4).
- Disabled selects have no onChange — `fireEvent.change` in tests is a no-op; helpers must not depend on it. Pinned by registration lock tests (Task 2).
- Stored values stay lowercase server-side. Pinned by the pending-signup assertions.

---

### Task 1: Constants + registration lock (both signup flows)

**Files:**
- Modify: `src/shared/constants.js` (~line 130, after `BULACAN_PROVINCES`)
- Modify: `src/features/auth/jobSeekerRegistration.js` (EMPTY_FORM lines 22-23)
- Modify: `src/features/auth/EmployerRegister.jsx` (EMPTY_FORM line 23)
- Modify: `src/features/auth/JobSeekerAddressStep.jsx` (lines 13-31)
- Modify: `src/features/auth/EmployerCompanyStep.jsx` (lines 47-61)
- Test: `src/features/auth/__tests__/JobSeekerRegister.test.jsx`, `src/features/auth/__tests__/EmployerRegister.test.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `FIXED_PROVINCE = 'Bulacan'`, `FIXED_MUNICIPALITY = 'Santa Maria'` exported from `src/shared/constants.js`; later tasks import these.

- [ ] **Step 1: Update the registration tests first (they should fail)**

In `EmployerRegister.test.jsx`: delete the test "requires city and province" (lines ~206-215 — clearing a locked field is now impossible) and replace with:

```jsx
it('locks province and city to Bulacan / Santa Maria', async () => {
  renderPage()
  const province = screen.getByLabelText(/province/i)
  const city = screen.getByLabelText(/city \/ municipality/i)
  expect(province).toBeDisabled()
  expect(city).toBeDisabled()
  expect(province).toHaveValue('Bulacan')
  expect(city).toHaveValue('Santa Maria')
})
```

Remove the province/city `fireEvent.change` lines from the step-1 fill helper (~line 77).

In `JobSeekerRegister.test.jsx`: remove the city/province `fireEvent.change` lines from `fillRequired` (~lines 116-119), add the same lock assertion (navigate to the address step first, as the existing helpers do). Leave `termsGate.test.jsx` and `scrollToError.test.jsx` untouched (their province `fireEvent.change` becomes a harmless no-op).

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/features/auth/__tests__/EmployerRegister.test.jsx src/features/auth/__tests__/JobSeekerRegister.test.jsx`
Expected: FAIL — selects not disabled, values empty.

- [ ] **Step 3: Implement**

`src/shared/constants.js`, after `BULACAN_PROVINCES`:

```js
// Fixed service scope: the portal serves Santa Maria, Bulacan only (ADR-062).
export const FIXED_PROVINCE = 'Bulacan';
export const FIXED_MUNICIPALITY = 'Santa Maria';
```

`jobSeekerRegistration.js` EMPTY_FORM + `EmployerRegister.jsx` EMPTY_FORM:

```js
cityMunicipality: FIXED_MUNICIPALITY, provinceState: FIXED_PROVINCE,
```

In both step components: replace the two `<FormSelect>` blocks (province, city) with a disabled select carrying exactly one fixed option and no `onChange` — e.g. province:

```jsx
<FormSelect id="provinceState" name="provinceState" value={FIXED_PROVINCE} disabled className={inputClass}>
  <option value={FIXED_PROVINCE}>{FIXED_PROVINCE}</option>
</FormSelect>
```

City uses `FIXED_MUNICIPALITY` the same way. Delete the now-unreachable `{errors.provinceState…}` / `{errors.cityMunicipality…}` paragraphs and the `BULACAN_MUNICIPALITIES` import where it becomes unused. Keep labels and the `reqMark`.

- [ ] **Step 4: Run to verify tests pass**

Run: `npx vitest run src/features/auth`
Expected: PASS, including the pre-existing payload tests that expect lowercase `city_municipality: 'santa maria'`, `province_state: 'bulacan'` (the client service already lowercases; prefill satisfies it).

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants.js src/features/auth
git commit -m "Lock registration province and city to Bulacan / Santa Maria"
```

### Task 2: Server clamps (signup + profile PATCH)

**Files:**
- Modify: `server/src/routes/auth.js` (provision handler, after the `PERSON` allowlist loop ends at line 123)
- Modify: `server/src/routes/profiles.js` (PATCH handler in `meRoutes`, after the allowlist loop ends at line 71)
- Test: `server/src/routes/auth.pending-signup.test.js` (~lines 150-210)

**Interfaces:**
- Consumes: nothing.
- Produces: invariant — no write path can persist any other province/city. Payload shape unchanged.

- [ ] **Step 1: Update the server test first (it should fail)**

In `auth.pending-signup.test.js`, keep sending garbage in the fixture (line 167: `city_municipality: 'Cebu City', province_state: 'Cebu'`) but assert the STORED row carries the clamped values: at ~line 202 expect `city_municipality: 'santa maria'` and `province_state: 'bulacan'`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/src/routes/auth.pending-signup.test.js`
Expected: FAIL — row stores the raw `Cebu` values.

- [ ] **Step 3: Implement**

`auth.js` provision handler, immediately after the `PERSON` loop (after line 123):

```js
// Fixed service scope: Santa Maria, Bulacan only (ADR-062). Lowercase to
// match the LOWERCASE_PERSON convention these two keys already follow.
person.city_municipality = 'santa maria';
person.province_state = 'bulacan';
```

`profiles.js` PATCH handler, immediately after the allowlist loop (after line 71):

```js
// Fixed service scope: Santa Maria, Bulacan only (ADR-062).
if (patch.city_municipality !== undefined) patch.city_municipality = 'santa maria';
if (patch.province_state !== undefined) patch.province_state = 'bulacan';
```

- [ ] **Step 4: Run to verify tests pass**

Run: `npx vitest run server/src/routes`
Expected: PASS — including `profiles.field-skills.test.js` (asserts SQL shape only) and every other route test.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.js server/src/routes/profiles.js server/src/routes/auth.pending-signup.test.js
git commit -m "Clamp province and city to Santa Maria, Bulacan on signup and profile PATCH"
```

### Task 3: Lock the profile edit forms + resume builder

**Files:**
- Modify: `src/features/employer/CompanyProfile.jsx` (load lines 145-146; selects lines 468-485; drop `BULACAN_MUNICIPALITIES`/`BULACAN_PROVINCES` imports if unused)
- Modify: `src/features/job-seeker/Profile.jsx` (load lines 96-97; selects lines 667-670)
- Modify: `src/features/auth/CreateResumeModal.jsx` (Inputs lines 186-191)
- Test: `src/features/employer/__tests__/CompanyProfile.address.test.jsx`, `src/features/job-seeker/__tests__/Profile.address.test.jsx`

**Interfaces:**
- Consumes: `FIXED_PROVINCE`, `FIXED_MUNICIPALITY` (Task 1). Server clamps (Task 2) as backstop.
- Produces: edit forms always display and save the fixed values; legacy rows normalize on save.

- [ ] **Step 1: Update the address tests first (they should fail)**

`CompanyProfile.address.test.jsx`:
- "renders city and province as dropdowns with the Bulacan options" (~line 85) → assert both selects are `toBeDisabled()` with values `'Santa Maria'` / `'Bulacan'`.
- "loads the stored city, province, and postal code" (~line 57) → assert fixed values render (regardless of the stored fixture).
- "saves the selected city, province, and postal code" (~line 67) → drop the city/province `fireEvent.change` (`'Angat'`); keep the postal change; expect the saved payload to carry `city_municipality: 'Santa Maria'`, `province_state: 'Bulacan'`.

`Profile.address.test.jsx`:
- "renders city and province as dropdowns with the Bulacan options" (~line 333) → disabled + fixed values.
- "loads listed stored city and province into the dropdowns" (~line 346) → fixed values render.
- "loads an out-of-list city and province as blanks and blocks the save" (~line 358) → INVERTS: stored `Quezon City`/`Metro Manila` now renders `Santa Maria`/`Bulacan` and save succeeds sending the fixed values.
- "saves the picked city and province" (~line 377) → drop the change events; expect fixed values in the payload.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/employer/__tests__/CompanyProfile.address.test.jsx src/features/job-seeker/__tests__/Profile.address.test.jsx`
Expected: FAIL — fields still editable dropdowns.

- [ ] **Step 3: Implement**

`CompanyProfile.jsx` load (lines 145-146):

```js
city_municipality: FIXED_MUNICIPALITY,
province_state: FIXED_PROVINCE,
```

`Profile.jsx` load (lines 96-97): `cityMunicipality: FIXED_MUNICIPALITY, provinceState: FIXED_PROVINCE`.

In both files replace the city/province `SelectField`s with disabled fixed selects (the shared `SelectField` in `src/shared/components/design.jsx` spreads `...props`, so `disabled` passes through) — value fixed to the constant, `options={[FIXED_MUNICIPALITY]}` / `options={[FIXED_PROVINCE]}`, no `onChange`, no placeholder. Keep labels, `required`, and remove the now-dead `error` props for these two fields. `pickListed` stays if still used for other fields; drop unused constant imports (lint enforces).

`CreateResumeModal.jsx` lines 186-191: add `readOnly` to the `cityMunicipality` and `provinceState` inputs (values flow from the registration form prefill).

- [ ] **Step 4: Run to verify tests pass**

Run: `npx vitest run src/features/employer src/features/job-seeker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/employer src/features/job-seeker src/features/auth/CreateResumeModal.jsx
git commit -m "Lock profile and resume builder province and city to Bulacan / Santa Maria"
```

### Task 4: Full verification

- [ ] **Step 1: Whole suite**

Run: `npm test`
Expected: all suites pass. (Shared `resumeAutofill.test.js` must remain untouched and green — the extraction util stays general; only the *stored* values are clamped.)

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean (unused imports removed in Task 3).

- [ ] **Step 3: Manual smoke (only if the :4000 dev server is already running; otherwise run `npm run dev:web` once)**

Register a new job seeker: province/city disabled and pre-filled; submit; verify stored row via the app (not psql). Register an employer the same way.

- [ ] **Step 4: Final commit / handoff report**

Report which verification commands ran and their output. The plan is then complete.
