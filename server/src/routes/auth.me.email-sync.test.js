import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  resolveRole: vi.fn(async () => ({ role: 'employer', profile: { id: 'user-1', status: 'active', email: 'old@x.com' } })),
  tokenEmail: 'new@x.com',
}));
vi.mock('../db.js', () => ({
  pool: {
    query: mocks.poolQuery,
    connect: async () => ({ query: mocks.poolQuery, release: () => {} }),
  },
}));
vi.mock('../auth.js', () => ({
  tokenAuth: (req, _res, next) => {
    req.user = { id: 'user-1', email: mocks.tokenEmail };
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
  mocks.poolQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mocks.resolveRole.mockReset().mockResolvedValue({ role: 'employer', profile: { id: 'user-1', status: 'active', email: 'old@x.com' } });
  mocks.tokenEmail = 'new@x.com';
});

const me = () => fetch(`${base}/auth/me`);

describe('auth/me email sync', () => {
  it('syncs differing token email once and audits once; response email is token email', async () => {
    const r = await me();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.email).toBe('new@x.com');
    const updates = mocks.poolQuery.mock.calls.filter(([sql]) => /update employers/i.test(sql));
    expect(updates).toHaveLength(1);
    expect(updates[0][1]).toEqual(['user-1', 'new@x.com']);
    const audits = mocks.poolQuery.mock.calls.filter(([sql]) => /insert into audit_logs/i.test(sql));
    expect(audits).toHaveLength(1);
  });

  it('matching emails perform no update and no audit', async () => {
    mocks.tokenEmail = 'old@x.com';
    const r = await me();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.email).toBe('old@x.com');
    const updates = mocks.poolQuery.mock.calls.filter(([sql]) => /update /i.test(sql));
    expect(updates).toHaveLength(0);
    const audits = mocks.poolQuery.mock.calls.filter(([sql]) => /insert into audit_logs/i.test(sql));
    expect(audits).toHaveLength(0);
  });

  it('token without an email skips entirely', async () => {
    mocks.tokenEmail = undefined;
    const r = await me();
    expect(r.status).toBe(200);
    const updates = mocks.poolQuery.mock.calls.filter(([sql]) => /update /i.test(sql));
    expect(updates).toHaveLength(0);
    const audits = mocks.poolQuery.mock.calls.filter(([sql]) => /insert into audit_logs/i.test(sql));
    expect(audits).toHaveLength(0);
  });

  it('resolveRole returning null -> 404', async () => {
    mocks.resolveRole.mockResolvedValue(null);
    const r = await me();
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe('NOT_FOUND');
  });
});