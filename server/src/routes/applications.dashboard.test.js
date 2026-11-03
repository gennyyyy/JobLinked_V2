import { readFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// GET /api/applications/employers/me/dashboard — the counters + recent
// applicants an Employer Dashboard renders, scoped to the session employer.
// Runtime tests drive the REAL route against a mocked pool: the three queries
// must bind the CALLER's id (from the token, never a client-supplied id) and
// the response must carry the null-safe jobs/stats/recent shape. The single
// source-text block below covers the two SQL-window constants (limit 5, 7-day
// window) that have no observable behaviour at this layer without a live DB.

const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const src = srv('src/routes/applications.js');

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn(), role: 'employer', userId: '22222222-2222-2222-2222-222222222222' }));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: mocks.userId, email: 'e@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
}));
process.env.RETENTION_DISABLE = '1';
const { default: applicationsRoutes } = await import('./applications.js');

const CO = '22222222-2222-2222-2222-222222222222';
const OTHER = '99999999-9999-4999-8999-999999999999';
const JOBS = [{ id: 'j1', title: 'Dev', status: 'published' }];
const STATS = { total_candidates: 42, new_this_week: 5 };
const RECENT = [{ id: 'a1', applied_at: '2026-10-01T00:00:00Z', seeker_full_name: 'Jane', job_title: 'Dev' }];

let base, server;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api', applicationsRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => { mocks.role = 'employer'; mocks.poolQuery.mockReset(); });

const dash = (qs = '') => fetch(`${base}/applications/employers/me/dashboard${qs}`);
// Answer the three queries by their distinct projections.
const seed = () => mocks.poolQuery.mockImplementation((sql) => {
  if (/select id, title, status from job_vacancies/.test(sql)) return { rows: JOBS };
  if (/total_candidates/.test(sql)) return { rows: [STATS] };
  return { rows: RECENT }; // recent applicants (seeker_full_name … limit 5)
});

describe('GET /applications/employers/me/dashboard', () => {
  it('returns the jobs, stats, and recent shapes', async () => {
    seed();
    const r = await dash();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.jobs).toEqual(JOBS);
    expect(body.stats).toEqual(STATS);
    expect(body.recent).toEqual(RECENT);
  });

  it('scopes ALL THREE queries to the caller id from the token', async () => {
    seed();
    await dash();
    expect(mocks.poolQuery).toHaveBeenCalledTimes(3);
    for (const [, params] of mocks.poolQuery.mock.calls) {
      expect(params).toEqual([CO]);
    }
  });

  // IDOR guard: scoping is req.user.id only — a client-supplied company id is
  // ignored. If the route ever read req.query/params here, this binding would
  // become the injected id and the assertion below would fail.
  it('never honours a client-supplied id — scoping is req.user.id only', async () => {
    seed();
    const r = await dash(`?company_id=${OTHER}`);
    expect(r.status).toBe(200);
    for (const [, params] of mocks.poolQuery.mock.calls) {
      expect(params).toEqual([CO]);
    }
  });

  it('403 for a non-employer, with no query run', async () => {
    mocks.role = 'job-seeker';
    const r = await dash();
    expect(r.status).toBe(403);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });
});

// The payload/window bounds exist only in the SQL (no observable behaviour at
// this layer): 5 recents and a 7-day "new this week" window computed in SQL.
// These are read from the route, everything above is executed.
describe('employer dashboard SQL bounds', () => {
  const start = src.indexOf("router.get('/applications/employers/me/dashboard'");
  const route = src.slice(start, src.indexOf("router.post('/applications/:id/status'", start));

  it('bounds recents to 5 and computes the 7-day window in SQL', () => {
    expect(start).toBeGreaterThan(-1);
    expect(route).toContain('limit 5');
    expect(route).toContain("interval '7 days'");
    expect(route).toContain('const companyId = req.user.id;');
  });
});
