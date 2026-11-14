// Task 2: GET /admin/users?skills=&education=&experience= narrows the
// job_seekers branch only. The terms are trimmed, capped at 80 chars, blank
// values are dropped, and the existing status/search params keep their order.
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
  supa: () => ({ auth: {} }),
}));
const { default: adminRoutes } = await import('./admin-users.js');

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

const get = (qs) => fetch(`${base}/admin/users${qs}`);
// The count query carries the whole union + where, so it is the cheapest place
// to read the generated SQL and params.
const countCall = () => mocks.poolQuery.mock.calls
  .map((c) => ({ sql: String(c[0]), params: c[1] || [] }))
  .find((c) => /count\(\*\)::int/.test(c.sql));

describe('GET /admin/users seeker filters', () => {
  it('applies skills/education/experience inside the job_seekers branch', async () => {
    const r = await get('?role=job-seeker&skills=weld&education=BSIT&experience=cashier');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: [], total: 0, page: 1, pageSize: 25 });

    const { sql, params } = countCall();
    expect(sql).toContain("array_to_string(x.skills, ' ') ilike $1");
    expect(sql).toContain('x.education_summary ilike $2');
    expect(sql).toContain('x.experience_summary ilike $3');
    expect(sql).toMatch(/from job_seekers x where /);
    expect(params).toEqual(['%weld%', '%BSIT%', '%cashier%']);
  });

  it('keeps status and search params ahead of the seeker terms', async () => {
    await get('?role=job-seeker&status=active&search=ana&skills=weld');
    const { sql, params } = countCall();
    expect(sql).toContain("t.profile->>'status' = $1");
    expect(sql).toContain('ilike $2');
    expect(sql).toContain('ilike $3');
    expect(params).toEqual(['active', '%ana%', '%ana%', '%weld%']);
  });

  it('ignores blank and whitespace-only terms', async () => {
    await get('?role=job-seeker&skills=%20%20&education=&experience=%20');
    const { sql, params } = countCall();
    expect(params).toEqual([]);
    expect(sql).not.toContain('ilike');
  });

  it('ignores the terms on a non-seeker role filter', async () => {
    await get('?role=employer&skills=weld&education=BSIT&experience=cashier');
    const { sql, params } = countCall();
    expect(sql).not.toContain('array_to_string');
    expect(sql).not.toContain('education_summary');
    expect(params).toEqual([]);
  });

  it('ignores the terms when no role filter is given', async () => {
    await get('?skills=weld');
    const { sql, params } = countCall();
    expect(sql).not.toContain('array_to_string');
    expect(params).toEqual([]);
  });

  it('400s on a term longer than 80 characters without querying', async () => {
    const r = await get(`?role=job-seeker&skills=${'a'.repeat(81)}`);
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('403s a caller that is not a super-admin', async () => {
    mocks.role = 'employer';
    const r = await get('?role=job-seeker&skills=weld');
    expect(r.status).toBe(403);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });
});
