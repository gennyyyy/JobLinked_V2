import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// ADR-042: a super-admin tagged with a custom role is limited to that role's
// permission bundle. These tests mount the real routers and swap the principal,
// so they also prove the wiring (which chain each route uses).

const mocks = vi.hoisted(() => ({
  user: { id: 'admin-1', email: 'a@x.com', role: 'super-admin' },
  query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
}));

vi.mock('../db.js', () => ({
  pool: { query: mocks.query },
  query: mocks.query,
  clientQuery: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = mocks.user; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  supa: { auth: { admin: { inviteUserByEmail: vi.fn(), deleteUser: vi.fn() } } },
}));

process.env.RETENTION_DISABLE = '1';
const { default: adminRoutes } = await import('../routes/admin.js');
const { default: adminJobsRoutes } = await import('../routes/admin-jobs.js');
const { default: adminUsersRoutes } = await import('../routes/admin-users.js');
const { default: adminReferenceRoutes } = await import('../routes/admin-reference.js');
const { default: reportsRoutes } = await import('../routes/reports.js');

let server;
let base;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', adminRoutes);
  app.use('/api', adminJobsRoutes);
  app.use('/api', adminUsersRoutes);
  app.use('/api', adminReferenceRoutes);
  app.use('/api', reportsRoutes);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  // One dummy row keeps the paginated handlers (`rows[0].c`) on their success
  // path; these tests assert the permission gate, never the payload.
  mocks.query.mockResolvedValue({ rows: [{}], rowCount: 1 });
  mocks.user = { id: 'admin-1', email: 'a@x.com', role: 'super-admin' };
});

const call = ({ method = 'GET', path, body }) => fetch(`${base}${path}`, {
  method,
  ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
});
const get = (path) => call({ path });

// ADR-042's route → key mapping, one representative route per catalogue key.
// The old table pointed `dashboard.view` at /admin/audit-logs, a `logs.view`
// route, so its allow assertion was vacuous (G-04). `roles.manage` has no
// read-only route of its own (GET /admin/roles also accepts `users.manage`),
// so it pins a mutation.
const ROUTES = [
  { key: 'dashboard.view', path: '/admin/stats' },
  { key: 'accreditation.manage', path: '/admin/accreditations' },
  { key: 'jobs.manage', path: '/admin/jobs' },
  { key: 'users.manage', path: '/admin/users' },
  { key: 'roles.manage', method: 'DELETE', path: '/admin/roles/1' },
  { key: 'reports.view', path: '/admin/reports/seekers/export' },
  { key: 'logs.view', path: '/admin/audit-logs' },
  { key: 'notifications.send', method: 'POST', path: '/admin/system-notifications', body: { title: 'Pin', message: 'Pin' } },
  { key: 'settings.manage', path: '/admin/reference/barangay' },
];

describe('a custom role is an allow-list (ADR-042)', () => {
  it('grants full access when no custom role is assigned', async () => {
    for (const route of ROUTES) {
      const res = await call(route);
      expect(res.status, `${route.path} should be allowed for a system admin`).not.toBe(403);
    }
  });

  // G-04: every catalogue key needs a route that admits it when granted and
  // refuses it when missing. Coverage is per key (one route each), not more
  // assertions on one route.
  it('admits each catalogue key on its own route', async () => {
    for (const route of ROUTES) {
      mocks.user = { id: 'admin-key', role: 'super-admin', customRoleId: 9, permissions: [route.key] };
      const res = await call(route);
      expect(res.status, `${route.key} granted → ${route.path}`).not.toBe(403);
    }
  });

  it('refuses each catalogue key on its own route when the bundle lacks it', async () => {
    const keys = ROUTES.map((route) => route.key);
    for (const route of ROUTES) {
      mocks.user = { id: 'admin-key', role: 'super-admin', customRoleId: 9, permissions: keys.filter((k) => k !== route.key) };
      const res = await call(route);
      expect(res.status, `${route.key} missing → ${route.path}`).toBe(403);
      expect((await res.json()).error.message).toContain(route.key);
    }
  });

  it('denies a key that is not in the bundle', async () => {
    mocks.user = { id: 'admin-2', role: 'super-admin', customRoleId: 9, permissions: ['reports.view'] };
    const res = await get('/admin/audit-logs');
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toMatch(/logs\.view/);
  });

  it('allows a key that is in the bundle', async () => {
    mocks.user = { id: 'admin-3', role: 'super-admin', customRoleId: 9, permissions: ['logs.view'] };
    const res = await get('/admin/audit-logs');
    expect(res.status).not.toBe(403);
  });

  it('denies every admin surface to an empty bundle', async () => {
    mocks.user = { id: 'admin-4', role: 'super-admin', customRoleId: 9, permissions: [] };
    for (const path of ['/admin/audit-logs', '/admin/roles', '/admin/users', '/admin/jobs']) {
      expect((await get(path)).status, path).toBe(403);
    }
  });

  it('keeps the non-super-admin rule in front of the bundle', async () => {
    mocks.user = { id: 'employer-1', role: 'employer' };
    expect((await get('/admin/users')).status).toBe(403);
  });

  it('lets a users-only admin read the role list, but not edit roles', async () => {
    mocks.user = { id: 'admin-5', role: 'super-admin', customRoleId: 9, permissions: ['users.manage'] };
    expect((await get('/admin/roles')).status).not.toBe(403);
    const res = await fetch(`${base}/admin/roles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Nope' }),
    });
    expect(res.status).toBe(403);
  });

  it('keeps jobs access separate from users access', async () => {
    mocks.user = { id: 'admin-6', role: 'super-admin', customRoleId: 9, permissions: ['jobs.manage'] };
    expect((await get('/admin/jobs')).status).not.toBe(403);
    expect((await get('/admin/users')).status).toBe(403);
  });
});
