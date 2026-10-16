import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

// auth.js builds a Supabase client lazily; stub env so any import path can't throw.
process.env.SUPABASE_URL ||= 'http://127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const { reset } = await import('./helpers/db.js');
const { loginAs, resetAuth } = await import('./helpers/auth.js');
const { makeHardenedApp } = await import('./helpers/app.js');

// Vitest isolates module state per file, so the in-memory limiter counters
// start at zero here.
const remaining = (res) => Number(/remaining=(\d+)/.exec(res.headers['ratelimit'] || '')[1]);

// F-02: TRUST_PROXY is read by createApp() at call time. Build one app with
// the default (unset → 1 hop, the current behaviour) and one with 0 (nothing
// in front — X-Forwarded-For ignored).
const defaultApp = makeHardenedApp();
process.env.TRUST_PROXY = '0';
const noProxyApp = makeHardenedApp();
afterAll(() => { delete process.env.TRUST_PROXY; });

beforeEach(() => { reset(); resetAuth(); });

describe('F-01 — general limiter keys by the authenticated user, IP otherwise', () => {
  const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111';
  const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222';
  // Authenticated leg on an auth route; anonymous leg on the 404 catch-all —
  // both are counted by apiLimiter, only the key differs.
  const asUser = (token) => request(defaultApp).get('/api/notifications/mine').set('Authorization', `Bearer ${token}`);
  const anon = () => request(defaultApp).get('/api/not-a-route');

  it('users behind one IP keep independent buckets; anonymous stays IP-keyed', async () => {
    const a = loginAs({ id: USER_A, role: 'job-seeker' });
    const b = loginAs({ id: USER_B, role: 'employer' });

    const ra = await asUser(a); // user A's bucket
    const rb = await asUser(b); // user B — same socket IP, must NOT share A's bucket
    const ip1 = await anon();   // anonymous → IP bucket
    const ip2 = await anon();   // same IP bucket, counted down
    const ra2 = await asUser(a); // A's bucket again, independent of the IP bucket

    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);
    expect(ip1.status).toBe(404);
    expect(ip2.status).toBe(404);
    expect(ra2.status).toBe(200);

    expect(remaining(ra)).toBe(299);
    expect(remaining(rb)).toBe(299); // separate per-user bucket (no NAT false-limit)
    expect(remaining(ip1)).toBe(299); // anonymous still counted by IP
    expect(remaining(ip2)).toBe(298);
    expect(remaining(ra2)).toBe(298); // user bucket moves on its own
  });

  it('an invalid token falls back to the IP bucket (no free rides)', async () => {
    const before = await anon();
    const bad = await asUser('garbage'); // 401 at the route — but still counted
    const after = await anon();
    expect(before.status).toBe(404);
    expect(bad.status).toBe(401);
    expect(after.status).toBe(404);
    // The garbage-token call consumed the anonymous IP bucket (a fresh
    // per-token bucket would have left `after` at before - 1).
    expect(remaining(after)).toBe(remaining(before) - 2);
  });
});

describe('F-02 — trust proxy is env-driven', () => {
  it('TRUST_PROXY=0 makes a client-set X-Forwarded-For unable to rotate the key', async () => {
    const first = await request(noProxyApp).get('/api/not-a-route').set('X-Forwarded-For', '9.9.9.9');
    const second = await request(noProxyApp).get('/api/not-a-route').set('X-Forwarded-For', '8.8.8.8');
    // Both key on the real socket IP: one shared bucket, counted down.
    expect(remaining(second)).toBe(remaining(first) - 1);
  });

  it('default (unset) is FAIL SAFE 0 — a spoofed XFF cannot mint buckets (F5)', async () => {
    // The Phase 4 load test proved the opposite: with default 1 and nothing in
    // front, any client rotated X-Forwarded-For and defeated every limiter.
    const before = await request(defaultApp).get('/api/not-a-route');
    const a = await request(defaultApp).get('/api/not-a-route').set('X-Forwarded-For', '7.7.7.7');
    const b = await request(defaultApp).get('/api/not-a-route').set('X-Forwarded-For', '6.6.6.6');
    const c = await request(defaultApp).get('/api/not-a-route');
    // One socket-IP bucket: the two spoofed headers counted down the SAME
    // limit as the header-less request, instead of minting fresh 300s.
    expect(remaining(a)).toBe(remaining(before) - 1);
    expect(remaining(b)).toBe(remaining(before) - 2);
    expect(remaining(c)).toBe(remaining(before) - 3);
  });

  it('TRUST_PROXY=1 still trusts exactly one hop when a proxy is deployed', async () => {
    process.env.TRUST_PROXY = '1';
    const oneProxyApp = makeHardenedApp();
    const a = await request(oneProxyApp).get('/api/not-a-route').set('X-Forwarded-For', '7.7.7.7');
    const b = await request(oneProxyApp).get('/api/not-a-route').set('X-Forwarded-For', '6.6.6.6');
    // Each forwarded address mints a fresh key at limit 300 — the documented
    // single-proxy deployment (nginx/Caddy/Cloudflare in front).
    expect(remaining(a)).toBe(299);
    expect(remaining(b)).toBe(299);
    delete process.env.TRUST_PROXY;
  });
});
