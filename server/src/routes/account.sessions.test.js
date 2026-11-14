// Task 3.1: POST /account/sessions/revoke-all — self-service revoke of all sessions.
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { err } from '../util.js';

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  tokenAuth: (req, _res, next) => { req.user = { id: 'user-1', email: 'u@x.com' }; next(); },
}));
process.env.SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
const { default: accountRoutes } = await import('./account.js');

const realFetch = globalThis.fetch;
const upstream = vi.fn();
vi.stubGlobal('fetch', (url, init) => (String(url).startsWith(base) ? realFetch(url, init) : upstream(url, init)));

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
  mocks.poolQuery.mockReset().mockResolvedValue({ rows: [] });
});

const post = () => fetch(`${base}/account/sessions/revoke-all`, {
  method: 'POST', headers: { Authorization: 'Bearer t' },
});
const auditCalls = () => mocks.poolQuery.mock.calls.filter((c) => /insert into audit_logs/.test(String(c[0])));

describe('POST /account/sessions/revoke-all', () => {
  it('calls the GoTrue admin logout endpoint with the service key, audits once, returns { revoked: true }', async () => {
    const r = await post();
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body).toEqual({ revoked: true });
    expect(JSON.stringify(body)).not.toContain('service-key');

    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe(`https://supa.test/auth/v1/admin/users/user-1/logout`);
    expect(init.method).toBe('POST');
    expect(init.headers.apikey).toBe('service-key');
    expect(init.headers.Authorization).toBe('Bearer service-key');

    expect(auditCalls()).toHaveLength(1);
    const [sql, params] = auditCalls()[0];
    expect(String(sql)).toContain('audit_logs');
    expect(params[1]).toBe('account.sessions.revoke');
  });

  it('502s on upstream non-2xx and audits nothing', async () => {
    upstream.mockResolvedValue({ ok: false, status: 500, body: { cancel: vi.fn() } });
    const r = await post();
    expect(r.status).toBe(502);
    expect((await r.json()).error.code).toBe('UPSTREAM_ERROR');
    expect(auditCalls()).toHaveLength(0);
  });

  it('502s on network/timeout error and audits nothing', async () => {
    upstream.mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await post();
    expect(r.status).toBe(502);
    expect((await r.json()).error.code).toBe('UPSTREAM_ERROR');
    expect(auditCalls()).toHaveLength(0);
  });
});