import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  resolveRole: vi.fn(),
  tokenEmail: 'user@x.com',
}));

vi.mock('../db.js', () => ({
  pool: {
    query: mocks.poolQuery,
    connect: async () => ({ query: mocks.poolQuery, release: () => {} }),
  },
}));

vi.mock('../auth.js', () => ({
  tokenAuth: (req, res, next) => {
    const auth = req.headers.authorization || '';
    if (!/^bearer\s+/i.test(auth)) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing access token' } });
    }
    req.user = { id: 'user-1', email: mocks.tokenEmail, app_metadata: {} };
    next();
  },
  resolveRole: mocks.resolveRole,
}));

const { default: authRoutes } = await import('./auth.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', authRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  mocks.poolQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mocks.tokenEmail = 'user@x.com';
});

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload || {})).toString('base64url');
  return `${header}.${body}.sig`;
}

const me = (headers) => fetch(`${base}/auth/me`, { headers: headers || {} });

describe('auth/me permissions', () => {
  it('full admin: permissions null, custom_role_id null, aal present', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'super-admin', profile: { id: 'user-1', status: 'active', email: 'user@x.com', custom_role_id: null }, custom_role_id: null, permissions: [] });
    const token = makeJwt({ aal: 'aal1' });
    const r = await me({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.permissions).toBeNull();
    expect(body.custom_role_id).toBeNull();
    expect(body.aal).toBeTruthy();
  });

  it('tagged admin: permissions equals bundle, custom_role_id equals id', async () => {
    const bundle = ['settings.manage', 'users.read'];
    mocks.resolveRole.mockResolvedValue({ role: 'super-admin', profile: { id: 'user-1', status: 'active', email: 'user@x.com', custom_role_id: 7 }, custom_role_id: 7, permissions: bundle });
    const token = makeJwt({ aal: 'aal2' });
    const r = await me({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.permissions).toEqual(bundle);
    expect(body.custom_role_id).toBe(7);
    expect(body.aal).toBe('aal2');
  });

  it('non-admin job-seeker: permissions [], custom_role_id null', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'job-seeker', profile: { id: 'user-1', status: 'active', email: 'user@x.com', custom_role_id: null }, custom_role_id: null, permissions: [] });
    const token = makeJwt({});
    const r = await me({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.permissions).toEqual([]);
    expect(body.custom_role_id).toBeNull();
  });

  it('differing token email sync still works', async () => {
    mocks.tokenEmail = 'new@x.com';
    mocks.resolveRole.mockResolvedValue({ role: 'employer', profile: { id: 'user-1', status: 'active', email: 'old@x.com', custom_role_id: null }, custom_role_id: null, permissions: [] });
    const token = makeJwt({});
    const r = await me({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.email).toBe('new@x.com');
    const updates = mocks.poolQuery.mock.calls.filter(([sql]) => /update employers/i.test(sql));
    expect(updates).toHaveLength(1);
  });

  it('invalid token shape (no Bearer) -> 401', async () => {
    const r = await fetch(`${base}/auth/me`);
    expect(r.status).toBe(401);
  });
});