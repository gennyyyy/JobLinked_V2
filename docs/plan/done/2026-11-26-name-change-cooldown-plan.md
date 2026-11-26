# Name-Change Cooldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limit each account to one displayed-name change per rolling 30 days, for job-seekers, employers, and super-admins, with a server-enforced 409 and a profile UI that says when the next change is allowed.

**Architecture:** One nullable `name_changed_at` on each role table. One shared server module decides whether a patch changes the displayed name and supplies the atomic guard/stamp SQL fragments. `PATCH /seekers/me`, `PATCH /employers/me`, and `PATCH /admin/users/:id` all use it. The client derives the next allowed date from the same timestamp returned by the existing read endpoints.

**Tech Stack:** Express, PostgreSQL (raw SQL via `pg`), React 19 + Vite, Vitest + Supertest.

**Spec:** `docs/arch/adr-058-name-change-cooldown.md`

## Global Constraints

- JavaScript/JSX only; TypeScript is not used.
- Schema changes only through `db/schema.sql` plus a numbered file in `db/migrations/`. Never edit `supabase/migration.sql`.
- The cooldown applies to every role, including super-admin edits of another user. No exemption parameter.
- A name change is: `first_name`, `middle_name`, `last_name`, or `suffix` differs, OR `full_name` differs. Comparison trims and lower-cases both sides.
- Unchanged values in a patch must not consume the change.
- The whole patch is refused on 409; no partial save.
- Run `npm test` and `npm run lint` before reporting done.

## Review Focus

- Re-saving the profile form without touching the name must not consume the change.
- Case/whitespace-only differences (invite-store title case vs profile lower case) must not consume it.
- Two simultaneous saves must not both pass; the guard is in the `UPDATE ... WHERE`, not a prior `SELECT`.
- A name change bundled with phone/address must not save the other fields when the name is blocked.
- A super-admin correcting another user's name must hit the target user's window, not the admin's.
- The first change after provisioning must be free (`name_changed_at IS NULL`).

---

### Task 1: Schema and migration

**Files:**
- Modify: `db/schema.sql` (append after the ADR-057 block at end of file)
- Create: `db/migrations/020_name_change_cooldown.sql`

**Interfaces:**
- Produces: `name_changed_at timestamptz` (nullable) on `public.job_seekers`, `public.employers`, `public.super_admins`.

- [ ] **Step 1: Add the columns to `db/schema.sql`**

```sql
-- ---------------------------------------------------------------------------
-- ADR-058: displayed-name cooldown. NULL = never changed (first change free).
-- ---------------------------------------------------------------------------
alter table public.job_seekers  add column if not exists name_changed_at timestamptz;
alter table public.employers    add column if not exists name_changed_at timestamptz;
alter table public.super_admins add column if not exists name_changed_at timestamptz;
```

- [ ] **Step 2: Create `db/migrations/020_name_change_cooldown.sql`**

Same three statements plus the ADR comment. No `insert into schema_migrations` — `db/apply-migrations.sh` records the filename (convention since migration 011).

- [ ] **Step 3: Apply to the development database**

```powershell
psql -d joblinked -v ON_ERROR_STOP=1 -f db/migrations/020_name_change_cooldown.sql
```

If `psql` is not on PATH, use the full path (for example `"C:\Program Files\PostgreSQL\18\bin\psql.exe"`) or `DATABASE_URL=... ./db/apply-migrations.sh` where bash exists. If applied by hand, record it:

```sql
insert into public.schema_migrations (name) values ('020_name_change_cooldown.sql')
on conflict do nothing;
```

- [ ] **Step 4: Verify the columns exist**

```powershell
psql -d joblinked -c "\d public.job_seekers" -c "\d public.employers" -c "\d public.super_admins"
```

Expected: `name_changed_at | timestamp with time zone` in all three tables.

- [ ] **Step 5: Commit**

```bash
git add db/schema.sql db/migrations/020_name_change_cooldown.sql
git commit -m "Add name_changed_at for the monthly name-change limit"
```

---

### Task 2: Server guard, wiring, and API tests

**Files:**
- Create: `server/src/nameChange.js`
- Modify: `server/src/routes/profiles.js:72-92`
- Modify: `server/src/routes/admin-users.js:182-211`
- Create: `server/src/__tests__/profiles.name-change-limit.test.js`
- Modify: `server/src/__tests__/profiles.full-name-sync.test.js:18-50`

**Interfaces:**
- Produces (used by both routes):
  - `NAME_FIELDS: string[]` — `['first_name', 'middle_name', 'last_name', 'suffix']`
  - `NAME_GUARD_SQL: string` — `" and (name_changed_at is null or name_changed_at <= now() - interval '30 days')"`
  - `NAME_STAMP_SQL: string` — `", name_changed_at = now()"`
  - `isNameChange(patch, prior): boolean`
  - `nameLimitMessage(nameChangedAt): string` — `"You can change your name again on <date>."` using `toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })` on `nameChangedAt + 30 days`.

- [ ] **Step 1: Write the failing tests**

Create `server/src/__tests__/profiles.name-change-limit.test.js`:

```js
import { describe, expect, it, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('./helpers/auth.js'); return { auth: h.baAuth }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '33333333-3333-3333-3333-333333333333';
const TARGET = '44444444-4444-4444-4444-444444444444';
const RECENT = '2026-11-20T00:00:00.000Z';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const prior = (table, row) => on(
  new RegExp(`select first_name, middle_name, last_name, suffix, full_name, name_changed_at from ${table} where id = \\$1`),
  () => ({ rows: [row] }),
);
const updateRows = (table, rows) => on(new RegExp(`update ${table} set`), () => ({ rows }));
const probe = (table, row) => on(
  new RegExp(`select name_changed_at from ${table} where id = \\$1`),
  () => ({ rows: row ? [row] : [] }),
);

const patchSeeker = (token, body) => request(app).patch('/api/seekers/me').set('Cookie', token).send(body);

describe('name-change cooldown', () => {
  it('allows the first change and stamps name_changed_at', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    prior('job_seekers', { first_name: 'old', middle_name: '', last_name: 'old', suffix: '', full_name: 'old old', name_changed_at: null });
    updateRows('job_seekers', [{ id: SEEKER, first_name: 'john' }]);

    const res = await patchSeeker(token, { first_name: 'John' });

    expect(res.status).toBe(200);
    const sql = callsOf(/update job_seekers set/)[0].sql;
    expect(sql).toContain('name_changed_at = now()');
    expect(sql).toContain("name_changed_at is null or name_changed_at <= now() - interval '30 days'");
  });

  it('does not consume the change when the name is unchanged', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    prior('job_seekers', { first_name: 'ana', middle_name: '', last_name: 'cruz', suffix: '', full_name: 'ana cruz', name_changed_at: RECENT });
    updateRows('job_seekers', [{ id: SEEKER, phone: '0917000000' }]);

    const res = await patchSeeker(token, { first_name: 'Ana', phone: '0917000000' });

    expect(res.status).toBe(200);
    const sql = callsOf(/update job_seekers set/)[0].sql;
    expect(sql).not.toContain('name_changed_at');
  });

  it('409 NAME_CHANGE_LIMIT inside the window', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    prior('job_seekers', { first_name: 'ana', middle_name: '', last_name: 'cruz', suffix: '', full_name: 'ana cruz', name_changed_at: RECENT });
    updateRows('job_seekers', []);
    probe('job_seekers', { name_changed_at: RECENT });

    const res = await patchSeeker(token, { first_name: 'Maria', phone: '0917000000' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_CHANGE_LIMIT');
    expect(res.body.error.message).toMatch(/You can change your name again on /);
  });

  it('guards a full_name-only change', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    prior('job_seekers', { first_name: '', middle_name: '', last_name: '', suffix: '', full_name: 'old name', name_changed_at: RECENT });
    updateRows('job_seekers', []);
    probe('job_seekers', { name_changed_at: RECENT });

    const res = await patchSeeker(token, { full_name: 'new name' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_CHANGE_LIMIT');
  });

  it('allows the change at the 30-day boundary', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    prior('job_seekers', { first_name: 'ana', middle_name: '', last_name: 'cruz', suffix: '', full_name: 'ana cruz', name_changed_at: old });
    updateRows('job_seekers', [{ id: SEEKER, first_name: 'maria' }]);

    const res = await patchSeeker(token, { first_name: 'Maria' });

    expect(res.status).toBe(200);
    expect(callsOf(/update job_seekers set/)[0].sql).toContain('name_changed_at = now()');
  });

  it('guards the employer representative name', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    prior('employers', { first_name: 'ana', middle_name: '', last_name: 'cruz', suffix: '', full_name: 'ana cruz', name_changed_at: RECENT });
    updateRows('employers', []);
    probe('employers', { name_changed_at: RECENT });

    const res = await request(app).patch('/api/employers/me').set('Cookie', token).send({ first_name: 'Maria' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_CHANGE_LIMIT');
  });

  it('an admin edit respects the target user window (no exemption)', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    on(/select tbl, profile from/, () => ({
      rows: [{ tbl: 'job_seekers', profile: { id: TARGET, status: 'active', first_name: 'ana', middle_name: '', last_name: 'cruz', suffix: '', full_name: 'ana cruz', name_changed_at: RECENT } }],
    }));
    updateRows('job_seekers', []);
    probe('job_seekers', { name_changed_at: RECENT });

    const res = await request(app).patch(`/api/admin/users/${TARGET}`).set('Cookie', token).send({ first_name: 'Maria' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_CHANGE_LIMIT');
  });
});
```

- [ ] **Step 2: Run the new suite and confirm it fails**

Run: `npx vitest run server/src/__tests__/profiles.name-change-limit.test.js`
Expected: FAIL — the first test's UPDATE has no `name_changed_at`; the cooldown tests return 200/404 instead of 409.

- [ ] **Step 3: Create `server/src/nameChange.js`**

```js
// ADR-058: one displayed-name change per rolling 30 days, every role.
export const NAME_FIELDS = ['first_name', 'middle_name', 'last_name', 'suffix'];
export const NAME_GUARD_SQL = " and (name_changed_at is null or name_changed_at <= now() - interval '30 days')";
export const NAME_STAMP_SQL = ', name_changed_at = now()';

const norm = (value) => String(value ?? '').trim().toLowerCase();

// True when this patch would change the displayed name. Components win when
// both are sent (profiles.js derives full_name from them); a lone full_name
// still counts so super-admins and the legacy contract are covered.
export function isNameChange(patch, prior) {
  const componentChanged = NAME_FIELDS.some(
    (field) => patch[field] !== undefined && norm(patch[field]) !== norm(prior[field]),
  );
  const nextFullName = patch.full_name !== undefined ? patch.full_name : prior.full_name;
  return componentChanged || norm(nextFullName) !== norm(prior.full_name);
}

export function nameLimitMessage(nameChangedAt) {
  const next = new Date(new Date(nameChangedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
  return `You can change your name again on ${next.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric',
  })}.`;
}
```

- [ ] **Step 4: Wire `server/src/routes/profiles.js`**

Import `NAME_FIELDS as the existing local NAME_FIELDS` — delete the local `const NAME_FIELDS` at line 29 and import from `../nameChange.js` along with `isNameChange`, `NAME_STAMP_SQL`, `NAME_GUARD_SQL`, `nameLimitMessage`.

Replace the block at lines 72-92 with:

```js
    let nameChanging = false;
    if (NAME_FIELDS.some((c) => patch[c] !== undefined) || patch.full_name !== undefined) {
      const { rows } = await pool.query(
        `select first_name, middle_name, last_name, suffix, full_name, name_changed_at from ${table} where id = $1`, [req.user.id]);
      const priorRow = rows[0] || {};
      if (NAME_FIELDS.some((c) => patch[c] !== undefined)) {
        patch.full_name = buildFullName(
          ...NAME_FIELDS.map((c) => (patch[c] !== undefined ? patch[c] : priorRow[c])),
        );
      }
      nameChanging = isNameChange(patch, priorRow);
    }
    if (!Object.keys(patch).length) return err(res, 400, 'BAD_REQUEST', 'Nothing to update');
    const keys = Object.keys(patch);
    const { rows } = await pool.query(
      `update ${table} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}${nameChanging ? NAME_STAMP_SQL : ''}, updated_at = now()
        where id = $1${nameChanging ? NAME_GUARD_SQL : ''} returning *`,
      [req.user.id, ...keys.map((k) => patch[k])]);
    if (!rows[0]) {
      if (!nameChanging) return err(res, 404, 'NOT_FOUND', 'Profile not found');
      const { rows: probe } = await pool.query(`select name_changed_at from ${table} where id = $1`, [req.user.id]);
      if (!probe[0]) return err(res, 404, 'NOT_FOUND', 'Profile not found');
      return err(res, 409, 'NAME_CHANGE_LIMIT', nameLimitMessage(probe[0].name_changed_at));
    }
```

Keep the existing audit and response lines unchanged.

- [ ] **Step 5: Wire `server/src/routes/admin-users.js`**

Import `buildFullName` already exists at the top; add `NAME_FIELDS`, `isNameChange`, `NAME_STAMP_SQL`, `NAME_GUARD_SQL`, `nameLimitMessage` from `../nameChange.js`.

After the `EDITABLE` loop and the existing validations, before `const keys = Object.keys(patch);`, add:

```js
  // ADR-058: derive full_name the same way the self-service route does, then
  // decide whether this write changes the displayed name. Admin edits are not
  // exempt from the target's window.
  if (NAME_FIELDS.some((c) => patch[c] !== undefined)) {
    patch.full_name = buildFullName(
      ...NAME_FIELDS.map((c) => (patch[c] !== undefined ? patch[c] : profile[c])),
    );
  }
  const nameChanging = isNameChange(patch, profile);
```

Replace the UPDATE with:

```js
    const { rows } = await pool.query(
      `update ${table} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}${nameChanging ? NAME_STAMP_SQL : ''}, updated_at = now()
        where id = $1${nameChanging ? NAME_GUARD_SQL : ''} returning *`,
      [req.params.id, ...keys.map((k) => patch[k])]);
    if (!rows[0] && nameChanging) {
      const { rows: probe } = await pool.query(`select name_changed_at from ${table} where id = $1`, [req.params.id]);
      if (!probe[0]) return err(res, 404, 'NOT_FOUND', 'User account not found');
      return err(res, 409, 'NAME_CHANGE_LIMIT', nameLimitMessage(probe[0].name_changed_at));
    }
```

The existing audit/response lines stay.

- [ ] **Step 6: Update the existing full-name test**

In `server/src/__tests__/profiles.full-name-sync.test.js`:

- Change `priorName`'s regex to
  `/select first_name, middle_name, last_name, suffix, full_name, name_changed_at from job_seekers where id = \$1/`.
- Replace the second test's assertion `expect(callsOf(/select first_name, middle_name, last_name, suffix from/)).toHaveLength(0)` with
  `expect(callsOf(/select first_name, middle_name, last_name, suffix, full_name, name_changed_at from/)).toHaveLength(1);`
  and rename the test to `'writes a full_name-only patch verbatim and reads the prior row for the cooldown'`.

- [ ] **Step 7: Run the focused server tests**

Run: `npx vitest run server/src/__tests__/profiles.name-change-limit.test.js server/src/__tests__/profiles.full-name-sync.test.js server/src/__tests__/profiles.patch.test.js server/src/routes/admin.security.test.js server/src/__tests__/resilience.regressions.test.js`
Expected: all pass. If `admin.security.test.js` or `resilience.regressions.test.js` fail, confirm the admin UPDATE still puts `updated_at = now()` last in the SET list and does not add `name_changed_at` for status-only patches.

- [ ] **Step 8: Commit**

```bash
git add server/src/nameChange.js server/src/routes/profiles.js server/src/routes/admin-users.js server/src/__tests__/profiles.name-change-limit.test.js server/src/__tests__/profiles.full-name-sync.test.js
git commit -m "Enforce one displayed-name change per 30 days"
```

---

### Task 3: Client helper and the three profile screens

**Files:**
- Modify: `src/shared/utils/names.js`
- Create: `src/shared/utils/__tests__/names.test.js`
- Modify: `src/features/job-seeker/Profile.jsx` (helper near line 272; fields at lines 608, 631-634)
- Modify: `src/features/employer/CompanyProfile.jsx` (constant near line 42; render at line 486)
- Modify: `src/features/super-admin/Profile.jsx` (state area near line 24; field at line 90)

**Interfaces:**
- Produces:
  - `nameChangeAvailableAt(nameChangedAt, now = new Date()): Date | null` — returns the instant 30 days after the last change when it is still in the future; `null` when the name was never changed or the window has passed.
  - `nameChangeLockHelp(nameChangedAt, now = new Date()): string | null` — `"You can change your name again on Dec 26, 2026."` or `null`.

- [ ] **Step 1: Write the failing helper test**

Create `src/shared/utils/__tests__/names.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { nameChangeAvailableAt, nameChangeLockHelp } from '../names';

const NOW = new Date('2026-11-26T00:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe('name change cooldown', () => {
  it('is free when the name was never changed', () => {
    expect(nameChangeAvailableAt(null, NOW)).toBeNull();
    expect(nameChangeLockHelp(undefined, NOW)).toBeNull();
  });

  it('locks for 30 days after a change', () => {
    expect(nameChangeAvailableAt(daysAgo(10), NOW)).not.toBeNull();
    expect(nameChangeLockHelp(daysAgo(10), NOW)).toMatch(/^You can change your name again on /);
  });

  it('releases at the 30-day boundary', () => {
    expect(nameChangeAvailableAt(daysAgo(30), NOW)).toBeNull();
    expect(nameChangeAvailableAt(daysAgo(31), NOW)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/shared/utils/__tests__/names.test.js`
Expected: FAIL — `nameChangeAvailableAt` is not exported.

- [ ] **Step 3: Add the helpers to `src/shared/utils/names.js`**

```js
const NAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export function nameChangeAvailableAt(nameChangedAt, now = new Date()) {
  if (!nameChangedAt) return null;
  const next = new Date(new Date(nameChangedAt).getTime() + NAME_CHANGE_COOLDOWN_MS);
  return next > now ? next : null;
}

export function nameChangeLockHelp(nameChangedAt, now = new Date()) {
  const next = nameChangeAvailableAt(nameChangedAt, now);
  if (!next) return null;
  return `You can change your name again on ${next.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })}.`;
}
```

- [ ] **Step 4: Lock the job-seeker name fields**

`src/features/job-seeker/Profile.jsx`: import `nameChangeLockHelp` from `@/shared/utils/names` (the file already imports `buildFullName` via another module — keep one import path). Near `const show = ...` add:

```js
  const nameLockHelp = nameChangeLockHelp(user?.name_changed_at)
```

Add to the Full Name field (line 608) and the four components (lines 631-634):

```jsx
disabled={Boolean(nameLockHelp)}
help={nameLockHelp || undefined}
```

Only these five fields; phone, address, headline, and the rest keep saving.

- [ ] **Step 5: Lock the employer representative name**

`src/features/employer/CompanyProfile.jsx`: import `nameChangeLockHelp` from `@/shared/utils/names`. Add next to `REPRESENTATIVE_FIELDS`:

```js
const REPRESENTATIVE_NAME_FIELDS = new Set(["first_name", "middle_name", "last_name", "suffix"]);
```

Inside the component, after `const [company, setCompany] = useState(null);`:

```js
  const nameLockHelp = nameChangeLockHelp(company?.name_changed_at);
```

In the map at line 486 add:

```jsx
disabled={REPRESENTATIVE_NAME_FIELDS.has(name) && Boolean(nameLockHelp)}
help={REPRESENTATIVE_NAME_FIELDS.has(name) ? nameLockHelp || undefined : undefined}
```

Designation, representative mobile, representative email, company details, and contact fields stay editable.

- [ ] **Step 6: Lock the super-admin full name**

`src/features/super-admin/Profile.jsx`: import `nameChangeLockHelp` from `@/shared/utils/names`. After the `name` state add:

```js
  const nameLockHelp = nameChangeLockHelp(user?.name_changed_at)
```

Add to the Full Name `TextField` (line 90):

```jsx
disabled={Boolean(nameLockHelp)}
help={nameLockHelp || undefined}
```

- [ ] **Step 7: Run the helper test and lint the touched files**

Run: `npx vitest run src/shared/utils/__tests__/names.test.js`
Expected: PASS.
Run: `npx eslint src/shared/utils/names.js src/features/job-seeker/Profile.jsx src/features/employer/CompanyProfile.jsx src/features/super-admin/Profile.jsx`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/shared/utils/names.js src/shared/utils/__tests__/names.test.js src/features/job-seeker/Profile.jsx src/features/employer/CompanyProfile.jsx src/features/super-admin/Profile.jsx
git commit -m "Lock name fields on the profile screens while the cooldown is active"
```

---

### Task 4: Full verification

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all client and server suites pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Report**

Report the commands, their output, the files changed, and any deviation from this plan. Do not claim done if either command fails.

## Manual acceptance (human, after the agent reports)

1. Job seeker: change the first name once → saved, fields disabled, notice shows the date.
2. Reload the profile → the lock persists.
3. Change only the phone number → saves while the name stays locked.
4. Super-admin → User Management → edit the same user's first name → refused with the date.
5. `psql`: `select id, name_changed_at from job_seekers where id = '<id>';` shows the stamp.
