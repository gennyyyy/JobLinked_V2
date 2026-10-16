import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { reset } from './helpers/db.js';
import { makeHardenedApp } from './helpers/app.js';

// Vitest isolates module state per file, so the in-memory limiter counters
// start at zero for every test file that mounts the real app.
const app = makeHardenedApp();
beforeEach(() => reset());

describe('C1 — general API rate limiting', () => {
  // 320 real HTTP round-trips through the whole hardened stack: measured 3.5s
  // on a box already loaded by parallel vitest workers, i.e. inside the 5s
  // default - so the timeout, not the limit, decides pass/fail. When this test
  // times out mid-loop the bucket is only partly drained, so the next test's
  // 429 expectation sees a 404: both reported failures share this one cause.
  // The budget is real work, not a sleep - the request count IS the limit.
  // ponytail: 30s; raise it if the loop count ever grows.
  it('counts general /api requests and 429s past 300 per window', { timeout: 30_000 }, async () => {
    let limited = 0;
    for (let i = 0; i < 320; i++) {
      const res = await request(app).get('/api/not-a-route');
      if (i === 0) {
        expect(res.status).toBe(404);
        expect(res.headers['ratelimit']).toContain('limit=300');
      }
      if (res.status === 429) limited++;
    }
    expect(limited).toBe(20);
  });

  // The shared in-process limiter is the point of these tests: the loop above
  // must drain the IP bucket to its 300 limit, so this request can only be a 429.
  // Keep this test after that one - swapping the order makes it assert a 404.
  it('answers 429 with the standard error contract', async () => {
    const res = await request(app).get('/api/not-a-route');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
    });
  });

  it('never throttles /api/health (load balancer probes stay unlimited)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('keeps the stricter auth limiter (429 after 100) intact', async () => {
    let limited = 0;
    for (let i = 0; i < 101; i++) {
      const res = await request(app).get('/api/auth/me');
      if (i === 0) expect(res.status).toBe(401);
      if (res.status === 429) limited++;
    }
    expect(limited).toBe(1);
  });
});
