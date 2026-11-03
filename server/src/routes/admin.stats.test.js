import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Contract test for GET /admin/stats after the aggregate rewrite: the 13
// standalone count(*) queries became 6 (one FILTER pass per table), and the
// dashboard's response keys must keep their exact old counts, names, and order.
const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  role: 'super-admin',
  userId: 'admin-1',
}));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: mocks.userId, email: 'a@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  // S7: supa is a lazy getter, not a module-scope client.
  supa: () => ({ auth: { admin: { inviteUserByEmail: vi.fn(), updateUserById: vi.fn() } } }),
}));
process.env.RETENTION_DISABLE = '1';
process.env.CORS_ORIGIN = 'https://app.test';
const { default: adminRoutes } = await import('./admin.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', adminRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((e, _req, res, _next) => res.status(500).json({ error: { code: 'INTERNAL', message: 'boom' } }));
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
const statsGet = () => fetch(`${base}/admin/stats`);

// The six queries in registration order: job_seekers, pending accreditations,
// unread notifications, employers, job_vacancies, job_applications.
const STATS_ROWS = [
  { c: 41 },                                             // seekers
  { c: 3 },                                              // pendingAccreditations
  { c: 7 },                                              // unreadNotifications
  { employers: 18, accredited: 9 },                      // employers / accreditedEmployers
  { jobs: 52, pending: 5, approved: 8, closed: 4, expired: 11 }, // jobs / pendingJobs / approvedJobs / closedJobs / expiredJobs
  { applications: 133, accepted: 21, placed: 6 },        // applications / acceptedApplicants / placedApplicants
];

// A tiny faithful reader for the two FILTER predicate shapes the stats route
// emits, so a behavioural test can compute the aggregate from seeded rows
// instead of sniffing the SQL text. An unknown predicate shape simply never
// matches, so a route that changes a predicate shape leaves the value out and
// the assertion fails loudly rather than the mock silently guessing.
const AGG_RE = /count\(\*\)(?:\s+filter\s+\(where\s+(status = '\w+'|deadline < current_date and status not in \('closed','archived'\))\))?\s*::int\s+(\w+)/g;
const filterCount = (rows, pred) => {
  if (!pred) return rows.length;
  const eq = /^status = '(\w+)'$/.exec(pred);
  if (eq) return rows.filter((r) => r.status === eq[1]).length;
  const today = Date.now();
  return rows.filter((r) => r.deadline && new Date(r.deadline).getTime() < today && r.status !== 'closed' && r.status !== 'archived').length;
};

describe('GET /admin/stats — response contract', () => {
  it('returns every key, in the old order, with the old counts', async () => {
    // Reset in-test, never in a beforeEach hook: vitest's spy cleanup can
    // re-invoke a rejecting mock after the test and misreport the error.
    mocks.poolQuery.mockReset();
    STATS_ROWS.forEach((row) => mocks.poolQuery.mockResolvedValueOnce({ rows: [row] }));
    const r = await statsGet();
    expect(r.status).toBe(200);
    const body = await r.json();
    // Key order is part of the byte-identical response contract.
    expect(Object.keys(body)).toEqual([
      'seekers', 'employers', 'companies', 'jobs', 'applications', 'pendingAccreditations',
      'unreadNotifications', 'pendingJobs', 'approvedJobs', 'closedJobs', 'expiredJobs',
      'acceptedApplicants', 'placedApplicants', 'accreditedEmployers',
    ]);
    expect(body).toEqual({
      seekers: 41,
      employers: 18,
      companies: 18, // companies mirrors employers, same as before
      jobs: 52,
      applications: 133,
      pendingAccreditations: 3,
      unreadNotifications: 7,
      pendingJobs: 5,
      approvedJobs: 8,
      closedJobs: 4,
      expiredJobs: 11,
      acceptedApplicants: 21,
      placedApplicants: 6,
      accreditedEmployers: 9,
    });
  });

  it('runs 6 queries, one per table, with the FILTER conditions verbatim', async () => {
    mocks.poolQuery.mockReset();
    STATS_ROWS.forEach((row) => mocks.poolQuery.mockResolvedValueOnce({ rows: [row] }));
    await statsGet();
    expect(mocks.poolQuery).toHaveBeenCalledTimes(6);
    const calls = mocks.poolQuery.mock.calls.map((c) => c[0]);
    // job_vacancies: exactly one query carries total + pending + approved +
    // closed + expired, each with the same predicate the old query used.
    expect(calls[4]).toContain('from job_vacancies');
    expect(calls[4]).toContain("count(*) filter (where status = 'pending')");
    expect(calls[4]).toContain("count(*) filter (where status = 'approved')");
    expect(calls[4]).toContain("count(*) filter (where status = 'closed')");
    expect(calls[4]).toContain("count(*) filter (where deadline < current_date and status not in ('closed','archived'))");
    // job_applications: total + Accepted + Placed in one pass.
    expect(calls[5]).toContain('from job_applications');
    expect(calls[5]).toContain("count(*) filter (where status = 'Accepted')");
    expect(calls[5]).toContain("count(*) filter (where status = 'Placed')");
    // employers: total + accredited in one pass.
    expect(calls[3]).toContain('from employers');
    expect(calls[3]).toContain("count(*) filter (where accreditation_status = 'approved')");
    // The scalar queries keep their exact old predicates.
    expect(calls[0]).toContain('from job_seekers');
    expect(calls[1]).toContain("from employer_accreditations where status = 'pending'");
  });

  it('job_vacancies FILTER aggregate is computed per predicate from seeded rows', async () => {
    // The aggregate VALUES are exercised, not the SQL text: each FILTER output
    // equals the count its OWN predicate selects over these seeded rows. Swap,
    // invert, or drop a predicate in the route and the wrong count lands under
    // the wrong key here (or the key drops out entirely) — this fails.
    mocks.poolQuery.mockReset();
    const jobs = [
      { status: 'published' },
      { status: 'pending' }, { status: 'pending' },
      { status: 'approved' }, { status: 'approved' }, { status: 'approved' },
      { status: 'closed' },
      { status: 'published', deadline: '2020-01-01' }, // past, still open → expired
      { status: 'published', deadline: '2021-06-01' }, // past, still open → expired
      { status: 'published', deadline: '2099-01-01' }, // future → live
      { status: 'archived', deadline: '2019-01-01' },  // archived → never expired
    ];
    mocks.poolQuery.mockImplementation((sql) => (/from job_vacancies/.test(sql)
      ? { rows: [Object.fromEntries([...String(sql).matchAll(AGG_RE)].map((m) => [m[2], filterCount(jobs, m[1])]))] }
      : { rows: [{ c: 0 }] }));
    const r = await statsGet();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.jobs).toBe(11);
    expect(body.pendingJobs).toBe(2);
    expect(body.approvedJobs).toBe(3);
    expect(body.closedJobs).toBe(1);
    expect(body.expiredJobs).toBe(2);
  });

  it('scopes unread notifications to the caller id', async () => {
    mocks.poolQuery.mockReset();
    STATS_ROWS.forEach((row) => mocks.poolQuery.mockResolvedValueOnce({ rows: [row] }));
    await statsGet();
    const call = mocks.poolQuery.mock.calls[2];
    expect(call[0]).toMatch(/is_read = false and user_id = \$1/);
    expect(call[1]).toEqual(['admin-1']);
  });

  it('500 INTERNAL when a stats query fails', async () => {
    mocks.poolQuery.mockReset();
    mocks.poolQuery.mockRejectedValue(new Error('db down'));
    const r = await statsGet();
    expect(r.status).toBe(500);
    expect((await r.json()).error.code).toBe('INTERNAL');
  });

  it('403 FORBIDDEN for a non-admin with no query run', async () => {
    mocks.poolQuery.mockReset();
    mocks.role = 'employer';
    const r = await statsGet();
    expect(r.status).toBe(403);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });
});
