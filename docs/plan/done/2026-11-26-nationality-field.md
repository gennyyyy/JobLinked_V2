# Job Seeker Nationality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required `nationality` field to job seeker registration and the job seeker Profile page, persisting through sign-up/provision and profile PATCH.

**Architecture:** Additive column on `job_seekers` only; no new endpoint. The existing sign-up → `pending_signups` → `/api/auth/provision` path carries the value, and the existing `PATCH /api/seekers/me` persists edits. Registration and Profile both default the input to `"Filipino"`.

**Tech Stack:** React 19 + Vite (JS/JSX), Express + `pg`, PostgreSQL, Vitest.

**Spec:** this file — § Confirmed brief (user approved 2026-11-26).

## Global Constraints

- JavaScript/JSX only; no TypeScript.
- Tests: `npm test` (runs client + server projects) and `npm run lint` from repo root.
- `db/schema.sql` and `db/migrations/*` are architect-owned. Backend/frontend agents must not edit them; Task 1 is already complete.
- Do not add new endpoints, reference data, ADRs, or validation libraries.
- `nationality` is stored as typed (trimmed), never lowercased — unlike address fields.
- All existing tests must keep passing.

## Confirmed Brief

- Scope: **job seeker only**. Employer registration, `CompanyProfile`, and `super_admins` are untouched.
- Input: **required free text, prefilled `"Filipino"`**, trimmed, cannot be blank.
- Registration audit result: every user-entered registration field already exists in Profile (names, birthday, phone, lot/block, street, subdivision, barangay, city, province, postal code, employment status, field, skills, education). Email/password live in Account settings; consent is recorded server-side. `country` is auto-set `"Philippines"` and never user-entered, so it stays out of the UI.
- Out of scope: employer nationality, country field in Profile, nationality lists/reference data, matching/reporting use.

## Ownership Sign-off

Task 1 (schema) is approved and done by the architect. Tasks 2–3 may implement against the contract below. Any further schema change needs a new sign-off.

## Data Model

`db/migrations/022_nationality.sql` (done):

```sql
alter table public.job_seekers
  add column if not exists nationality text not null default 'Filipino';
```

`db/schema.sql` (done): column added after `country` in the `job_seekers` create table, plus an idempotent `alter table ... add column if not exists` in the existing incremental block.

Notes:
- Existing rows read `Filipino` immediately; no backfill statement needed.
- Apply with `DATABASE_URL=... ./db/apply-migrations.sh` (or `psql -d joblinked -f db/migrations/022_nationality.sql`). Not required for `npm test`, which mocks the pool.
- `job_seekers` is the only table changed. Do not touch `supabase/migration.sql`.

## API Contract

### Sign-up (`extra` payload consumed by `src/shared/services/auth.js`)

`extra.nationality: string` — optional from the client; trimmed. Defaults to `"Filipino"` when absent or blank.

The service forwards it as `nationality` in the `POST /api/auth/pending-signup` body (profile JSON is stored wholesale — no route change there).

### `POST /api/auth/provision`

- Adds `nationality` to the `PERSON` allow-list in `server/src/routes/auth.js`.
- Job seeker insert gains `nationality` **immediately after `country`** and the value `person.nationality || 'Filipino'`.
- Employer insert unchanged (field is ignored for employers).

Resulting job seeker insert parameter order (0-based) for test updates:

| index | column |
|---|---|
| 17 | country |
| 18 | nationality |
| 19 | birthdate |
| 20 | employment_status |
| 21 | field |
| 22 | skills |
| 23 | custom_role_id |
| 24 | terms accepted flag |
| 25 | terms version |

All parameters after nationality shift by one: the `case when $25 ...` and `$26` replace the old `$24`/`$25`.

### `PATCH /api/seekers/me`

- `nationality` added to `SEEKER_ALLOW` and to `REQUIRED_TEXT` (column is `not null`; blank must persist `''`, never `NULL`).
- Not added to `LOWERCASE_FIELDS`.
- Request: `{ "nationality": "Japanese" }` → `200` with the updated seeker row.
- `GET /api/seekers/me` already returns the column via `select t.*`.
- No new error codes: field is unconstrained text, same as `headline`.

## File Map

| File | Task | Change |
|---|---|---|
| `db/migrations/022_nationality.sql` | 1 (done) | New column |
| `db/schema.sql` | 1 (done) | Column + idempotent alter |
| `server/src/routes/auth.js` | 2 | `PERSON` + job seeker insert |
| `server/src/routes/profiles.js` | 2 | `SEEKER_ALLOW`, `REQUIRED_TEXT` |
| `server/src/routes/auth.pending-signup.test.js` | 2 | Parameter indices + default assertion |
| `server/src/__tests__/profiles.patch.test.js` | 2 | PATCH nationality case |
| `server/src/routes/profiles.patch.test.js` | 2 | `REQUIRED_TEXT` list assertion |
| `src/shared/services/auth.js` | 3 | Map `extra.nationality` into sign-up meta |
| `src/features/auth/jobSeekerRegistration.js` | 3 | `EMPTY_FORM`, `validate`, payload |
| `src/features/auth/JobSeekerRegister.jsx` | 3 | `STEP_FIELDS[0]` |
| `src/features/auth/JobSeekerPersonalStep.jsx` | 3 | Nationality input |
| `src/features/job-seeker/Profile.jsx` | 3 | Form, validate, PATCH, Personal tab |
| `src/features/auth/__tests__/JobSeekerRegister.test.jsx` | 3 | Default + custom value test |
| `src/features/job-seeker/__tests__/Profile.required.test.jsx` | 3 | Default prefill + blank blocks save |

## Tasks

### Task 1: Schema (architect — complete)

- [x] `db/migrations/022_nationality.sql` added.
- [x] `db/schema.sql` updated (create table + idempotent alter).
- [x] Applied to the local DB on 2026-11-26 (`server/.env` → `127.0.0.1:5433/myapp_db`): column present, `not null default 'Filipino'`, 106/106 existing seekers backfilled.

### Task 2: Backend persistence

**Files:** `server/src/routes/auth.js`, `server/src/routes/profiles.js`, `server/src/routes/auth.pending-signup.test.js`, `server/src/__tests__/profiles.patch.test.js`, `server/src/routes/profiles.patch.test.js`

**Interfaces produced:** sign-up profile may include `nationality`; job seeker rows always have a non-null nationality; PATCH accepts `nationality`.

- [x] **Step 1: Write the failing tests**

In `server/src/__tests__/profiles.patch.test.js` add:

```js
it('persists nationality as typed', async () => {
  const token = loginAs({ id: SEEKER, role: 'job-seeker' });
  on((sql) => /update job_seekers set/.test(sql), () => ({ rows: [{ id: SEEKER, nationality: 'Japanese' }] }));
  const res = await request(app).patch('/api/seekers/me')
    .set('Cookie', token)
    .send({ nationality: 'Japanese' });
  expect(res.status).toBe(200);
  const update = callsOf(/update job_seekers set/)[0];
  expect(update.sql).toMatch(/nationality = \$\d+/);
  expect(update.params).toContain('Japanese');
});
```

In `server/src/routes/auth.pending-signup.test.js`, change the merged pending-profile assertion to account for the new parameter:

```js
expect(params.slice(10, 21)).toEqual([
  'rizal st', '12a', 'sunrise', 'poblacion', 'cebu city', 'cebu', '6000',
  'philippines', 'Filipino', '1998-05-04', 'Employed',
]);
expect(params[23]).toBeNull(); // pending rows never carry a custom-role tag
```

In `server/src/routes/profiles.patch.test.js`, add `'nationality'` to the `REQUIRED_TEXT` field list.

- [x] **Step 2: Run the tests and verify they fail**

Run: `npm test -- server/src/__tests__/profiles.patch.test.js server/src/routes/auth.pending-signup.test.js`
Expected: FAIL — nationality not allow-listed, parameter indices unchanged.

- [x] **Step 3: Implement**

`server/src/routes/profiles.js`:

```js
const SEEKER_ALLOW = [ ... 'postal_code', 'country', 'nationality', 'birthdate', ... ];
const REQUIRED_TEXT = new Set(['first_name', ..., 'country', 'nationality', 'company_name']);
```

`server/src/routes/auth.js`:

```js
const PERSON = [ ... 'postal_code', 'country', 'nationality', 'birthdate', 'employment_status'];
```

In the job seeker insert add `nationality` after `country`, value `person.nationality || 'Filipino'`, and renumber the placeholders as in § API Contract. Do not add `nationality` to `LOWERCASE_PERSON` or the employer insert.

- [x] **Step 4: Run the tests and verify they pass**

Run: `npm test -- server/src/__tests__/profiles.patch.test.js server/src/routes/auth.pending-signup.test.js server/src/routes/profiles.patch.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add server/src/routes/auth.js server/src/routes/profiles.js server/src/routes/auth.pending-signup.test.js server/src/__tests__/profiles.patch.test.js server/src/routes/profiles.patch.test.js
git commit -m "Add nationality to job seeker persistence"
```

### Task 3: Registration and Profile UI

**Files:** `src/shared/services/auth.js`, `src/features/auth/jobSeekerRegistration.js`, `src/features/auth/JobSeekerRegister.jsx`, `src/features/auth/JobSeekerPersonalStep.jsx`, `src/features/job-seeker/Profile.jsx`, `src/features/auth/__tests__/JobSeekerRegister.test.jsx`, `src/features/job-seeker/__tests__/Profile.required.test.jsx`

**Consumes:** Task 2 contract (`extra.nationality`, PATCH accepts `nationality`).

- [x] **Step 1: Write the failing tests**

`src/features/auth/__tests__/JobSeekerRegister.test.jsx` — one test:

```jsx
it('sends nationality, defaulting to Filipino and accepting an edit', async () => {
  signedUp({ id: 'seeker-1' })
  renderPage()
  fillRequired()
  expect(screen.getByLabelText(/^nationality/i)).toHaveValue('Filipino')
  fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
  fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
  fireEvent.change(screen.getByLabelText(/^nationality/i), { target: { value: 'Japanese' } })
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  await confirmCreateAccount()
  await waitFor(() => expect(api.post).toHaveBeenCalled())
  expect(parked()).toMatchObject({ nationality: 'Japanese' })
})
```

`src/features/job-seeker/__tests__/Profile.required.test.jsx` — one test:

```jsx
it('prefills nationality and blocks a blank one', async () => {
  useAuth.mockReturnValue({ user: STORED, refreshUser: vi.fn() })
  await openProfile()
  expect(screen.getByLabelText(/^Nationality/)).toHaveValue('Filipino')
  fireEvent.change(screen.getByLabelText(/^Nationality/), { target: { value: '' } })
  save()
  expect(await screen.findByText('Enter your nationality.')).toBeInTheDocument()
  expect(updateProfile).not.toHaveBeenCalled()
})
```

- [x] **Step 2: Run the tests and verify they fail**

Run: `npm test -- src/features/auth/__tests__/JobSeekerRegister.test.jsx src/features/job-seeker/__tests__/Profile.required.test.jsx`
Expected: FAIL — no nationality control.

- [x] **Step 3: Implement**

`src/shared/services/auth.js` — in `meta`, after `country`:

```js
nationality: String(extra.nationality ?? '').trim() || 'Filipino',
```

`src/features/auth/jobSeekerRegistration.js`:

```js
// EMPTY_FORM
nationality: "Filipino",
// validate
if (!values.nationality?.trim()) e.nationality = "Nationality is required";
// payload extra
nationality: form.nationality.trim(),
```

`src/features/auth/JobSeekerRegister.jsx` — `STEP_FIELDS[0]` gains `"nationality"`.

`src/features/auth/JobSeekerPersonalStep.jsx` — in the Birthday/Employment Status grid, between them:

```jsx
<div data-invalid={!!errors.nationality}>
  <Label htmlFor="nationality" className={labelClass}>Nationality{reqMark}</Label>
  <Input id="nationality" name="nationality" type="text" placeholder="Filipino" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={inputClass} />
  {errors.nationality && <p className="text-danger text-xs mt-1">{errors.nationality}</p>}
</div>
```

`src/features/job-seeker/Profile.jsx`:

```js
// EMPTY_FORM
nationality: '',
// formFromUser — legacy rows and mocked users prefill the default
nationality: user.nationality || 'Filipino',
// validate (with the other personal checks)
if (!form.nationality.trim()) next.nationality = 'Enter your nationality.'
// error-tab routing: add next.nationality to the personal-tab condition
// patch
nationality: form.nationality.trim(),
```

Personal tab — after Birthday:

```jsx
<TextField label="Nationality" required value={form.nationality} onChange={(event) => setField('nationality', event.target.value)} error={errors.nationality} />
```

Do not add nationality to `LOWERCASE_FIELDS` or to any employer form.

- [x] **Step 4: Run the tests and verify they pass**

Run: `npm test -- src/features/auth/__tests__/JobSeekerRegister.test.jsx src/features/job-seeker/__tests__/Profile.required.test.jsx`
Expected: PASS. Then `npm test -- src/features/job-seeker` — PASS (the `'Filipino'` fallback keeps older fixtures saving).

- [x] **Step 5: Commit**

```bash
git add src/shared/services/auth.js src/features/auth/jobSeekerRegistration.js src/features/auth/JobSeekerRegister.jsx src/features/auth/JobSeekerPersonalStep.jsx src/features/job-seeker/Profile.jsx src/features/auth/__tests__/JobSeekerRegister.test.jsx src/features/job-seeker/__tests__/Profile.required.test.jsx
git commit -m "Add nationality to registration and profile"
```

### Task 4: Review and verification

- [x] `npm test` — all client + server projects pass (2026-11-26: 273 files passed, 1 skipped; 1956 tests passed, 7 skipped).
- [x] `npm run lint` — scoped ESLint clean on all 12 touched files. Repo-wide still reports 2 errors in another agent's in-flight `account.js`/`account.erase.test.js`, outside this task (left untouched).
- [ ] Manual runtime contract check not performed (needs a signed-in seeker session); covered by the mocked provision and PATCH tests.

## Review Focus

- A blank Profile nationality must block the save with `Enter your nationality.`, never PATCH `''`.
- A legacy seeker row (created before migration 022) must open Profile with `Filipino` prefilled.
- A user who types `japanese` must get `japanese` back — nationality is not lowercased or title-cased.
- Employer registration/provision must not reference the column.
- The registration Step 1 gate must include nationality, so a blank value cannot reach Step 2.
