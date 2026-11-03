import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// Runtime: POST /auth/provision runs with tokenAuth mocked. A 'super-admin'
// body role must never create a super_admins row on its own — only
// app_metadata (service-role only, written by the invite flow) may grant it.
const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  resolveRole: vi.fn(async () => null),
  appMetadata: undefined,
}));
vi.mock('../db.js', () => ({
  pool: {
    query: mocks.poolQuery,
    connect: async () => ({ query: mocks.clientQuery, release: () => {} }),
  },
}));
vi.mock('../auth.js', () => ({
  tokenAuth: (req, _res, next) => {
    req.user = { id: 'user-1', email: 'u@x.com', app_metadata: mocks.appMetadata };
    next();
  },
  resolveRole: mocks.resolveRole,
}));
const { default: authRoutes } = await import('./auth.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', authRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  mocks.appMetadata = undefined;
  mocks.poolQuery.mockReset().mockResolvedValue({ rows: [] });
  mocks.resolveRole.mockReset().mockResolvedValue(null);
  mocks.clientQuery.mockReset().mockImplementation(async (sql) => (
    /^(begin|commit|rollback)/i.test(sql.trim()) || /^insert into education/i.test(sql.trim())
      ? { rows: [] }
      : { rows: [{ id: 'user-1', email: 'u@x.com' }] }
  ));
});

const post = (body) => fetch(`${base}/auth/provision`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('provision super-admin guard', () => {
  it('403 FORBIDDEN for a body role of super-admin with no app_metadata', async () => {
    const r = await post({ role: 'super-admin', first_name: 'Ada', last_name: 'Lovelace' });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe('FORBIDDEN');
    // Fail closed before any lookup or write — no row can be created.
    expect(mocks.resolveRole).not.toHaveBeenCalled();
    expect(mocks.clientQuery).not.toHaveBeenCalled();
  });

  it('403 when app_metadata exists but does not grant super-admin', async () => {
    mocks.appMetadata = { role: 'job-seeker' };
    const r = await post({ role: 'super-admin', first_name: 'Ada', last_name: 'Lovelace' });
    expect(r.status).toBe(403);
    expect(mocks.clientQuery).not.toHaveBeenCalled();
  });

  it('403 when app_metadata is null (still fail closed)', async () => {
    mocks.appMetadata = null;
    const r = await post({ role: 'super-admin' });
    expect(r.status).toBe(403);
    expect(mocks.clientQuery).not.toHaveBeenCalled();
  });

  it('201 job-seeker provisioning keeps working with no app_metadata', async () => {
    const r = await post({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(r.status).toBe(201);
    expect((await r.json()).role).toBe('job-seeker');
    const insert = mocks.clientQuery.mock.calls.map((c) => c[0]).find((s) => /insert into job_seekers/i.test(s));
    expect(insert).toBeTruthy();
  });

  it('201 employer provisioning keeps working with no app_metadata', async () => {
    const r = await post({ role: 'employer', first_name: 'Ben', last_name: 'Yu', company_name: 'Acme' });
    expect(r.status).toBe(201);
    expect((await r.json()).role).toBe('employer');
    const sqls = mocks.clientQuery.mock.calls.map((c) => c[0]);
    expect(sqls.some((s) => /insert into employers/i.test(s))).toBe(true);
    expect(sqls.some((s) => /insert into employer_accreditations/i.test(s))).toBe(true);
  });

  it('201 super-admin when app_metadata.role is super-admin (invite path)', async () => {
    mocks.appMetadata = { role: 'super-admin' };
    const r = await post({ role: 'super-admin', first_name: 'Cid', last_name: 'Reyes' });
    expect(r.status).toBe(201);
    expect((await r.json()).role).toBe('super-admin');
    const insert = mocks.clientQuery.mock.calls.map((c) => c[0]).find((s) => /insert into super_admins/i.test(s));
    expect(insert).toBeTruthy();
  });

  it('400 for an unknown role (unchanged validation)', async () => {
    const r = await post({ role: 'root' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
  });

  it('200 idempotent existing-row path is unchanged', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'employer', profile: { id: 'user-1', status: 'active' } });
    const r = await post({ role: 'employer', first_name: 'Ben', last_name: 'Yu', company_name: 'Acme' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: 'user-1', status: 'active', role: 'employer' });
    expect(mocks.clientQuery).not.toHaveBeenCalled();
  });

  it('403 on the existing-row path for an inactive account', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'employer', profile: { id: 'user-1', status: 'inactive' } });
    const r = await post({ role: 'employer', first_name: 'Ben', last_name: 'Yu', company_name: 'Acme' });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe('FORBIDDEN');
  });

  it('403 on the existing-row path for a suspended account', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'job-seeker', profile: { id: 'user-1', status: 'suspended' } });
    const r = await post({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(r.status).toBe(403);
  });
});

// tokenAuth skips the status gate (fresh sessions have no row), so both the
// provision existing-row branch and /auth/me must gate on status themselves.
// Any non-active status blocks — not only 'suspended'.
describe('auth/me status gate', () => {
  const me = () => fetch(`${base}/auth/me`);

  it('200 for an active profile', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'job-seeker', profile: { id: 'user-1', status: 'active' } });
    const r = await me();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: 'user-1', status: 'active', role: 'job-seeker' });
  });

  it('403 for an inactive profile (no stale role leak)', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'super-admin', profile: { id: 'user-1', status: 'inactive' } });
    const r = await me();
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe('FORBIDDEN');
  });

  it('403 for a suspended profile', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'job-seeker', profile: { id: 'user-1', status: 'suspended' } });
    const r = await me();
    expect(r.status).toBe(403);
  });

  it('404 when no row exists yet (needs provision)', async () => {
    mocks.resolveRole.mockResolvedValue(null);
    const r = await me();
    expect(r.status).toBe(404);
  });
});
