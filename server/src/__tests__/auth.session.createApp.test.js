import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Real middleware stack (createApp): the BA cookie must be the whole credential.
// The db + BA seams stay in-memory, so no Postgres/network is touched.
vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('./helpers/auth.js'); return { auth: h.baAuth }; });

import { reset } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeHardenedApp } from './helpers/app.js';

const SEEKER = '11111111-1111-4111-8111-111111111111';
const app = makeHardenedApp();
beforeEach(() => { reset(); resetAuth(); });

describe('BA cookie through createApp (ADR-056 decision 9)', () => {
  // A cookie and NO Authorization header: the route's auth middleware accepts
  // the session, and attachPrincipal (which runs before the API limiter) keys
  // the request as user 1000 instead of the anonymous 300.
  it('authenticates a protected route and keys the limiter by principal, not IP', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });

    const res = await request(app).get('/api/notifications/mine').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit']).toContain('limit=1000');

    // Failure path, same stack: no session -> 401 and the anonymous IP bucket.
    const anon = await request(app).get('/api/notifications/mine');
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe('UNAUTHORIZED');
    expect(anon.headers['ratelimit']).toContain('limit=300');
  });
});
