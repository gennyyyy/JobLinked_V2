import { readFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const adminSrc = srv('src/routes/admin.js');
const inviteStart = adminSrc.indexOf("router.post('/admin/users/invite'");
const invite = adminSrc.slice(inviteStart, adminSrc.indexOf('router.', inviteStart + 1));

describe('invite route shape', () => {
  it('validates role and requires company_name for employers', () => {
    expect(inviteStart).toBeGreaterThan(-1);
    expect(invite).toContain("['job-seeker', 'employer', 'super-admin']");
    expect(invite).toMatch(/company_name/);
  });
  it('invites with metadata and the /accept-invite redirect', () => {
    expect(invite).toContain('supa.auth.admin.inviteUserByEmail');
    expect(invite).toContain('/accept-invite');
    expect(invite).toContain("audit(req.user.id, 'user.invite'");
  });
});

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn(), invite: vi.fn(), role: 'super-admin' }));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: 'admin-1', email: 'a@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  supa: { auth: { admin: { inviteUserByEmail: mocks.invite } } },
}));
process.env.RETENTION_DISABLE = '1';
process.env.CORS_ORIGIN = 'https://app.test';
const { default: adminRoutes } = await import('./admin.js');

let base, server;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api', adminRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => { mocks.role = 'super-admin'; mocks.poolQuery.mockReset(); mocks.invite.mockReset(); });

const post = (body) => fetch(`${base}/admin/users/invite`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('invite runtime', () => {
  it('201 and invites with metadata + redirectTo on the happy path', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });          // dup check empty
    mocks.invite.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const r = await post({ email: 'new@x.com', role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ invited: true, email: 'new@x.com', role: 'job-seeker' });
    expect(mocks.invite).toHaveBeenCalledWith('new@x.com', expect.objectContaining({
      redirectTo: 'https://app.test/accept-invite',
      data: expect.objectContaining({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' }),
    }));
  });
  it('409 when the email already exists in a role table (case-insensitive)', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const r = await post({ email: 'Juan@X.com', role: 'employer', first_name: 'J', last_name: 'D', company_name: 'Acme' });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe('CONFLICT');
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('409 when Supabase reports the auth user already exists', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    mocks.invite.mockResolvedValue({ data: null, error: { message: 'User already registered' } });
    const r = await post({ email: 'dup@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(409);
  });
  it('400 when an employer invite omits company_name', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    const r = await post({ email: 'e@x.com', role: 'employer', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(400);
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('403 when the caller is not a super-admin', async () => {
    mocks.role = 'employer';
    const r = await post({ email: 'e@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(403);
  });
});
