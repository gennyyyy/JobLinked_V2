import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  role: 'super-admin',
  customRoleId: null,
  permissions: [],
  userId: 'admin-1',
}));

vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => {
    req.user = { id: mocks.userId, email: 'a@x.com', role: mocks.role, customRoleId: mocks.customRoleId, permissions: mocks.permissions };
    next();
  },
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  supa: () => ({ auth: {} }),
}));

const { default: legalRoutes } = await import('./legal.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', legalRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  mocks.role = 'super-admin';
  mocks.customRoleId = null;
  mocks.permissions = [];
  mocks.userId = 'admin-1';
  mocks.poolQuery.mockReset().mockImplementation(async (sql, params) => {
    const s = String(sql);
    if (/select key, body, updated_at from legal_documents where key/.test(s)) {
      const key = params?.[0];
      if (key === 'terms') return { rows: [{ key: 'terms', body: 'seeded terms body', updated_at: '2026-01-01T00:00:00Z' }] };
      if (key === 'privacy') return { rows: [{ key: 'privacy', body: 'seeded privacy body', updated_at: '2026-01-01T00:00:00Z' }] };
      return { rows: [] };
    }
    if (/update legal_documents set/.test(s)) {
      const key = params?.[2];
      return { rows: [{ key, body: params?.[0], updated_at: '2026-02-02T00:00:00Z' }] };
    }
    return { rows: [] };
  });
});

const auditCalls = () => mocks.poolQuery.mock.calls.filter((c) => /insert into audit_logs/.test(String(c[0])));

describe('GET /legal/:key', () => {
  it('privacy -> 200 with seeded body', async () => {
    const r = await fetch(`${base}/legal/privacy`);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.key).toBe('privacy');
    expect(j.body).toBe('seeded privacy body');
  });
  it('terms -> 200', async () => {
    const r = await fetch(`${base}/legal/terms`);
    expect(r.status).toBe(200);
    expect((await r.json()).key).toBe('terms');
  });
  it('foo -> 400', async () => {
    const r = await fetch(`${base}/legal/foo`);
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
  });
  it('no row -> 404', async () => {
    mocks.poolQuery.mockImplementation(async () => ({ rows: [] }));
    const r = await fetch(`${base}/legal/privacy`);
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /admin/legal/:key', () => {
  it('success -> 200, audit once, body echoed', async () => {
    const r = await fetch(`${base}/admin/legal/privacy`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'updated body' }),
    });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.key).toBe('privacy');
    expect(j.body).toBe('updated body');
    expect(auditCalls()).toHaveLength(1);
  });
  it('empty body -> 400', async () => {
    const r = await fetch(`${base}/admin/legal/privacy`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: '   ' }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
  });
  it('invalid key -> 400', async () => {
    const r = await fetch(`${base}/admin/legal/foo`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'x' }),
    });
    expect(r.status).toBe(400);
  });
  it('unknown key (no row) -> 404', async () => {
    mocks.poolQuery.mockImplementation(async (sql) => {
      const s = String(sql);
      if (/update legal_documents set/.test(s)) return { rows: [] };
      return { rows: [] };
    });
    const r = await fetch(`${base}/admin/legal/privacy`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'x' }),
    });
    expect(r.status).toBe(404);
  });
  it('non-admin -> 403', async () => {
    mocks.role = 'job-seeker';
    const r = await fetch(`${base}/admin/legal/privacy`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'x' }),
    });
    expect(r.status).toBe(403);
  });
  it('tagged admin without settings.manage -> 403', async () => {
    mocks.customRoleId = 7;
    mocks.permissions = ['reports.view'];
    const r = await fetch(`${base}/admin/legal/privacy`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'x' }),
    });
    expect(r.status).toBe(403);
  });
});
