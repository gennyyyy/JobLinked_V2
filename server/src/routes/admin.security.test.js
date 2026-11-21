import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// Runtime tests for the security fixes on the admin routes: the invite must
// pin the provider-side role in auth.user and the pending grant in
// admin_invites (server-only), PATCH /admin/users/:id must refuse self
// status/custom_role edits and never pass a body updated_at into the SET list,
// and the unread-notification badge must be per-user.
const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  txQuery: vi.fn(),
  connect: vi.fn(),
  reset: vi.fn(),
  supabase: vi.fn(),
  role: 'super-admin',
  userId: 'admin-1',
}));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery, connect: mocks.connect } }));
vi.mock('../ba.js', () => ({ auth: { api: { requestPasswordReset: mocks.reset } } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: mocks.userId, email: 'a@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  // Supabase is gone from these routes (ADR-056); any call fails the test.
  supa: mocks.supabase,
}));
process.env.RETENTION_DISABLE = '1';
process.env.CORS_ORIGIN = 'https://app.test';
const { default: adminRoutes } = await import('./admin.js');
const { default: adminUsersRoutes } = await import('./admin-users.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', adminRoutes, adminUsersRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  mocks.role = 'super-admin';
  mocks.userId = 'admin-1';
  mocks.poolQuery.mockReset();
  mocks.txQuery.mockReset().mockImplementation(async (sql) => (
    /insert into auth\."user"/.test(String(sql)) ? { rows: [{ id: 'auth-uuid-1' }] } : { rows: [] }));
  mocks.connect.mockReset().mockResolvedValue({ query: mocks.txQuery, release: vi.fn() });
  mocks.reset.mockReset().mockResolvedValue({ status: true });
  mocks.supabase.mockReset();
});

// Real uuid: a malformed :id now answers 404 from findUserTable (S1).
const U2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const invitePost = (body) => fetch(`${base}/admin/users/invite`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const patchUser = (id, body) => fetch(`${base}/admin/users/${id}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('invite pins the role grant server-side', () => {
  const authInsert = () => mocks.txQuery.mock.calls.find(([sql]) => /insert into auth\."user"/.test(String(sql)));
  const inviteInsert = () => mocks.txQuery.mock.calls.find(([sql]) => /insert into public\.admin_invites/.test(String(sql)));

  it('201 and the admin_invites row carries the role and tag', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    const r = await invitePost({ email: 'new@x.com', role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(r.status).toBe(201);
    expect(inviteInsert()[1].slice(0, 3)).toEqual(['auth-uuid-1', 'job-seeker', null]);
    expect(mocks.reset).toHaveBeenCalledWith({
      body: { email: 'new@x.com', redirectTo: 'https://app.test/reset-password' },
    });
    expect(mocks.supabase).not.toHaveBeenCalled();
  });

  it('super-admin invites are pinned into auth.user.role too', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    const r = await invitePost({ email: 'boss@x.com', role: 'super-admin', first_name: 'Cid', last_name: 'Reyes' });
    expect(r.status).toBe(201);
    expect(authInsert()[1]).toEqual(['Cid Reyes', 'boss@x.com', 'super-admin']);
    expect(inviteInsert()[1].slice(0, 3)).toEqual(['auth-uuid-1', 'super-admin', null]);
  });

  it('502 when the reset email fails, and the half-created auth.user row is deleted', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    mocks.reset.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    const r = await invitePost({ email: 'f@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(502);
    expect((await r.json()).error.code).toBe('UPSTREAM_ERROR');
    expect(mocks.poolQuery.mock.calls.some(([sql]) => /delete from auth\."user" where "id" = \$1/.test(String(sql)))).toBe(true);
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
      .mockResolvedValueOnce({ rows: [{ id: U2, status: 'suspended' }] });
    const r = await patchUser(U2, { status: 'suspended' });
    expect(r.status).toBe(200);
    const update = mocks.poolQuery.mock.calls[1][0];
    expect(update).toContain('status = $2');
  });
});

describe('PATCH /admin/users/:id timestamp handling', () => {
  it('drops a body updated_at instead of duplicating the column (PG 42701)', async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ tbl: 'job_seekers', profile: { status: 'active', id: U2 } }] })
      .mockResolvedValueOnce({ rows: [{ id: U2, full_name: 'New Name' }] });
    const r = await patchUser(U2, { full_name: 'New Name', updated_at: '1999-01-01T00:00:00Z', id: 'x', created_at: 'y' });
    expect(r.status).toBe(200);
    const [sql, params] = mocks.poolQuery.mock.calls[1];
    expect(sql).toContain('updated_at = now()');
    expect(sql).not.toMatch(/updated_at = \$\d/);
    expect(params).toEqual([U2, 'New Name']);
  });

  it('B13/F2: a body email never reaches the UPDATE (no local-vs-Supabase desync)', async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ tbl: 'job_seekers', profile: { status: 'active', id: U2 } }] })
      .mockResolvedValueOnce({ rows: [{ id: U2, status: 'suspended' }] });
    const r = await patchUser(U2, { email: 'taken@x.com', status: 'suspended' });
    expect(r.status).toBe(200);
    const [sql, params] = mocks.poolQuery.mock.calls[1];
    expect(sql).not.toContain('email =');
    expect(params).toEqual([U2, 'suspended']);
  });

  it('B13/F2: an email-only body is "Nothing to update" — email changes are blocked, not written', async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ tbl: 'job_seekers', profile: { status: 'active', id: U2 } }] });
    const r = await patchUser(U2, { email: 'taken@x.com' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    // No UPDATE was ever built from an email key.
    expect(mocks.poolQuery).toHaveBeenCalledTimes(1);
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
