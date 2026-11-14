// Task 5: POST /admin/users/:id/reset-password sends Supabase's recovery email.
// Success is always { sent: true }; the address is never echoed, missing users
// 404, rate limits 429, other upstream failures 502, and every send is audited.
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(), reset: vi.fn(), role: 'super-admin', customRoleId: null, permissions: [],
}));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => {
    req.user = {
      id: 'admin-1', email: 'admin@x.com', role: mocks.role,
      customRoleId: mocks.customRoleId, permissions: mocks.permissions,
    };
    next();
  },
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  supa: () => ({ auth: { resetPasswordForEmail: mocks.reset } }),
}));
process.env.CORS_ORIGIN = 'https://app.test';
const { default: adminRoutes } = await import('./admin-users.js');

const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'seek@x.com', status: 'active' };

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
  mocks.customRoleId = null;
  mocks.permissions = [];
  mocks.reset.mockReset().mockResolvedValue({ data: {}, error: null });
  mocks.poolQuery.mockReset().mockImplementation(async (sql) => (
    /select tbl, profile from/.test(String(sql))
      ? { rows: [{ tbl: 'job_seekers', profile: USER }] }
      : { rows: [] }));
});

const post = (id = USER.id) => fetch(`${base}/admin/users/${id}/reset-password`, { method: 'POST' });
const auditCall = () => mocks.poolQuery.mock.calls.find((c) => /insert into audit_logs/.test(String(c[0])));

describe('POST /admin/users/:id/reset-password', () => {
  it('sends the recovery email to the stored address and audits the send', async () => {
    const r = await post();
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body).toEqual({ sent: true });
    expect(JSON.stringify(body)).not.toContain(USER.email);
    expect(mocks.reset).toHaveBeenCalledWith(USER.email, { redirectTo: 'https://app.test/reset-password' });

    const [sql, params] = auditCall();
    expect(String(sql)).toContain('audit_logs');
    expect(params[1]).toBe('user.password.reset');
    expect(params[2]).toBe('job_seekers');
    expect(params[3]).toBe(USER.id);
  });

  it('404s a user that no role table holds, without emailing', async () => {
    mocks.poolQuery.mockImplementation(async () => ({ rows: [] }));
    const r = await post();
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe('NOT_FOUND');
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it('429s a Supabase rate limit and audits nothing', async () => {
    mocks.reset.mockResolvedValue({ data: null, error: { status: 429, message: 'Email rate limit exceeded' } });
    const r = await post();
    const body = await r.json();
    expect(r.status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(JSON.stringify(body)).not.toContain(USER.email);
    expect(auditCall()).toBeUndefined();
  });

  it('502s another upstream failure without leaking the address', async () => {
    mocks.reset.mockResolvedValue({ data: null, error: { status: 500, message: `smtp rejected ${USER.email}` } });
    const r = await post();
    const body = await r.json();
    expect(r.status).toBe(502);
    expect(body.error.code).toBe('UPSTREAM_ERROR');
    expect(JSON.stringify(body)).not.toContain(USER.email);
    expect(auditCall()).toBeUndefined();
  });

  it('403s a caller that is not a super-admin', async () => {
    mocks.role = 'employer';
    const r = await post();
    expect(r.status).toBe(403);
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it('403s a tagged admin without users.manage', async () => {
    mocks.customRoleId = 7;
    mocks.permissions = ['reports.view'];
    const r = await post();
    expect(r.status).toBe(403);
    expect((await r.json()).error.message).toContain('users.manage');
    expect(mocks.poolQuery).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();
  });
});
