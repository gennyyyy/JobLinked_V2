import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// G-02 ("cannot grant what you lack"), G-05 (no 403/404 category oracle on
// DELETE /admin/reference/:id) and G-07 (never remove the last break-glass
// admin). The real routers are mounted and only the pool + principal are
// mocked, so each test also pins which chain the route uses.
// Vectors: docs/arch/audit/2026-11-13-phase4-probes.md P-07/P-08.

const mocks = vi.hoisted(() => ({
  query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  connect: vi.fn(),
  invite: vi.fn(),
  updateUser: vi.fn(),
  user: null,
}));

vi.mock('../db.js', () => ({ pool: { query: mocks.query, connect: mocks.connect } }));
vi.mock('../auth.js', () => ({
  // The principal is whatever the test sets — the real requirePermission
  // middleware still runs and reads customRoleId/permissions from it.
  auth: (req, _res, next) => { req.user = mocks.user; next(); },
  requireRole: (...roles) => (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  supa: () => ({ auth: { admin: { inviteUserByEmail: mocks.invite, updateUserById: mocks.updateUser } } }),
}));

process.env.RETENTION_DISABLE = '1';
process.env.CORS_ORIGIN = 'https://app.test';
const { default: adminUsers } = await import('../routes/admin-users.js');
const { default: adminReference } = await import('../routes/admin-reference.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', adminUsers, adminReference);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  mocks.query.mockReset();
  mocks.connect.mockReset().mockResolvedValue({ query: vi.fn(async () => ({ rows: [], rowCount: 1 })), release: vi.fn() });
  mocks.invite.mockReset().mockResolvedValue({ data: { user: { id: 'auth-uuid-1' } }, error: null });
  mocks.updateUser.mockReset().mockResolvedValue({ data: { user: {} }, error: null });
  mocks.user = fullAdmin();
});

// ── Principal + DB stubs ───────────────────────────────────────────────────
const fullAdmin = () => ({ id: 'admin-1', email: 'a@x.com', role: 'super-admin', customRoleId: null, permissions: [] });
const taggedAdmin = (permissions, customRoleId = 30) =>
  ({ id: 'admin-1', email: 'a@x.com', role: 'super-admin', customRoleId, permissions });

// First matching [RegExp, handler] wins; anything else is an empty result so a
// write the handler should never reach cannot silently succeed.
const sqlDb = (...handlers) => mocks.query.mockImplementation(async (text, params = []) => {
  for (const [match, impl] of handlers) if (match.test(String(text))) return impl(params, String(text));
  return { rows: [], rowCount: 0 };
});

const FIND_USER = /select tbl, profile from/;
const ROLE_BUNDLE = /details->'permissions'/;               // bundle load (invite, tag grant)
const ROLE_ROW = /^select \* from reference_data where id = \$1 and category = 'custom_role'/;
const REF_CATEGORY = /^select category from reference_data where id = \$1/;
const NAME_TAKEN = /lower\(value\) = lower\(\$1\)/;
const INSERT_ROLE = /^insert into reference_data \(category, value, sort_order, details\)/;
const UPDATE_ROLE = /^update reference_data set value/;
const DELETE_ROLE = /^delete from reference_data where id = \$1 and category = 'custom_role'/;
const ROLE_REFS = /from super_admins where custom_role_id = \$1/;
const LAST_ADMIN = /from super_admins where status = 'active' and custom_role_id is null/;
const DUP_EMAIL = /union all select 1 from super_admins where lower\(email\)/;
const UPDATE_USER = /^update (?:super_admins|employers|job_seekers) set /;

const T = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ALL_KEYS = ['dashboard.view', 'accreditation.manage', 'jobs.manage', 'users.manage', 'roles.manage',
  'reports.view', 'logs.view', 'notifications.send', 'settings.manage'];

const json = (method, path, body) => fetch(`${base}${path}`, {
  method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const invite = (body) => json('POST', '/admin/users/invite', body);
const patchUser = (id, body) => json('PATCH', `/admin/users/${id}`, body);
const moveRole = (id, body) => json('POST', `/admin/users/${id}/role`, body);
const assign = (id, body) => json('POST', `/admin/users/${id}/custom-role`, body);
const postRole = (body) => json('POST', '/admin/roles', body);
const patchRole = (id, body) => json('PATCH', `/admin/roles/${id}`, body);
const deleteRole = (id) => json('DELETE', `/admin/roles/${id}`);
const deleteRef = (id) => json('DELETE', `/admin/reference/${id}`);

const adminRow = (customRoleId = null) => [{ tbl: 'super_admins', profile: {
  id: T, role: 'super-admin', status: 'active', custom_role_id: customRoleId, email: 't@x.com', full_name: 'Target',
} }];

// ── G-02 invite ────────────────────────────────────────────────────────────
describe('G-02 invite: only a full admin may mint a full admin', () => {
  it('P-08: a users.manage-only admin cannot invite an untagged super-admin', async () => {
    mocks.user = taggedAdmin(['users.manage'], 31);
    sqlDb();
    const r = await invite({ email: 'boss@x.com', role: 'super-admin', first_name: 'Cid', last_name: 'Reyes' });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe('FORBIDDEN');
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it('refuses a bundle carrying a key the inviter does not hold', async () => {
    mocks.user = taggedAdmin(['users.manage'], 31);
    sqlDb([ROLE_BUNDLE, () => ({ rows: [{ id: 40, base_role: 'super-admin', permissions: ['roles.manage'] }] })]);
    const r = await invite({ email: 'x@x.com', custom_role_id: 40, first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(403);
    expect((await r.json()).error.message).toMatch(/roles\.manage/);
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it('lets a tagged admin delegate a bundle within its own', async () => {
    mocks.user = taggedAdmin(['users.manage'], 31);
    sqlDb([ROLE_BUNDLE, () => ({ rows: [{ id: 41, base_role: 'super-admin', permissions: ['users.manage'] }] })],
      [DUP_EMAIL, () => ({ rows: [] })]);
    const r = await invite({ email: 'delegate@x.com', custom_role_id: 41, first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(201);
    expect(mocks.updateUser).toHaveBeenCalledWith('auth-uuid-1', { app_metadata: { role: 'super-admin', custom_role_id: 41 } });
  });

  it('still lets a full admin invite an untagged super-admin', async () => {
    sqlDb([DUP_EMAIL, () => ({ rows: [] })]);
    const r = await invite({ email: 'boss2@x.com', role: 'super-admin', first_name: 'Cid', last_name: 'Reyes' });
    expect(r.status).toBe(201);
    expect(mocks.updateUser).toHaveBeenCalledWith('auth-uuid-1', { app_metadata: { role: 'super-admin', custom_role_id: 0 } });
  });
});

// ── G-02 role writes ───────────────────────────────────────────────────────
describe('G-02 role writes: never edit/delete your own ceiling, never widen it', () => {
  it('P-07: a roles.manage admin cannot widen its own role to all keys', async () => {
    mocks.user = taggedAdmin(['roles.manage'], 32);
    sqlDb();
    const r = await patchRole(32, { permissions: ALL_KEYS });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe('FORBIDDEN');
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('refuses a role edit that adds a key the caller does not hold', async () => {
    mocks.user = taggedAdmin(['roles.manage'], 32);
    sqlDb([ROLE_ROW, () => ({ rows: [{ id: 50, value: 'Narrow', sort_order: 1,
      details: { permissions: ['roles.manage'], base_role: 'super-admin' } }] })]);
    const r = await patchRole(50, { permissions: ['roles.manage', 'users.manage'] });
    expect(r.status).toBe(403);
    expect((await r.json()).error.message).toMatch(/users\.manage/);
    expect(mocks.query.mock.calls.some(([t]) => /^update reference_data/.test(t))).toBe(false);
  });

  it('allows a role edit whose merged bundle is within the caller bundle', async () => {
    mocks.user = taggedAdmin(['roles.manage'], 32);
    sqlDb([ROLE_ROW, () => ({ rows: [{ id: 50, value: 'Narrow', sort_order: 1,
      details: { permissions: ['roles.manage'], base_role: 'super-admin' } }] })],
    [NAME_TAKEN, () => ({ rows: [] })],
    [UPDATE_ROLE, () => ({ rows: [{ id: 50, value: 'Narrow', sort_order: 1,
      details: { permissions: ['roles.manage'], base_role: 'super-admin' } }] })]);
    const r = await patchRole(50, { description: 'still narrow' });
    expect(r.status).toBe(200);
    expect((await r.json()).permissions).toEqual(['roles.manage']);
  });

  it('refuses creating a role with a key the caller does not hold', async () => {
    mocks.user = taggedAdmin(['roles.manage'], 32);
    sqlDb();
    const r = await postRole({ name: 'Wide', permissions: ['roles.manage', 'users.manage'] });
    expect(r.status).toBe(403);
    expect(mocks.query.mock.calls.some(([t]) => /^insert into reference_data/.test(t))).toBe(false);
  });

  it('allows creating a role within the caller bundle', async () => {
    mocks.user = taggedAdmin(['roles.manage'], 32);
    sqlDb([NAME_TAKEN, () => ({ rows: [] })],
      [INSERT_ROLE, () => ({ rows: [{ id: 51, value: 'Narrow 2', sort_order: 2,
        details: { permissions: ['roles.manage'], base_role: 'super-admin' } }] })]);
    const r = await postRole({ name: 'Narrow 2', permissions: ['roles.manage'] });
    expect(r.status).toBe(201);
  });

  it('P-07: a roles.manage admin cannot delete its own role (break-glass promotion)', async () => {
    mocks.user = taggedAdmin(['roles.manage'], 32);
    sqlDb();
    const r = await deleteRole(32);
    expect(r.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('P-07: the own-role guard cannot be bypassed with a padded id', async () => {
    mocks.user = taggedAdmin(['roles.manage'], 32);
    sqlDb();
    expect((await patchRole('032', { permissions: ALL_KEYS })).status).toBe(403);
    expect((await deleteRole('032')).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('409 while the role is still assigned to an account', async () => {
    sqlDb([ROLE_ROW, () => ({ rows: [{ id: 50, value: 'Assigned' }] })],
      [ROLE_REFS, () => ({ rows: [{ c: 2 }] })]);
    const r = await deleteRole(50);
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe('CONFLICT');
    expect(mocks.query.mock.calls.some(([t]) => /^delete from reference_data/.test(t))).toBe(false);
  });

  it('deletes an unreferenced role', async () => {
    sqlDb([ROLE_ROW, () => ({ rows: [{ id: 52, value: 'Unused' }] })],
      [ROLE_REFS, () => ({ rows: [{ c: 0 }] })],
      [DELETE_ROLE, () => ({ rows: [], rowCount: 1 })]);
    const r = await deleteRole(52);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ deleted: true });
  });
});

// ── G-02 tag assignment ────────────────────────────────────────────────────
describe('G-02 assignment: a tag is a grant and obeys the same ceiling', () => {
  it('P-08: a users.manage admin cannot clear another super-admin tag', async () => {
    mocks.user = taggedAdmin(['users.manage'], 31);
    sqlDb([FIND_USER, () => ({ rows: adminRow(33) })]);
    const r = await assign(T, { custom_role_id: null });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe('FORBIDDEN');
    expect(mocks.query.mock.calls.some(([t]) => /^update super_admins/.test(t))).toBe(false);
  });

  it('refuses to assign a bundle carrying a key the caller does not hold', async () => {
    mocks.user = taggedAdmin(['users.manage'], 31);
    sqlDb([FIND_USER, () => ({ rows: adminRow(33) })],
      [ROLE_BUNDLE, () => ({ rows: [{ permissions: ['roles.manage'] }] })]);
    const r = await assign(T, { custom_role_id: 50 });
    expect(r.status).toBe(403);
    expect((await r.json()).error.message).toMatch(/roles\.manage/);
    expect(mocks.query.mock.calls.some(([t]) => /^update super_admins/.test(t))).toBe(false);
  });

  it('lets a tagged admin delegate a bundle within its own', async () => {
    mocks.user = taggedAdmin(['users.manage'], 31);
    sqlDb([FIND_USER, () => ({ rows: adminRow(33) })],
      [ROLE_BUNDLE, () => ({ rows: [{ permissions: ['users.manage'] }] })],
      [UPDATE_USER, () => ({ rows: [{ id: T, custom_role_id: 41 }] })]);
    const r = await assign(T, { custom_role_id: 41 });
    expect(r.status).toBe(200);
  });

  it('the user PATCH cannot clear another admin tag either', async () => {
    mocks.user = taggedAdmin(['users.manage'], 31);
    sqlDb([FIND_USER, () => ({ rows: adminRow(33) })]);
    const r = await patchUser(T, { custom_role_id: null });
    expect(r.status).toBe(403);
    expect(mocks.query.mock.calls.some(([t]) => /^update super_admins/.test(t))).toBe(false);
  });

  it('a full admin can still clear another admin tag', async () => {
    sqlDb([FIND_USER, () => ({ rows: adminRow(33) })],
      [UPDATE_USER, () => ({ rows: [{ id: T, custom_role_id: null }] })]);
    const r = await patchUser(T, { custom_role_id: null });
    expect(r.status).toBe(200);
  });
});

// ── G-05 ───────────────────────────────────────────────────────────────────
describe('G-05: DELETE /admin/reference/:id is not a category oracle', () => {
  it('answers the same 404 for a custom_role row as for a missing row', async () => {
    mocks.user = taggedAdmin(['settings.manage'], 30);
    sqlDb([REF_CATEGORY, () => ({ rows: [{ category: 'custom_role' }] })]);
    const hidden = await deleteRef(77);
    expect(hidden.status).toBe(404);
    const hiddenBody = await hidden.json();
    expect(hiddenBody.error.code).toBe('NOT_FOUND');

    sqlDb();
    const missing = await deleteRef(999);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual(hiddenBody);
    expect(mocks.query.mock.calls.some(([t]) => /^delete from reference_data/.test(t))).toBe(false);
  });

  it('still deletes a non-custom_role row for a settings.manage holder', async () => {
    mocks.user = taggedAdmin(['settings.manage'], 30);
    sqlDb([REF_CATEGORY, () => ({ rows: [{ category: 'job_type' }] })],
      [/^delete from reference_data where id = \$1$/, () => ({ rows: [], rowCount: 1 })]);
    const r = await deleteRef(78);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ deleted: true });
  });
});

// ── G-07 ───────────────────────────────────────────────────────────────────
describe('G-07: the last break-glass admin cannot be removed', () => {
  it('refuses to suspend the last full admin', async () => {
    sqlDb([FIND_USER, () => ({ rows: adminRow(null) })],
      [LAST_ADMIN, () => ({ rows: [{ c: 0 }] })]);
    const r = await patchUser(T, { status: 'suspended' });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe('CONFLICT');
    expect(mocks.query.mock.calls.some(([t]) => /^update super_admins/.test(t))).toBe(false);
  });

  it('allows the suspension when another full admin remains', async () => {
    sqlDb([FIND_USER, () => ({ rows: adminRow(null) })],
      [LAST_ADMIN, () => ({ rows: [{ c: 1 }] })],
      [UPDATE_USER, () => ({ rows: [{ id: T, status: 'suspended' }] })]);
    const r = await patchUser(T, { status: 'suspended' });
    expect(r.status).toBe(200);
  });

  it('refuses to demote the last full admin out of super-admins', async () => {
    sqlDb([FIND_USER, () => ({ rows: adminRow(null) })],
      [LAST_ADMIN, () => ({ rows: [{ c: 0 }] })]);
    const r = await moveRole(T, { role: 'employer' });
    expect(r.status).toBe(409);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('allows the demotion when another full admin remains', async () => {
    sqlDb([FIND_USER, () => ({ rows: adminRow(null) })],
      [LAST_ADMIN, () => ({ rows: [{ c: 1 }] })]);
    const r = await moveRole(T, { role: 'employer' });
    expect(r.status).toBe(200);
    expect(mocks.connect).toHaveBeenCalled();
  });

  it('refuses to tag the last full admin with a custom role', async () => {
    sqlDb([FIND_USER, () => ({ rows: adminRow(null) })],
      [ROLE_BUNDLE, () => ({ rows: [{ permissions: ['users.manage'] }] })],
      [LAST_ADMIN, () => ({ rows: [{ c: 0 }] })]);
    const r = await assign(T, { custom_role_id: 41 });
    expect(r.status).toBe(409);
    expect(mocks.query.mock.calls.some(([t]) => /^update super_admins/.test(t))).toBe(false);
  });
});
