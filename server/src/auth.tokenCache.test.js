import { describe, it, expect, vi, beforeEach } from 'vitest';

// auth.js builds a Supabase client at import time; stub env so the import can't
// throw, and stub the client so getUser is deterministic (no network).
const mocks = vi.hoisted(() => ({ poolQuery: vi.fn(), getUser: vi.fn() }));
vi.mock('./db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }));

process.env.SUPABASE_URL ||= 'http://127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const { auth } = await import('./auth.js');
const { clearTokenCache } = await import('./tokenCache.js');

const user = { id: 'u1', email: 'u@x.com', app_metadata: { role: 'job-seeker' } };
const TOKEN = 'Bearer real.jwt.token';

// Resolves { ok: true, req } when next() runs, { status, body } when the
// middleware answers with err(res, ...) itself.
const run = (mw) => new Promise((resolve) => {
  const req = { headers: { authorization: TOKEN } };
  const res = { status: (s) => ({ json: (b) => resolve({ status: s, body: b }) }) };
  mw(req, res, () => resolve({ ok: true, req }));
});
const found = (status) => {
  mocks.poolQuery.mockResolvedValue({ rows: [{ role: 'job-seeker', profile: { status } }] });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
};

describe('F2 — token cache (Supabase getUser memo)', () => {
  beforeEach(() => {
    mocks.poolQuery.mockReset();
    mocks.getUser.mockReset();
    clearTokenCache();
  });

  it('resolves a repeat token WITHOUT a second Supabase call', async () => {
    found('active');
    expect((await run(auth)).ok).toBe(true);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    // Same token, new request: the cached principal is served from memory.
    expect((await run(auth)).ok).toBe(true);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it('an expired/invalid token inside the cache window still 401s (negatives are never cached)', async () => {
    mocks.getUser.mockResolvedValue({ data: null, error: { message: 'invalid token' } });
    expect((await run(auth)).status).toBe(401);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    // Second attempt must hit Supabase again — a cached rejection would both
    // mask a transient outage and freeze a permanently-dead token.
    expect((await run(auth)).status).toBe(401);
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });

  it('a transport failure inside the cache window is also not cached', async () => {
    mocks.getUser.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    mocks.getUser.mockResolvedValueOnce({ data: { user }, error: null });
    found('active');
    expect((await run(auth)).status).toBe(401); // thrown -> null user -> 401
    expect((await run(auth)).ok).toBe(true); // next call retries and succeeds
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });

  it('the cache does NOT resurrect a suspended account — the local status check runs every request', async () => {
    // Warm the cache with an active account...
    found('active');
    expect((await run(auth)).ok).toBe(true);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);

    // ...then suspend it (this is what an admin action writes: the local role
    // table status flips while the Supabase session stays valid). The cached
    // principal must still be gated by a FRESH resolveRole read.
    found('suspended');
    const out = await run(auth);
    expect(out.status).toBe(403);
    expect(out.body.error.code).toBe('FORBIDDEN');
    expect(mocks.poolQuery).toHaveBeenCalledTimes(2); // status was re-read live
    // And re-activating works again immediately — nothing was frozen.
    found('active');
    expect((await run(auth)).ok).toBe(true);
  });

  it('a token re-resolves from Supabase once the 60s TTL has passed', async () => {
    vi.useFakeTimers();
    try {
      found('active');
      expect((await run(auth)).ok).toBe(true);
      expect(mocks.getUser).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(59_000);
      expect((await run(auth)).ok).toBe(true);
      expect(mocks.getUser).toHaveBeenCalledTimes(1); // still inside the TTL

      vi.advanceTimersByTime(2_000); // now past 60s
      expect((await run(auth)).ok).toBe(true);
      expect(mocks.getUser).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('an empty Authorization header never reaches the cache', async () => {
    const out = await new Promise((resolve) => {
      const req = { headers: {} };
      const res = { status: (s) => ({ json: (b) => resolve({ status: s, body: b }) }) };
      auth(req, res, () => resolve({ ok: true }));
    });
    expect(out.status).toBe(401);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
