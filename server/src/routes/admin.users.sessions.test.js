// Task 6: POST /admin/users/:id/sign-out revokes every refresh token through
// GoTrue's admin endpoint. No impersonation route exists.
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { err } from '../util.js';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(), role: 'super-admin', customRoleId: null, permissions: [],
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
  supa: () => ({ auth: {} }),
}));
process.env.SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
const { default: adminRoutes } = await import('./admin-users.js');

const USER = { id: '22222222-2222-4222-8222-222222222222', email: 'seek@x.com', status: 'active' };

// The route's outbound call is the only fetch that is not this test's own
// request to the local server, so route by URL.
const realFetch = globalThis.fetch;
const upstream = vi.fn();
vi.stubGlobal('fetch', (url, init) => (String(url).startsWith(base) ? realFetch(url, init) : upstream(url, init)));

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', adminRoutes);
  app.use('/api', (_req, res) => err(res, 404, 'NOT_FOUND', 'Route not found'));
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => {
  vi.unstubAllGlobals();
  return new Promise((r) => server.close(r));
});
beforeEach(() => {
  mocks.role = 'super-admin';
  mocks.customRoleId = null;
  mocks.permissions = [];
  upstream.mockReset().mockResolvedValue({ ok: true, status: 200, body: { cancel: vi.fn() } });
  mocks.poolQuery.mockReset().mockImplementation(async (sql) => (
    /select tbl, profile from/.test(String(sql))
      ? { rows: [{ tbl: 'job_seekers', profile: USER }] }
      : { rows: [] }));
});

const post = (path = `/admin/users/${USER.id}/sign-out`) => fetch(`${base}${path}`, { method: 'POST' });
const auditCall = () => mocks.poolQuery.mock.calls.find((c) => /insert into audit_logs/.test(String(c[0])));

describe('POST /admin/users/:id/sign-out', () => {
  it('calls the GoTrue admin logout endpoint with the service-role key and audits it', async () => {
    const r = await post();
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body).toEqual({ signedOut: true });
    expect(JSON.stringify(body)).not.toContain('service-key');

    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe(`https://supa.test/auth/v1/admin/users/${USER.id}/logout`);
    expect(init.method).toBe('POST');
    expect(init.headers.apikey).toBe('service-key');
    expect(init.headers.Authorization).toBe('Bearer service-key');

    const [sql, params] = auditCall();
    expect(String(sql)).toContain('audit_logs');
    expect(params[1]).toBe('user.sessions.revoke');
    expect(params[2]).toBe('job_seekers');
    expect(params[3]).toBe(USER.id);
  });

  it('502s an upstream failure and audits nothing', async () => {
    upstream.mockResolvedValue({ ok: false, status: 500, body: { cancel: vi.fn() } });
    const r = await post();
    expect(r.status).toBe(502);
    expect((await r.json()).error.code).toBe('UPSTREAM_ERROR');
    expect(auditCall()).toBeUndefined();
  });

  it('502s a network failure', async () => {
    upstream.mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await post();
    expect(r.status).toBe(502);
    expect((await r.json()).error.code).toBe('UPSTREAM_ERROR');
  });

  it('404s a user no role table holds, without calling upstream', async () => {
    mocks.poolQuery.mockImplementation(async () => ({ rows: [] }));
    const r = await post();
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe('NOT_FOUND');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('403s a caller that is not a super-admin', async () => {
    mocks.role = 'employer';
    const r = await post();
    expect(r.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('403s a tagged admin without users.manage', async () => {
    mocks.customRoleId = 7;
    mocks.permissions = ['reports.view'];
    const r = await post();
    expect(r.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('has no impersonation route (decision: impersonation is rejected)', async () => {
    const r = await post(`/admin/users/${USER.id}/impersonate`);
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe('NOT_FOUND');
    expect(upstream).not.toHaveBeenCalled();
  });
});
