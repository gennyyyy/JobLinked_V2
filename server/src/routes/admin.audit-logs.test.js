import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// The audit-log read is additive: target_name names the audited user, and the
// actor lookup must not multiply rows when a moved user has an inactive row in
// an old role table. Both are asserted on the SQL the route actually sends.

const mocks = vi.hoisted(() => ({ query: vi.fn(async () => ({ rows: [], rowCount: 0 })) }));

vi.mock('../db.js', () => ({ pool: { query: mocks.query } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => {
    req.user = { id: 'admin-1', email: 'a@x.com', role: 'super-admin' };
    next();
  },
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  supa: () => ({ auth: {} }),
}));
vi.mock('../ba.js', () => ({ auth: { api: {} } }));

process.env.RETENTION_DISABLE = '1';
const { default: adminRoutes } = await import('./admin.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', adminRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => mocks.query.mockReset());

const getLogs = () => fetch(`${base}/admin/audit-logs`);

describe('GET /admin/audit-logs', () => {
  it('passes target_name through to the response', async () => {
    mocks.query.mockResolvedValue({
      rows: [{ id: '1', action: 'user.role.change', actor_name: 'Admin One', target_name: 'Grace Hopper' }],
    });
    const res = await getLogs();
    expect(res.status).toBe(200);
    expect((await res.json())[0].target_name).toBe('Grace Hopper');
  });

  it('resolves target_name from entity + entity_id in a CASE, without actor joins', async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    const res = await getLogs();
    expect(res.status).toBe(200);
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain('as target_name');
    expect(sql).toContain("when 'super_admins' then (select s.full_name from super_admins s where s.id::text = l.entity_id)");
    expect(sql).toContain("when 'employers' then (select e.full_name from employers e where e.id::text = l.entity_id)");
    expect(sql).toContain("when 'job_seekers' then (select j.full_name from job_seekers j where j.id::text = l.entity_id)");
    // A moved actor keeps an inactive row in an old table; a LEFT JOIN could
    // therefore duplicate rows. The actor lookup must stay a scalar subquery.
    expect(sql).not.toMatch(/left join/i);
  });

  it('prefers super_admins → employers → job_seekers for the actor', async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    await getLogs();
    const sql = String(mocks.query.mock.calls[0][0]);
    const superAdmin = sql.indexOf('from super_admins s where s.id = l.user_id');
    const employer = sql.indexOf('from employers e where e.id = l.user_id');
    const seeker = sql.indexOf('from job_seekers j where j.id = l.user_id');
    expect(superAdmin).toBeGreaterThan(-1);
    expect(employer).toBeGreaterThan(superAdmin);
    expect(seeker).toBeGreaterThan(employer);
  });
});
