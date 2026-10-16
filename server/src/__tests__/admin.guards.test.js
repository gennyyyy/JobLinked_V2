import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '44444444-4444-4444-4444-444444444444';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

describe('admin routes require super-admin', () => {
  it('401 UNAUTHORIZED with no token', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('403 FORBIDDEN for an employer', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403 FORBIDDEN for a job-seeker', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('200 for a super-admin', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    // Stats aggregates return every count as a column of one row per table
    // (FILTER rewrite); the scalar queries keep the `c` alias.
    on(/count\(\*\)/, () => ({ rows: [{ c: 0, employers: 0, accredited: 0, jobs: 0, pending: 0, approved: 0, closed: 0, expired: 0, applications: 0, accepted: 0, placed: 0 }] }));
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ seekers: 0, employers: 0 });
  });
});
