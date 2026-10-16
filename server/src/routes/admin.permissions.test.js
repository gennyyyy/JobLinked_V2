import { readFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn(), role: 'super-admin' }));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: 'admin-1', email: 'a@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  supa: { auth: { admin: { inviteUserByEmail: vi.fn() } } },
}));
process.env.RETENTION_DISABLE = '1';
const { default: adminRoutes } = await import('./admin.js');

let base, server;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api', adminRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));

describe('GET /admin/permissions', () => {
  it('serves the canonical labeled permission catalog', async () => {
    const r = await fetch(`${base}/admin/permissions`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual([
      { key: 'dashboard.view', label: 'View Dashboard' },
      { key: 'accreditation.manage', label: 'Manage Accreditations' },
      { key: 'jobs.manage', label: 'Manage Job Posts' },
      { key: 'users.manage', label: 'Manage Users' },
      { key: 'roles.manage', label: 'Manage Roles' },
      { key: 'reports.view', label: 'View Reports' },
      { key: 'logs.view', label: 'View Audit Logs' },
      { key: 'notifications.send', label: 'Send System Notifications' },
      { key: 'settings.manage', label: 'Manage Settings' },
    ]);
  });
  it('403 for non-super-admins', async () => {
    mocks.role = 'employer';
    const r = await fetch(`${base}/admin/permissions`);
    expect(r.status).toBe(403);
  });
});

// The whole point of the change: the UI must not keep its own copy.
const web = (p) => readFileSync(path.join(process.cwd(), 'src', p), 'utf8');

describe('client consumes the server catalog', () => {
  it('the Roles page no longer declares a local permission constant', () => {
    const roles = web('features/super-admin/RoleManagement.jsx');
    expect(roles).not.toMatch(/ROLE_PERMISSIONS/);
    expect(roles).toContain('listPermissions');
    expect(roles).toContain('permissionCatalog');
  });
  it('the admin service has no second copy of the list', () => {
    expect(web('shared/services/admin.js')).not.toMatch(/ROLE_PERMISSIONS/);
  });
});
