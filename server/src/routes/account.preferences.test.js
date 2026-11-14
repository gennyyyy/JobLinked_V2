import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn(), role: 'job-seeker' }));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  tokenAuth: (req, _res, next) => { req.user = { id: 'user-1', role: mocks.role }; next(); },
}));
const { default: accountRoutes } = await import('./account.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', accountRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  mocks.poolQuery.mockReset().mockResolvedValue({ rows: [] });
});

const get = () => fetch(`${base}/account/preferences`, { headers: { Authorization: 'Bearer t' } });
const patch = (body) => fetch(`${base}/account/preferences`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', Authorization: 'Bearer t' },
  body: JSON.stringify(body),
});
const auditCalls = () => mocks.poolQuery.mock.calls.filter((c) => /insert into audit_logs/.test(String(c[0])));

describe('GET /account/preferences', () => {
  it('returns defaults true when no row', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [] });
    const r = await get();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ application_updates: true, community_announcements: true });
    expect(auditCalls()).toHaveLength(0);
  });

  it('returns the stored row when present', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [{ application_updates: false, community_announcements: true }] });
    const r = await get();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ application_updates: false, community_announcements: true });
    expect(auditCalls()).toHaveLength(0);
  });
});

describe('PATCH /account/preferences', () => {
  it('partial update returns the merged row', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [{ application_updates: false, community_announcements: true }] });
    const r = await patch({ application_updates: false });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ application_updates: false, community_announcements: true });
  });

  it('rejects a non-boolean value with 400 INVALID_PREFERENCES', async () => {
    const r = await patch({ application_updates: 'true' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('INVALID_PREFERENCES');
    expect(auditCalls()).toHaveLength(0);
  });

  it('rejects an empty body with 400 INVALID_PREFERENCES', async () => {
    const r = await patch({});
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('INVALID_PREFERENCES');
    expect(auditCalls()).toHaveLength(0);
  });

  it('writes the audit log exactly once', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [{ application_updates: true, community_announcements: false }] });
    const r = await patch({ community_announcements: false });
    expect(r.status).toBe(200);
    expect(auditCalls()).toHaveLength(1);
    const [sql, params] = auditCalls()[0];
    expect(String(sql)).toContain('audit_logs');
    expect(params[1]).toBe('account.preferences.update');
    expect(params[2]).toBe('user_preferences');
  });
});
