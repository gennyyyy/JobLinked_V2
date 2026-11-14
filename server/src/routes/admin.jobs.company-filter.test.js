// Task 3: GET /admin/jobs?company_id=<uuid> narrows the existing list to one
// employer. Optional and UUID-validated (400 on malformed); the status
// allow-list and the { data, total, page, pageSize } envelope are unchanged.
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn(), role: 'super-admin' }));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => {
    req.user = { id: 'admin-1', email: 'a@x.com', role: mocks.role };
    next();
  },
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  optionalAuth: (_req, _res, next) => next(),
  supa: () => ({ auth: {} }),
}));
const { default: adminRoutes } = await import('./admin-jobs.js');

const COMPANY = '11111111-1111-4111-8111-111111111111';

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
  mocks.poolQuery.mockReset().mockImplementation(async (sql) => (
    /count\(\*\)::int/.test(String(sql)) ? { rows: [{ c: 0 }] } : { rows: [] }));
});

const get = (qs) => fetch(`${base}/admin/jobs${qs}`);
// The count query carries the whole from/where, so it is the cheapest place
// to read the generated SQL and params.
const countCall = () => mocks.poolQuery.mock.calls
  .map((c) => ({ sql: String(c[0]), params: c[1] || [] }))
  .find((c) => /count\(\*\)::int/.test(c.sql));

describe('GET /admin/jobs company filter', () => {
  it('adds company_id to the where clause and keeps the list envelope', async () => {
    const r = await get(`?company_id=${COMPANY}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: [], total: 0, page: 1, pageSize: 25 });

    const { sql, params } = countCall();
    expect(sql).toContain('where j.company_id = $1');
    expect(params).toEqual([COMPANY]);
  });

  it('combines company_id with the existing status filter', async () => {
    const r = await get(`?company_id=${COMPANY}&status=published`);
    expect(r.status).toBe(200);
    const { sql, params } = countCall();
    expect(sql).toContain('where j.status = $1 and j.company_id = $2');
    expect(params).toEqual(['published', COMPANY]);
  });

  it('leaves the query unchanged without company_id', async () => {
    await get('');
    const { sql, params } = countCall();
    expect(sql).not.toContain('j.company_id = ');
    expect(sql).not.toContain('where');
    expect(params).toEqual([]);
  });

  it('keeps the status-only query unchanged', async () => {
    await get('?status=published');
    const { sql, params } = countCall();
    expect(sql).toContain('where j.status = $1');
    expect(sql).not.toContain('j.company_id = ');
    expect(params).toEqual(['published']);
  });

  it('400s a malformed company_id without querying', async () => {
    const r = await get('?company_id=not-a-uuid');
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('403s a caller that is not a super-admin', async () => {
    mocks.role = 'employer';
    const r = await get(`?company_id=${COMPANY}`);
    expect(r.status).toBe(403);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });
});
