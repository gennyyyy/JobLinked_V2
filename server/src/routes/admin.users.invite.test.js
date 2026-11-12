import { readFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const adminSrc = srv('src/routes/admin-users.js');
const inviteStart = adminSrc.indexOf("router.post('/admin/users/invite'");
const invite = adminSrc.slice(inviteStart, adminSrc.indexOf('router.', inviteStart + 1));

describe('invite route shape', () => {
  it('validates role and requires company_name for employers', () => {
    expect(inviteStart).toBeGreaterThan(-1);
    expect(invite).toContain("['job-seeker', 'employer', 'super-admin']");
    expect(invite).toMatch(/company_name/);
  });
  it('invites with metadata and the /accept-invite redirect', () => {
    expect(invite).toContain('supa().auth.admin.inviteUserByEmail');
    expect(invite).toContain('/accept-invite');
    expect(invite).toContain("audit(req.user.id, 'user.invite'");
  });
  it('writes role and custom_role_id to service-role app_metadata (G-01)', () => {
    expect(invite).toMatch(/app_metadata:\s*\{\s*role,\s*custom_role_id:\s*customRoleId\s*\}/);
  });
});

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn(), invite: vi.fn(), updateUser: vi.fn(), role: 'super-admin' }));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: 'admin-1', email: 'a@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  // S7: supa is a lazy getter, not a module-scope client.
  supa: () => ({ auth: { admin: { inviteUserByEmail: mocks.invite, updateUserById: mocks.updateUser } } }),
}));
process.env.RETENTION_DISABLE = '1';
process.env.CORS_ORIGIN = 'https://app.test';
const { default: adminRoutes } = await import('./admin-users.js');

let base, server;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api', adminRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  mocks.role = 'super-admin';
  mocks.poolQuery.mockReset();
  mocks.invite.mockReset();
  mocks.updateUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

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
    // G-01: the tag is service-role state, written in the same call as role.
    // null = the inviter explicitly granted a full admin (no custom role).
    expect(mocks.updateUser).toHaveBeenCalledWith('u1', {
      app_metadata: { role: 'job-seeker', custom_role_id: null },
    });
  });
  it('writes the custom-role tag into app_metadata in the same call (G-01)', async () => {
    mocks.poolQuery.mockImplementation(async (sql) => (/category = 'custom_role'/.test(sql)
      ? { rows: [{ id: 12, base_role: 'job-seeker' }] }
      : { rows: [] }));
    mocks.invite.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const r = await post({ email: 'tagged@x.com', custom_role_id: 12, first_name: 'Ana', last_name: 'Cruz' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ invited: true, email: 'tagged@x.com', role: 'job-seeker' });
    expect(mocks.updateUser).toHaveBeenCalledWith('u1', {
      app_metadata: { role: 'job-seeker', custom_role_id: 12 },
    });
    // user_metadata still mirrors it for the accept-invite form; the authority
    // provision reads is app_metadata.
    expect(mocks.invite.mock.calls[0][1].data).toMatchObject({ custom_role_id: 12 });
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
  it('400 when the request omits the email', async () => {
    const r = await post({ role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('400 when the request omits first_name and last_name', async () => {
    const r = await post({ email: 'x@x.com', role: 'job-seeker' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('400 when role disagrees with the custom role base role', async () => {
    // reference_data lookup resolves the custom role to base_role 'employer',
    // while the request claims 'job-seeker' → reject, never invite.
    mocks.poolQuery.mockResolvedValue({ rows: [{ id: 12, base_role: 'employer' }] });
    const r = await post({ email: 'c@x.com', role: 'job-seeker', custom_role_id: 12, first_name: 'A', last_name: 'B', company_name: 'Acme' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it('403 when the caller is not a super-admin', async () => {
    mocks.role = 'employer';
    const r = await post({ email: 'e@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(403);
  });
});
