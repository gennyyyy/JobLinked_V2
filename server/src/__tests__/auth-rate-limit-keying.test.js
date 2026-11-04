import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { reset } from './helpers/db.js';
import { resetAuth, loginAs } from './helpers/auth.js';
import { makeHardenedApp } from './helpers/app.js';
import { authKeyGenerator } from '../middleware/rateLimit.js';
import { ipKeyGenerator } from 'express-rate-limit';

// Vitest isolates module state per file — the in-memory authLimiter counters
// start at zero here, independent of api-rate-limit.test.js.
const app = makeHardenedApp();
beforeEach(() => { reset(); resetAuth(); });

describe('authKeyGenerator', () => {
  it('returns req.user.id when a principal is attached', () => {
    const req = { user: { id: 'user-abc' }, ip: '1.2.3.4' };
    expect(authKeyGenerator(req)).toBe('user-abc');
  });

  it('falls back to the IP-derived key when no principal is attached', () => {
    const req = { ip: '1.2.3.4' };
    // The fallback must equal what express-rate-limit's ipKeyGenerator would
    // return for the same IP, so anonymous callers keep one shared bucket.
    expect(authKeyGenerator(req)).toBe(ipKeyGenerator('1.2.3.4'));
  });
});

describe('authLimiter keying (integration)', () => {
  // 100 requests from user A + 1 from user B on the same socket. With the
  // bug (IP-keyed), B would be 429'd on request 101 because A had already
  // drained the shared IP bucket. With user-keying, B is unaffected.
  it('does not let one authenticated user exhaust another user bucket on /api/auth/*', { timeout: 30_000 }, async () => {
    const aToken = loginAs({ id: 'user-a', role: 'employer' });
    const bToken = loginAs({ id: 'user-b', role: 'employer' });

    let aLimited = 0;
    for (let i = 0; i < 101; i++) {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${aToken}`);
      if (res.status === 429) aLimited++;
    }
    // A reached the 100/15min limit, so exactly one request is 429.
    expect(aLimited).toBe(1);

    // B is on a different bucket — the very first request must not be 429.
    const bRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${bToken}`);
    expect(bRes.status).not.toBe(429);
  });

  it('anonymous requests still share one IP bucket', { timeout: 30_000 }, async () => {
    let limited = 0;
    for (let i = 0; i < 101; i++) {
      const res = await request(app).get('/api/auth/me');
      if (res.status === 429) limited++;
    }
    expect(limited).toBe(1);
  });
});

describe('TRUST_PROXY boot warning', () => {
  let warnSpy;
  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it('warns once when production has TRUST_PROXY unset', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevTrustProxy = process.env.TRUST_PROXY;
    process.env.NODE_ENV = 'production';
    delete process.env.TRUST_PROXY;
    try {
      // createApp() is the boot path; the warning must fire during it, not
      // per request.
      const { createApp } = await import('../app.js');
      createApp();
      const warnings = warnSpy.mock.calls
        .map((a) => JSON.parse(a[0]))
        .filter((l) => typeof l.msg === 'string' && l.msg.startsWith('TRUST_PROXY'));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({ level: 'warn' });
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevTrustProxy === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = prevTrustProxy;
    }
  });

  it('does not warn when TRUST_PROXY is set to a non-zero hop count', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevTrustProxy = process.env.TRUST_PROXY;
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = '1';
    try {
      vi.resetModules();
      // Re-install mocks after resetModules so the app under test still sees
      // the in-memory DB/auth fakes from this file.
      vi.doMock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
      vi.doMock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });
      const { createApp } = await import('../app.js');
      createApp();
      const warnings = warnSpy.mock.calls
        .map((a) => JSON.parse(a[0]))
        .filter((l) => typeof l.msg === 'string' && l.msg.startsWith('TRUST_PROXY'));
      expect(warnings).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevTrustProxy === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = prevTrustProxy;
    }
  });

  it('does not warn outside production', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevTrustProxy = process.env.TRUST_PROXY;
    process.env.NODE_ENV = 'test';
    delete process.env.TRUST_PROXY;
    try {
      vi.resetModules();
      vi.doMock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
      vi.doMock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });
      const { createApp } = await import('../app.js');
      createApp();
      const warnings = warnSpy.mock.calls
        .map((a) => JSON.parse(a[0]))
        .filter((l) => typeof l.msg === 'string' && l.msg.startsWith('TRUST_PROXY'));
      expect(warnings).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevTrustProxy === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = prevTrustProxy;
    }
  });
});
