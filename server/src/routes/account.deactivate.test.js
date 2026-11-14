// Task 7.1: POST /account/deactivate — self-service deactivation.
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { err } from '../util.js';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  resolveRole: vi.fn(async () => ({ role: 'employer', profile: { id: 'user-1', status: 'active' } })),
}));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  tokenAuth: (req, _res, next) => { req.user = { id: 'user-1', email: 'u@x.com' }; next(); },
  resolveRole: mocks.resolveRole,
}));
process.env.SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
const { default: accountRoutes } = await import('./account.js');

const realFetch = globalThis.fetch;
const upstream = vi.fn();
vi.stubGlobal('fetch', (url, init) => (String(url).startsWith('http://127.0.0.1') ? realFetch(url, init) : upstream(url, init)));

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', accountRoutes);
  app.use('/api', (_req, res) => err(res, 404, 'NOT_FOUND', 'Route not found'));
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => {
  vi.unstubAllGlobals();
  return new Promise((r) => server.close(r));
});
beforeEach(() => {
  upstream.mockReset().mockResolvedValue({ ok: true, status: 200, body: { cancel: vi.fn() } });
  mocks.poolQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mocks.resolveRole.mockReset().mockResolvedValue({ role: 'employer', profile: { id: 'user-1', status: 'active' } });
});

const post = (body) => fetch(`${base}/account/deactivate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', Authorization: 'Bearer t' },
  body: JSON.stringify(body ?? {}),
});
const auditCalls = () => mocks.poolQuery.mock.calls.filter((c) => /insert into audit_logs/.test(String(c[0])));
const updateCalls = () => mocks.poolQuery.mock.calls.filter((c) => /update .* set status = 'inactive'/.test(String(c[0])));

describe('POST /account/deactivate', () => {
  it('400 CONFIRM_REQUIRED when confirm is missing', async () => {
    const r = await post({});
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('CONFIRM_REQUIRED');
    expect(mocks.resolveRole).not.toHaveBeenCalled();
  });

  it('400 CONFIRM_REQUIRED when confirm is wrong', async () => {
    const r = await post({ confirm: 'yes' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('CONFIRM_REQUIRED');
  });

  it('404 NOT_FOUND when resolveRole returns null', async () => {
    mocks.resolveRole.mockResolvedValue(null);
    const r = await post({ confirm: 'DEACTIVATE' });
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe('NOT_FOUND');
  });

  it('409 LAST_ADMIN for the last full admin', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'super-admin', profile: { id: 'user-1', status: 'active', custom_role_id: null } });
    mocks.poolQuery.mockResolvedValue({ rows: [{ c: 0 }], rowCount: 1 });
    const r = await post({ confirm: 'DEACTIVATE' });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe('LAST_ADMIN');
  });

  it('updates status, writes audit, returns { deactivated: true }', async () => {
    const r = await post({ confirm: 'DEACTIVATE' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ deactivated: true });

    expect(updateCalls()).toHaveLength(1);
    expect(String(updateCalls()[0][0])).toContain('employers');
    expect(updateCalls()[0][1]).toEqual(['user-1']);

    expect(auditCalls()).toHaveLength(1);
    const [sql, params] = auditCalls()[0];
    expect(String(sql)).toContain('audit_logs');
    expect(params[1]).toBe('account.deactivate');
    expect(params[2]).toBe('employers');
    expect(params[3]).toBe('user-1');

    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('does not fail when GoTrue logout fails', async () => {
    upstream.mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await post({ confirm: 'DEACTIVATE' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ deactivated: true });
  });
});