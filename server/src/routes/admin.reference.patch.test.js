import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  role: 'super-admin',
  customRoleId: null,
  permissions: [],
}));

vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => {
    req.user = { id: 'admin-1', email: 'a@x.com', role: mocks.role, customRoleId: mocks.customRoleId, permissions: mocks.permissions };
    next();
  },
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  supa: () => ({ auth: {} }),
}));

process.env.RETENTION_DISABLE = '1';
const { default: adminRoutes } = await import('./admin-reference.js');

const EXISTING = { id: 5, category: 'employment_type', value: 'Full-time', sort_order: 1 };
const UPDATED = { id: 5, category: 'employment_type', value: 'Part-time', sort_order: 2 };

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
  mocks.poolQuery.mockReset().mockImplementation(async (sql) => {
    const s = String(sql);
    if (/select id, category, value, sort_order from reference_data where id/.test(s)) {
      return { rows: [EXISTING] };
    }
    if (/select id from reference_data where category/.test(s)) {
      return { rows: [] };
    }
    if (/update reference_data set/.test(s)) {
      return { rows: [UPDATED] };
    }
    return { rows: [] };
  });
});

const patch = (id, body) => fetch(`${base}/admin/reference/${id}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const auditCalls = () => mocks.poolQuery.mock.calls.filter((c) => /insert into audit_logs/.test(String(c[0])));

describe('PATCH /admin/reference/:id', () => {
  it('rename succeeds (200, audit written once)', async () => {
    const r = await patch(5, { value: 'Part-time' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ value: 'Part-time' });
    expect(auditCalls()).toHaveLength(1);
    const [sql, params] = auditCalls()[0];
    expect(String(sql)).toContain('audit_logs');
    expect(params[1]).toBe('settings.reference.update');
    expect(params[2]).toBe('reference_data');
  });

  it('reorder (sort_order) succeeds', async () => {
    mocks.poolQuery.mockImplementation(async (sql) => {
      const s = String(sql);
      if (/select id, category, value, sort_order from reference_data where id/.test(s)) return { rows: [EXISTING] };
      if (/update reference_data set/.test(s)) return { rows: [{ ...EXISTING, sort_order: 7 }] };
      return { rows: [] };
    });
    const r = await patch(5, { sort_order: 7 });
    expect(r.status).toBe(200);
    expect((await r.json()).sort_order).toBe(7);
  });

  it('duplicate value -> 409 CONFLICT', async () => {
    mocks.poolQuery.mockImplementation(async (sql) => {
      const s = String(sql);
      if (/select id, category, value, sort_order from reference_data where id/.test(s)) return { rows: [EXISTING] };
      if (/select id from reference_data where category/.test(s)) return { rows: [{ id: 9 }] };
      return { rows: [] };
    });
    const r = await patch(5, { value: 'Full-time' });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe('CONFLICT');
  });

  it('custom_role -> 400', async () => {
    mocks.poolQuery.mockImplementation(async (sql) => {
      const s = String(sql);
      if (/select id, category, value, sort_order from reference_data where id/.test(s)) {
        return { rows: [{ id: 5, category: 'custom_role', value: 'X', sort_order: 0 }] };
      }
      return { rows: [] };
    });
    const r = await patch(5, { value: 'Y' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
  });

  it('unknown id -> 404', async () => {
    mocks.poolQuery.mockImplementation(async () => ({ rows: [] }));
    const r = await patch(999, { value: 'Y' });
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe('NOT_FOUND');
  });

  it('missing id -> 404', async () => {
    const r = await fetch(`${base}/admin/reference/`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'Y' }) });
    expect(r.status).toBe(404);
  });

  it('no fields -> 400', async () => {
    const r = await patch(5, {});
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
  });

  it('invalid sort_order -> 400', async () => {
    const r = await patch(5, { sort_order: 'abc' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
  });

  it('tagged admin without settings.manage -> 403', async () => {
    mocks.customRoleId = 7;
    mocks.permissions = ['reports.view'];
    const r = await patch(5, { value: 'Y' });
    expect(r.status).toBe(403);
  });
});