import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// Runtime tests for the security fixes on the admin routes: the invite must
// write the role into app_metadata (service-role only), PATCH /admin/users/:id
// must refuse self status/custom_role edits and never pass a body updated_at
// into the SET list, and the unread-notification badge must be per-user.
const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  invite: vi.fn(),
  updateUser: vi.fn(),
  role: 'super-admin',
  userId: 'admin-1',
}));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: mocks.userId, email: 'a@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  // S7: supa is a lazy getter, not a module-scope client.
  supa: () => ({ auth: { admin: { inviteUserByEmail: mocks.invite, updateUserById: mocks.updateUser } } }),
}));
process.env.RETENTION_DISABLE = '1';
process.env.CORS_ORIGIN = 'https://app.test';
const { default: adminRoutes } = await import('./admin.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', adminRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  mocks.role = 'super-admin';
  mocks.userId = 'admin-1';
  mocks.poolQuery.mockReset();
  mocks.invite.mockReset();
  mocks.updateUser.mockReset().mockResolvedValue({ data: { user: {} }, error: null });
});

// Real uuid: a malformed :id now answers 404 from findUserTable (S1).
const U2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const invitePost = (body) => fetch(`${base}/admin/users/invite`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const patchUser = (id, body) => fetch(`${base}/admin/users/${id}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('invite writes the role into app_metadata', () => {
  it('201 and updateUserById is called with { app_metadata: { role } }', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    mocks.invite.mockResolvedValue({ data: { user: { id: 'auth-uuid-1' } }, error: null });
    const r = await invitePost({ email: 'new@x.com', role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(r.status).toBe(201);
    expect(mocks.invite).toHaveBeenCalledWith('new@x.com', expect.objectContaining({
      redirectTo: 'https://app.test/accept-invite',
      data: expect.objectContaining({ role: 'job-seeker' }),
    }));
    expect(mocks.updateUser).toHaveBeenCalledWith('auth-uuid-1', { app_metadata: { role: 'job-seeker' } });
  });

  it('super-admin invites are pinned into app_metadata too', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    mocks.invite.mockResolvedValue({ data: { user: { id: 'auth-uuid-2' } }, error: null });
    const r = await invitePost({ email: 'boss@x.com', role: 'super-admin', first_name: 'Cid', last_name: 'Reyes' });
    expect(r.status).toBe(201);
    expect(mocks.updateUser).toHaveBeenCalledWith('auth-uuid-2', { app_metadata: { role: 'super-admin' } });
  });

  it('500 when the app_metadata write fails (invite already sent)', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    mocks.invite.mockResolvedValue({ data: { user: { id: 'auth-uuid-3' } }, error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: { message: 'boom' } });
    const r = await invitePost({ email: 'f@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(500);
    expect((await r.json()).error.code).toBe('INTERNAL');
    expect(mocks.invite).toHaveBeenCalled();
  });
});

describe('PATCH /admin/users/:id self-guard', () => {
  it('403 and no write when suspending yourself', async () => {
    mocks.userId = 'admin-1';
    const r = await patchUser('admin-1', { status: 'suspended' });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe('FORBIDDEN');
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('403 and no write when re-tagging your own custom role', async () => {
    mocks.userId = 'admin-1';
    const r = await patchUser('admin-1', { custom_role_id: 7 });
    expect(r.status).toBe(403);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('still lets an admin change another user status', async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ tbl: 'job_seekers', profile: { status: 'active', id: U2 } }] })
      .mockResolvedValueOnce({ rows: [{ column_name: 'status' }, { column_name: 'full_name' }] })
      .mockResolvedValueOnce({ rows: [{ id: U2, status: 'suspended' }] });
    const r = await patchUser(U2, { status: 'suspended' });
    expect(r.status).toBe(200);
    const update = mocks.poolQuery.mock.calls[2][0];
    expect(update).toContain('status = $2');
  });
});

describe('PATCH /admin/users/:id timestamp handling', () => {
  it('drops a body updated_at instead of duplicating the column (PG 42701)', async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ tbl: 'job_seekers', profile: { status: 'active', id: U2 } }] })
      .mockResolvedValueOnce({ rows: [{ column_name: 'full_name' }, { column_name: 'updated_at' }, { column_name: 'created_at' }] })
      .mockResolvedValueOnce({ rows: [{ id: U2, full_name: 'New Name' }] });
    const r = await patchUser(U2, { full_name: 'New Name', updated_at: '1999-01-01T00:00:00Z', id: 'x', created_at: 'y' });
    expect(r.status).toBe(200);
    const [sql, params] = mocks.poolQuery.mock.calls[2];
    expect(sql).toContain('updated_at = now()');
    expect(sql).not.toMatch(/updated_at = \$\d/);
    expect(params).toEqual([U2, 'New Name']);
  });

  it('B13/F2: a body email never reaches the UPDATE (no local-vs-Supabase desync)', async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ tbl: 'job_seekers', profile: { status: 'active', id: U2 } }] })
      .mockResolvedValueOnce({ rows: [{ column_name: 'email' }, { column_name: 'status' }] })
      .mockResolvedValueOnce({ rows: [{ id: U2, status: 'suspended' }] });
    const r = await patchUser(U2, { email: 'taken@x.com', status: 'suspended' });
    expect(r.status).toBe(200);
    const [sql, params] = mocks.poolQuery.mock.calls[2];
    expect(sql).not.toContain('email =');
    expect(params).toEqual([U2, 'suspended']);
  });

  it('B13/F2: an email-only body is "Nothing to update" — email changes are blocked, not written', async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ tbl: 'job_seekers', profile: { status: 'active', id: U2 } }] })
      .mockResolvedValueOnce({ rows: [{ column_name: 'email' }] });
    const r = await patchUser(U2, { email: 'taken@x.com' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    // No UPDATE was ever built from an email key.
    expect(mocks.poolQuery).toHaveBeenCalledTimes(2);
  });

  it('404 NOT_FOUND for a malformed user id (S1)', async () => {
    const r = await patchUser('not-a-uuid', { status: 'suspended' });
    expect(r.status).toBe(404);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });
});

describe('GET /admin/stats unread notifications', () => {
  it('counts only the caller unread rows', async () => {
    // The six queries in registration order: job_seekers, pending accreditations,
    // unread notifications, employers, job_vacancies, job_applications.
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ c: 2 }] })
      .mockResolvedValueOnce({ rows: [{ c: 1 }] })
      .mockResolvedValueOnce({ rows: [{ c: 3 }] })
      .mockResolvedValueOnce({ rows: [{ employers: 4, accredited: 1 }] })
      .mockResolvedValueOnce({ rows: [{ jobs: 5, pending: 1, approved: 1, closed: 1, expired: 1 }] })
      .mockResolvedValueOnce({ rows: [{ applications: 6, accepted: 1, placed: 1 }] });
    const r = await fetch(`${base}/admin/stats`);
    expect(r.status).toBe(200);
    const call = mocks.poolQuery.mock.calls.find((c) => /notifications/.test(c[0]));
    expect(call).toBeTruthy();
    expect(call[0]).toMatch(/is_read = false and user_id = \$1/);
    expect(call[1]).toEqual(['admin-1']);
  });
});
