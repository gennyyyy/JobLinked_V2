# Super-admin User Invite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a super admin create a job-seeker / employer / super-admin account (optionally tagged with a custom role) from the Users page, with the new user onboarded through Supabase's own invite email.

**Architecture:** A new super-admin-only endpoint `POST /api/admin/users/invite` calls Supabase `admin.inviteUserByEmail` with the account metadata and a `redirectTo` of `<appOrigin>/accept-invite`; it writes no DB row. The role row is created lazily by the existing `POST /api/auth/provision` when the invitee lands on the new `/accept-invite` page and sets their password. No schema change.

**Tech Stack:** Express (server proxy, service-role Supabase client), React 19 + React Router 7 (frontend), Vitest + Testing Library, Tailwind (theme tokens).

**Spec:** `docs/arch/specs/2026-10-14-super-admin-user-invite-design.md`

## Global Constraints

- JavaScript / JSX only — TypeScript is not used.
- API errors use the envelope `{ error: { code, message } }`; frontend `lib/api.js` throws `Error(message)` with `.status`.
- Every `/api/admin/*` route stays `super-admin` only via the existing `const admin = [auth, requireRole('super-admin')]`.
- **No database schema change.** Rows land in the existing `job_seekers` / `employers` / `super_admins` tables; custom-role tag uses the existing `custom_role_id` column.
- Custom roles are `reference_data` rows with `category = 'custom_role'`; the base role is `details.base_role` ∈ {`super-admin`, `employer`, `job-seeker`}.
- Valid system roles: `job-seeker`, `employer`, `super-admin`. Role tables: `job_seekers`, `employers`, `super_admins`.
- Invite redirect origin = first entry of `process.env.CORS_ORIGIN` (comma-split, trimmed); path `/accept-invite`. No new env var.
- Tailwind: use theme tokens (`primary`, `dark-blue`, `primary-hover`, `primary-subtle`, `accent`, `danger`) only.
- Server route tests read source text and/or mock `../db.js` + `../auth.js` — never a live DB or real Supabase. Commands: `npm test`, `npm run lint`.

## Review Focus

Input classes / failure modes the spec implies but no happy-path test covers — each is pinned by a test in the owning task:

1. Email already exists in Supabase but not in any local role table → must be **409**, not 500 (Task 1).
2. Email case differences (`Juan@x.com` vs `juan@x.com`) → duplicate detection is case-insensitive (Task 1).
3. Custom role deleted between invite and acceptance → provision **ignores** the stale id and still onboards the user (Task 2).
4. Employer invite with no `company_name` → **400** (Task 1).
5. Expired / reused invite link (no session, or an existing profile) → `AcceptInvite` shows an error or skips provisioning, never crashes (Task 4).

---

## File Structure

- Modify `server/src/auth.js` — export the service-role Supabase client so the invite handler can use it.
- Modify `server/src/routes/admin.js` — add `POST /admin/users/invite`.
- Modify `server/src/routes/auth.js` — `POST /auth/provision` accepts an optional `custom_role_id`.
- Modify `src/shared/services/admin.js` — add `inviteUser(payload)`.
- Modify `src/features/super-admin/UserManagement.jsx` — add the "Add user" modal.
- Create `src/features/auth/AcceptInvite.jsx` — invite landing page.
- Modify `src/App.jsx` — register the bare `/accept-invite` route.
- Tests: create `server/src/routes/admin.users.invite.test.js`; extend `server/src/routes/auth.provision.test.js`; create `src/features/super-admin/__tests__/UserManagement.invite.test.jsx`; create `src/features/auth/__tests__/AcceptInvite.test.jsx`.

---

### Task 1: Invite endpoint

**Files:**
- Modify: `server/src/auth.js:5`
- Modify: `server/src/routes/admin.js` (import at `:3`; new route after the `PATCH /admin/users/:id` handler, ~`:88`)
- Test: `server/src/routes/admin.users.invite.test.js`

**Interfaces:**
- Consumes: `USER_TABLES` (already defined in `admin.js`), `pool` from `../db.js`, `supa` from `../auth.js` (newly exported), `err` / `ah` / `audit` from `../util.js`.
- Produces: `POST /api/admin/users/invite` → `201 { invited: true, email, role }`; `400 BAD_REQUEST`; `409 CONFLICT`; `500 INTERNAL`.

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/admin.users.invite.test.js` (mirror the runtime harness in `server/src/routes/notifications.delete.test.js`):

```js
import { readFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const adminSrc = srv('src/routes/admin.js');
const inviteStart = adminSrc.indexOf("router.post('/admin/users/invite'");
const invite = adminSrc.slice(inviteStart, adminSrc.indexOf('router.', inviteStart + 1));

describe('invite route shape', () => {
  it('validates role and requires company_name for employers', () => {
    expect(inviteStart).toBeGreaterThan(-1);
    expect(invite).toContain("['job-seeker', 'employer', 'super-admin']");
    expect(invite).toMatch(/company_name/);
  });
  it('invites with metadata and the /accept-invite redirect', () => {
    expect(invite).toContain('supa.auth.admin.inviteUserByEmail');
    expect(invite).toContain('/accept-invite');
    expect(invite).toContain("audit(req.user.id, 'user.invite'");
  });
});

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn(), invite: vi.fn(), role: 'super-admin' }));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: 'admin-1', email: 'a@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  supa: { auth: { admin: { inviteUserByEmail: mocks.invite } } },
}));
process.env.RETENTION_DISABLE = '1';
process.env.CORS_ORIGIN = 'https://app.test';
const { default: adminRoutes } = await import('./admin.js');

let base, server;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api', adminRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => { mocks.role = 'super-admin'; mocks.poolQuery.mockReset(); mocks.invite.mockReset(); });

const post = (body) => fetch(`${base}/admin/users/invite`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('invite runtime', () => {
  it('201 and invites with metadata + redirectTo on the happy path', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });          // dup check empty
    mocks.invite.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const r = await post({ email: 'new@x.com', role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ invited: true, email: 'new@x.com', role: 'job-seeker' });
    expect(mocks.invite).toHaveBeenCalledWith('new@x.com', expect.objectContaining({
      redirectTo: 'https://app.test/accept-invite',
      data: expect.objectContaining({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' }),
    }));
  });
  it('409 when the email already exists in a role table (case-insensitive)', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const r = await post({ email: 'Juan@X.com', role: 'employer', first_name: 'J', last_name: 'D', company_name: 'Acme' });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe('CONFLICT');
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('409 when Supabase reports the auth user already exists', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    mocks.invite.mockResolvedValue({ data: null, error: { message: 'User already registered' } });
    const r = await post({ email: 'dup@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(409);
  });
  it('400 when an employer invite omits company_name', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    const r = await post({ email: 'e@x.com', role: 'employer', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(400);
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('403 when the caller is not a super-admin', async () => {
    mocks.role = 'employer';
    const r = await post({ email: 'e@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/routes/admin.users.invite.test.js`
Expected: FAIL — `inviteStart` is `-1` (route missing) and the runtime calls 404.

- [ ] **Step 3: Export the Supabase client**

In `server/src/auth.js:5`, change `const supa = createClient(...)` to `export const supa = createClient(...)`.

- [ ] **Step 4: Implement the route in `server/src/routes/admin.js`**

Extend the import at `:3` to `import { auth, requireRole, supa } from '../auth.js';`. Add after the `PATCH /admin/users/:id` handler:

```js
// Admin-initiated invite (ADR-024). No DB row here — the invitee's role row is
// created lazily by POST /auth/provision when they accept (see AcceptInvite.jsx).
const INVITE_BASE_ROLES = ['job-seeker', 'employer', 'super-admin'];

router.post('/admin/users/invite', ...admin, ah(async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim();
  if (!email || !b.first_name?.trim?.() || !b.last_name?.trim?.()) {
    return err(res, 400, 'BAD_REQUEST', 'email, first_name, and last_name are required');
  }

  // Resolve the effective base role: a custom role overrides `role` with its base_role.
  let role = b.role;
  let customRoleId = null;
  if (b.custom_role_id != null) {
    const { rows } = await pool.query(
      `select id, details->>'base_role' as base_role from reference_data
        where id = $1 and category = 'custom_role'`, [b.custom_role_id]);
    if (!rows[0]) return err(res, 400, 'BAD_REQUEST', 'Custom role not found');
    role = rows[0].base_role;
    customRoleId = rows[0].id;
  }
  if (!INVITE_BASE_ROLES.includes(role)) {
    return err(res, 400, 'BAD_REQUEST', 'role must be job-seeker, employer, or super-admin');
  }
  if (role === 'employer' && !String(b.company_name || '').trim()) {
    return err(res, 400, 'BAD_REQUEST', 'company_name is required for employer accounts');
  }

  const { rows: dupe } = await pool.query(
    `select 1 from job_seekers where lower(email) = lower($1)
     union all select 1 from employers where lower(email) = lower($1)
     union all select 1 from super_admins where lower(email) = lower($1) limit 1`, [email]);
  if (dupe[0]) return err(res, 409, 'CONFLICT', 'Email is already registered');

  const appOrigin = String(process.env.CORS_ORIGIN || '').split(',')[0].trim();
  const metadata = {
    role, custom_role_id: customRoleId,
    first_name: b.first_name, middle_name: b.middle_name || '', last_name: b.last_name,
    suffix: b.suffix || '', phone: b.phone || null,
    full_name: [b.first_name, b.middle_name, b.last_name, b.suffix].filter(Boolean).join(' '),
    company_name: b.company_name || null,
  };
  const { error } = await supa.auth.admin.inviteUserByEmail(email, {
    data: metadata, redirectTo: `${appOrigin}/accept-invite`,
  });
  if (error) return err(res, 409, 'CONFLICT', 'Could not send the invite — the email may already be registered');

  void audit(req.user.id, 'user.invite', null, null, { email, role, custom_role_id: customRoleId });
  res.status(201).json({ invited: true, email, role });
}));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/src/routes/admin.users.invite.test.js`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/auth.js server/src/routes/admin.js server/src/routes/admin.users.invite.test.js
git commit -m "feat(admin): invite users via Supabase admin invite"
```

---

### Task 2: Provision accepts `custom_role_id`

**Files:**
- Modify: `server/src/routes/auth.js` (the `/auth/provision` handler, `:18-118`)
- Test: `server/src/routes/auth.provision.test.js` (extend)

**Interfaces:**
- Consumes: `pool`, the existing `PERSON` handling.
- Produces: `POST /api/auth/provision` now persists an optional `custom_role_id` on the inserted row (all three role tables have the column). A stale/unresolved id is ignored, never a 400.

- [ ] **Step 1: Write the failing test**

Append to `server/src/routes/auth.provision.test.js`:

```js
describe('provision custom_role_id', () => {
  it('validates the id against the custom_role catalog', () => {
    expect(authSrc).toMatch(/category = 'custom_role'/);
  });
  it('persists custom_role_id on the role insert', () => {
    expect(authSrc).toMatch(/insert into job_seekers[\s\S]*custom_role_id/);
  });
  it('ignores an unresolvable id instead of failing (stale invite)', () => {
    expect(authSrc).not.toMatch(/custom_role_id[\s\S]{0,120}BAD_REQUEST/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/routes/auth.provision.test.js`
Expected: FAIL — the three new assertions aren't satisfied yet.

- [ ] **Step 3: Implement**

In `server/src/routes/auth.js`, inside the `/auth/provision` handler before the transaction, resolve the tag:

```js
let customRoleId = null;
if (b.custom_role_id != null) {
  const { rows } = await pool.query(
    `select id from reference_data where id = $1 and category = 'custom_role'`, [b.custom_role_id]);
  if (rows[0]) customRoleId = rows[0].id;   // stale id → leave null, do not fail
}
```

Add `custom_role_id` to each role `INSERT` column list and pass `customRoleId` as the final parameter (`job_seekers` `:61-73`, `employers` `:84-97`, `super_admins` `:102-106`). Leave all other behaviour (idempotency, employer accreditation row, education) unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/src/routes/auth.provision.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.js server/src/routes/auth.provision.test.js
git commit -m "feat(auth): provision accepts custom_role_id"
```

---

### Task 3: Users-page "Add user" modal

**Files:**
- Modify: `src/shared/services/admin.js` (after `assignCustomRole`, ~`:113`)
- Modify: `src/features/super-admin/UserManagement.jsx`
- Test: `src/features/super-admin/__tests__/UserManagement.invite.test.jsx`

**Interfaces:**
- Consumes: `inviteUser` (new), existing `listRoles` (already called on the page).
- Produces: `inviteUser(payload)` → `api.post('admin/users/invite', payload)`; a button labelled **Add user**; a modal submitting `{ email, role, custom_role_id, first_name, middle_name, last_name, suffix, phone, company_name }`.

- [ ] **Step 1: Write the failing test**

Create `src/features/super-admin/__tests__/UserManagement.invite.test.jsx`. Mock `../../../shared/services/admin` (return `listUsers: async () => []`, `listAllAccreditations: async () => []`, `listRoles: async () => [{ id: 7, name: 'HR Officer', base_role: 'employer' }]`, `inviteUser: vi.fn()`), mock `../../../shared/hooks/useAuth` (default → `{ user: { id: 'admin-1', role: 'super-admin' } }`), and mock `../../../shared/services/documents` (`latestAccByCompany: () => ({})`). Assert: clicking **Add user** reveals the form; selecting role `employer` reveals the **Company name** field (and it is absent for `job-seeker`); submitting with an employer role calls `inviteUser` with `expect.objectContaining({ email, role: 'employer', company_name: 'Acme' })`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/super-admin/__tests__/UserManagement.invite.test.jsx`
Expected: FAIL — no "Add user" button.

- [ ] **Step 3: Add the service function**

In `src/shared/services/admin.js`:

```js
// Admin-initiated invite (ADR-024): Supabase emails the invitee; their role row
// is created by POST /auth/provision when they accept.
export async function inviteUser(payload) {
  return api.post('admin/users/invite', payload);
}
```

- [ ] **Step 4: Add the modal to `UserManagement.jsx`**

Import `inviteUser` (extend the `:3` import). Add state: `showInvite` (bool), `inviteForm` (object with the nine fields), `inviting` (bool). Add an **Add user** button in the `<header>` (right-aligned, house primary-button classes). Render a modal when `showInvite` (fixed overlay + white card; follow the `UserModal` markup pattern in `src/features/super-admin/Logs.jsx`) containing: Email; Role `<select>` whose options are the three system roles plus `<optgroup label="Custom roles">` from `customRoles` (value `custom:<id>`); First name; Middle name; Last name; Suffix; Phone; and a **Company name** field rendered only when the selected base role is `employer`. Submit builds the payload — for `custom:<id>` send `custom_role_id: Number(id)` and derive `role` from the selected custom role's `base_role`; otherwise send `role`. On success: `setSuccess(\`Invite sent to ${email}\`)`, close, reset. On error: `setActionError(err.message)`. Reuse the page's existing `success` / `actionError` banners.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/super-admin/__tests__/UserManagement.invite.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/admin.js src/features/super-admin/UserManagement.jsx src/features/super-admin/__tests__/UserManagement.invite.test.jsx
git commit -m "feat(admin): add-user invite modal on Users page"
```

---

### Task 4: `/accept-invite` page + route

**Files:**
- Create: `src/features/auth/AcceptInvite.jsx`
- Modify: `src/App.jsx` (import near `:14`; bare route near `:59`)
- Test: `src/features/auth/__tests__/AcceptInvite.test.jsx`

**Interfaces:**
- Consumes: `supabase` (`../../shared/lib/supabase`), `getProfile` + `provision` (`../../shared/services/auth`), `useAuth` (`refreshUser`), `LoadingScreen`.
- Produces: a page that provisions a missing profile from the invite metadata, then sets a password and routes to `/job-seeker` | `/employer` | `/super-admin`.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/__tests__/AcceptInvite.test.jsx`. Mock `../../shared/lib/supabase` (`supabase.auth.getSession` → `{ data: { session: { user: { id: 'u1', email: 'n@x.com', user_metadata: { role: 'employer', first_name: 'A', last_name: 'B', company_name: 'Acme' } } } }, error: null }`; `supabase.auth.updateUser` → `{ error: null }`), mock `../../shared/services/auth` (`getProfile: vi.fn().mockResolvedValue(null)`, `provision: vi.fn().mockResolvedValue({ role: 'employer' })`), mock `useAuth` (`{ refreshUser: vi.fn() }`). Three tests:
1. **No profile yet** — `getProfile` → `null`: `provision` is called with `expect.objectContaining({ role: 'employer', email: 'n@x.com' })`; the "Set your password" form (New Password + Confirm Password inputs) renders; submitting calls `supabase.auth.updateUser`.
2. **Profile already exists** — `getProfile` resolves `{ role: 'employer' }`: `provision` is **not** called, and the set-password form still renders (idempotent re-entry).
3. **No session** — `getSession` resolves `{ data: { session: null }, error: null }`: the text **"This invite link is invalid or expired."** renders and `provision` is not called.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/__tests__/AcceptInvite.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/features/auth/AcceptInvite.jsx`**

On mount: `const { data: { session } } = await supabase.auth.getSession()`. No `session?.user` → render the error card ("This invite link is invalid or expired."). Otherwise: `let profile = await getProfile(session.user.id)`; if none, `profile = await provision({ ...session.user.user_metadata, email: session.user.email })`. Render a "Set your password" form (mirror `src/features/auth/ResetPassword.jsx`'s card + field markup): validate ≥ 8 chars and confirm match, then `supabase.auth.updateUser({ password })`, then `await refreshUser(session.user)` and `navigate(\`/${profile.role}\`)`. Show `LoadingScreen` while the session is being read and inline errors on failure.

- [ ] **Step 4: Register the route**

In `src/App.jsx`: `import AcceptInvite from './features/auth/AcceptInvite'` and add a **bare** route beside `/auth/callback` (NOT wrapped in `PublicRoute`, which would destroy the invite session):

```jsx
<Route path="/accept-invite" element={<AcceptInvite />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/auth/__tests__/AcceptInvite.test.jsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite and lint**

Run: `npm test` then `npm run lint`
Expected: all tests pass; lint clean on the changed files.

- [ ] **Step 7: Commit**

```bash
git add src/features/auth/AcceptInvite.jsx src/App.jsx src/features/auth/__tests__/AcceptInvite.test.jsx
git commit -m "feat(auth): /accept-invite landing for admin invites"
```

---

## Post-implementation (manual, not a task)

- Ops: add `<appOrigin>/accept-invite` to the Supabase project's redirect-URL allowlist; confirm `CORS_ORIGIN` is the public web origin.
- Record ADR-024 in `docs/arch/adr-backlog.md` (deferred out of this plan to avoid entangling the in-flight uncommitted edits already in that file).
- Manual round-trip: invite → receive email → click → set password → land in the right portal with the right role (and, when a custom role was chosen, confirm the tag appears on the Users page).
