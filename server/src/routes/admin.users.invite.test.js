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
  it('creates auth.user + admin_invites, then emails the BA reset link', () => {
    expect(invite).toContain('insert into auth."user"');
    expect(invite).toContain('insert into public.admin_invites');
    expect(invite).toContain('baAuth.api.requestPasswordReset');
    expect(invite).toContain('/reset-password');
    expect(invite).toContain("audit(req.user.id, 'user.invite'");
  });
  it('no longer touches Supabase or app_metadata (ADR-056)', () => {
    expect(invite).not.toContain('supa');
    expect(invite).not.toContain('app_metadata');
  });
});

const USER_ID = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(), txQuery: vi.fn(), connect: vi.fn(), reset: vi.fn(),
  supabase: vi.fn(), role: 'super-admin',
}));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery, connect: mocks.connect } }));
vi.mock('../ba.js', () => ({ auth: { api: { requestPasswordReset: mocks.reset } } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: 'admin-1', email: 'a@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
  // The route must never reach Supabase again; a call is a test failure.
  supa: mocks.supabase,
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
  mocks.poolQuery.mockReset().mockResolvedValue({ rows: [] });
  mocks.txQuery.mockReset().mockImplementation(async (sql) => (
    /insert into auth\."user"/.test(String(sql)) ? { rows: [{ id: USER_ID }] } : { rows: [] }));
  mocks.connect.mockReset().mockResolvedValue({ query: mocks.txQuery, release: vi.fn() });
  mocks.reset.mockReset().mockResolvedValue({ status: true });
  mocks.supabase.mockReset();
});

const post = (body) => fetch(`${base}/admin/users/invite`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const authInsert = () => mocks.txQuery.mock.calls.find(([sql]) => /insert into auth\."user"/.test(String(sql)));
const inviteInsert = () => mocks.txQuery.mock.calls.find(([sql]) => /insert into public\.admin_invites/.test(String(sql)));

describe('invite runtime', () => {
  it('201: one transaction writes auth.user then admin_invites with the full profile', async () => {
    const r = await post({ email: 'new@x.com', role: 'job-seeker', first_name: 'Ana', middle_name: 'B', last_name: 'Cruz', suffix: 'Jr', phone: '0917' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ invited: true, email: 'new@x.com', role: 'job-seeker' });

    const [userSql, userParams] = authInsert();
    expect(userSql).toContain('returning "id"');
    expect(userParams).toEqual(['Ana B Cruz Jr', 'new@x.com', null]);

    const [inviteSql, inviteParams] = inviteInsert();
    expect(inviteSql).toContain('public.admin_invites');
    expect(inviteParams.slice(0, 3)).toEqual([USER_ID, 'job-seeker', null]);
    expect(JSON.parse(inviteParams[3])).toEqual({
      first_name: 'Ana', middle_name: 'B', last_name: 'Cruz', suffix: 'Jr',
      phone: '0917', full_name: 'Ana B Cruz Jr', company_name: null,
    });

    // Same message as before, new link: BA's own reset page sets the password.
    expect(mocks.reset).toHaveBeenCalledWith({
      body: { email: 'new@x.com', redirectTo: 'https://app.test/reset-password' },
    });
    expect(mocks.supabase).not.toHaveBeenCalled();
    expect(mocks.poolQuery.mock.calls.some(([sql]) => /insert into audit_logs/.test(String(sql)))).toBe(true);
  });

  it('writes user.role = super-admin only for a super-admin invite', async () => {
    const r = await post({ email: 'boss@x.com', role: 'super-admin', first_name: 'Cid', last_name: 'Reyes' });
    expect(r.status).toBe(201);
    expect(authInsert()[1]).toEqual(['Cid Reyes', 'boss@x.com', 'super-admin']);
    expect(inviteInsert()[1].slice(0, 3)).toEqual([USER_ID, 'super-admin', null]);
  });

  it('writes the custom-role tag into the admin_invites row (G-01)', async () => {
    mocks.poolQuery.mockImplementation(async (sql) => (/category = 'custom_role'/.test(String(sql))
      ? { rows: [{ id: 12, base_role: 'job-seeker' }] }
      : { rows: [] }));
    const r = await post({ email: 'tagged@x.com', custom_role_id: 12, first_name: 'Ana', last_name: 'Cruz' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ invited: true, email: 'tagged@x.com', role: 'job-seeker' });
    expect(inviteInsert()[1].slice(0, 3)).toEqual([USER_ID, 'job-seeker', 12]);
  });

  it('409 when the email already exists — the dupe check covers auth.user and the role tables', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const r = await post({ email: 'Juan@X.com', role: 'employer', first_name: 'J', last_name: 'D', company_name: 'Acme' });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe('CONFLICT');
    const dupe = mocks.poolQuery.mock.calls[0][0];
    expect(dupe).toContain('from auth."user"');
    expect(dupe).toMatch(/union all select 1 from super_admins where lower\(email\)/);
    expect(dupe).toContain('limit 1');
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('409 when the auth.user email unique constraint fires (23505)', async () => {
    mocks.txQuery.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));
    const r = await post({ email: 'dup@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe('CONFLICT');
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it('429 on a rate-limit-shaped send failure, compensation included', async () => {
    mocks.reset.mockRejectedValue(Object.assign(new Error('Email rate limit exceeded'), { statusCode: 429 }));
    const r = await post({ email: 'rl@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(429);
    expect((await r.json()).error).toEqual({
      code: 'RATE_LIMITED', message: 'Invite email rate limit reached. Please try again later.',
    });
    const del = mocks.poolQuery.mock.calls.find(([sql]) => /delete from auth\."user" where "id" = \$1/.test(String(sql)));
    expect(del?.[1]).toEqual([USER_ID]);
  });

  it('502 on another send failure, deletes the half-created auth.user row, leaks nothing', async () => {
    mocks.reset.mockRejectedValue(Object.assign(new Error('smtp rejected rl@x.com'), { statusCode: 500 }));
    const r = await post({ email: 'fail@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    const body = await r.json();
    expect(r.status).toBe(502);
    expect(body.error.code).toBe('UPSTREAM_ERROR');
    expect(JSON.stringify(body)).not.toContain('smtp rejected');
    expect(JSON.stringify(body)).not.toContain('fail@x.com');
    const del = mocks.poolQuery.mock.calls.find(([sql]) => /delete from auth\."user" where "id" = \$1/.test(String(sql)));
    expect(del?.[1]).toEqual([USER_ID]);
    expect(mocks.poolQuery.mock.calls.some(([sql]) => /insert into audit_logs/.test(String(sql)))).toBe(false);
  });

  it('400 when an employer invite omits company_name', async () => {
    const r = await post({ email: 'e@x.com', role: 'employer', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(400);
    expect(mocks.reset).not.toHaveBeenCalled();
  });
  it('400 when the request omits the email', async () => {
    const r = await post({ role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    expect(mocks.reset).not.toHaveBeenCalled();
  });
  it('400 when the request omits first_name and last_name', async () => {
    const r = await post({ email: 'x@x.com', role: 'job-seeker' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    expect(mocks.reset).not.toHaveBeenCalled();
  });
  it('400 when role disagrees with the custom role base role', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [{ id: 12, base_role: 'employer' }] });
    const r = await post({ email: 'c@x.com', role: 'job-seeker', custom_role_id: 12, first_name: 'A', last_name: 'B', company_name: 'Acme' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    expect(mocks.reset).not.toHaveBeenCalled();
  });
  it('403 when the caller is not a super-admin', async () => {
    mocks.role = 'employer';
    const r = await post({ email: 'e@x.com', role: 'job-seeker', first_name: 'A', last_name: 'B' });
    expect(r.status).toBe(403);
  });
});
