import { describe, it, expect, vi, beforeEach } from 'vitest';

// auth.js builds a Supabase client at import time; stub env so the import can't
// throw, and stub the client so getUser is deterministic (no network).
const mocks = vi.hoisted(() => ({ poolQuery: vi.fn(), getUser: vi.fn() }));
vi.mock('./db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }));

process.env.SUPABASE_URL ||= 'http://127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const { auth, optionalAuth } = await import('./auth.js');

const user = { id: 'u1', email: 'u@x.com', app_metadata: { role: 'job-seeker' } };

// Resolves { ok: true, req } when next() runs, { status, body } when the
// middleware answers with err(res, ...) itself.
const run = (mw) => new Promise((resolve) => {
  const req = { headers: { authorization: 'Bearer tok' } };
  const res = { status: (s) => ({ json: (b) => resolve({ status: s, body: b }) }) };
  mw(req, res, () => resolve({ ok: true, req }));
});
const found = (status) => {
  mocks.poolQuery.mockResolvedValue({ rows: [{ role: 'super-admin', profile: { status } }] });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
};

describe('auth status gate', () => {
  beforeEach(() => { mocks.poolQuery.mockReset(); mocks.getUser.mockReset(); });

  it('blocks an inactive account (demoted admin keeps no access)', async () => {
    found('inactive');
    const out = await run(auth);
    expect(out.status).toBe(403);
    expect(out.body.error.code).toBe('FORBIDDEN');
  });

  it('blocks a suspended account with recognisable wording', async () => {
    found('suspended');
    const out = await run(auth);
    expect(out.status).toBe(403);
    expect(out.body.error.message).toMatch(/suspend/i);
  });

  it('F1: 403 suspended — not "not provisioned" — when every row is inactive', async () => {
    // A role move deactivates the old row instead of deleting it, so an id can
    // have rows in two tables. When ALL of them are inactive the status-aware
    // ordering still returns a row (the inactive one) — auth must answer the
    // suspended 403, never the "Account not provisioned" one.
    found('inactive');
    const out = await run(auth);
    expect(out.status).toBe(403);
    expect(out.body.error.code).toBe('FORBIDDEN');
    expect(out.body.error.message).toMatch(/suspend/i);
    expect(out.body.error.message).not.toMatch(/not provisioned/i);
  });

  it('allows an active account and attaches app_metadata to req.user', async () => {
    found('active');
    const out = await run(auth);
    expect(out.ok).toBe(true);
    expect(out.req.user).toEqual({ id: 'u1', email: 'u@x.com', role: 'super-admin', app_metadata: { role: 'job-seeker' } });
  });
});

describe('optionalAuth status gate', () => {
  beforeEach(() => { mocks.poolQuery.mockReset(); mocks.getUser.mockReset(); });

  it('does not attach req.user for an inactive account', async () => {
    found('inactive');
    const out = await run(optionalAuth);
    expect(out.ok).toBe(true);
    expect(out.req.user).toBeUndefined();
  });

  it('attaches req.user (with app_metadata) for an active account', async () => {
    found('active');
    const out = await run(optionalAuth);
    expect(out.req.user).toEqual({ id: 'u1', email: 'u@x.com', role: 'super-admin', app_metadata: { role: 'job-seeker' } });
  });

  it('stays anonymous with no token', async () => {
    const out = await new Promise((resolve) => {
      const req = { headers: {} };
      const res = { status: (s) => ({ json: (b) => resolve({ status: s, body: b }) }) };
      optionalAuth(req, res, () => resolve({ ok: true, req }));
    });
    expect(out.ok).toBe(true);
    expect(out.req.user).toBeUndefined();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
