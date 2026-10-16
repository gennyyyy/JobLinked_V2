import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// Migration 008 added employer_accreditations_one_pending_uidx — a partial
// unique index: at most one row with status = 'pending' per company_id.
// auth.js:116 already opens a pending row at signup, so the submit insert must
// reuse that row (ON CONFLICT ... DO UPDATE) instead of inserting a duplicate,
// which the index would reject with 23505 → HTTP 500 on every first submit.
const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  role: 'employer',
  userId: 'emp-1',
  accreditationRow: { id: 'acc-1', company_id: 'emp-1', status: 'pending', submitted_at: '2026-10-15T00:00:00Z' },
}));

vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));

vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: mocks.userId, email: 'e@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    (roles.includes(mocks.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } })),
}));

const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();

mocks.poolQuery.mockImplementation(async (sql) =>
  (norm(sql).startsWith('insert into employer_accreditations') ? { rows: [mocks.accreditationRow] } : { rows: [] }));

const { default: profileRoutes } = await import('./profiles.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', profileRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));

const accInsert = () => mocks.poolQuery.mock.calls
  .map(([sql, params]) => ({ sql: norm(sql), params }))
  .find((c) => c.sql.startsWith('insert into employer_accreditations'));

const submit = () => fetch(`${base}/accreditations`, { method: 'POST', headers: { 'content-type': 'application/json' } });

describe('POST /accreditations under the one-pending-row partial index', () => {
  beforeEach(() => {
    mocks.role = 'employer';
    mocks.userId = 'emp-1';
    mocks.poolQuery.mockClear();
  });

  it('reuses the signup pending row: ON CONFLICT (company_id) where status = pending, DO UPDATE', async () => {
    const r = await submit();
    expect(r.status).toBe(201);
    const insert = accInsert();
    expect(insert).toBeTruthy();
    expect(insert.sql).toContain("on conflict (company_id) where status = 'pending'");
    expect(insert.sql).toContain('do update set submitted_at = now()');
    expect(insert.sql).toContain('returning *');
  });

  it('still answers 201 with the existing pending row', async () => {
    const r = await submit();
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual(mocks.accreditationRow);
  });

  it('passes the company id as a parameter — no interpolated user input', async () => {
    mocks.userId = 'emp-1" on conflict do nothing; drop table employers; --';
    const r = await submit();
    expect(r.status).toBe(201);
    const insert = accInsert();
    expect(insert.params).toEqual([mocks.userId]);
    expect(insert.sql).not.toContain('drop table');
    expect(insert.sql).not.toContain(mocks.userId);
  });

  it('403 when the caller is not an employer', async () => {
    mocks.role = 'job-seeker';
    const r = await submit();
    expect(r.status).toBe(403);
    expect(accInsert()).toBeUndefined();
  });
});
