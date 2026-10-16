import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '44444444-4444-4444-4444-444444444444';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

// The jobs list COUNT + LIST queries; records the params the page SQL received.
let listParams;
const stubList = () => {
  on(/select count\(\*\)::int c from job_vacancies/, () => ({ rows: [{ c: 1 }] }));
  on(/select j\.\*, e\.company_name, e\.logo_path from job_vacancies/, (params) => {
    listParams = params;
    return { rows: [{ id: 'j1', company_id: EMPLOYER, company_name: 'Acme', logo_path: null, title: 'Dev', tags: [] }] };
  });
};

describe('B7 — page / pageSize guards', () => {
  it('rejects a non-numeric page with 400', async () => {
    const res = await request(app).get('/api/jobs?page=abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects a negative / fractional pageSize with 400', async () => {
    expect((await request(app).get('/api/jobs?pageSize=-5')).status).toBe(400);
    expect((await request(app).get('/api/jobs?pageSize=2.5')).status).toBe(400);
  });

  it('clamps an absurd page instead of overflowing the SQL OFFSET', async () => {
    stubList();
    const res = await request(app).get('/api/jobs?page=99999999999999999999');
    expect(res.status).toBe(200);
    // limit 10, offset (1_000_000 - 1) * 10 — a number Postgres accepts.
    expect(listParams).toEqual(['published', 10, 9999990]);
  });

  it('clamps pageSize to 100 as before', async () => {
    stubList();
    const res = await request(app).get('/api/jobs?pageSize=500');
    expect(res.status).toBe(200);
    expect(listParams[1]).toBe(100);
    expect(res.body.pageSize).toBe(100);
  });
});

describe('B8 — skills param may arrive as an array', () => {
  it('?skills=a&skills=b no longer throws a TypeError', async () => {
    stubList();
    const res = await request(app).get('/api/jobs?skills=a&skills=b');
    expect(res.status).toBe(200);
    const call = callsOf(/ilike any/)[0];
    expect(call.params).toContainEqual(['%a%', '%b%']);
  });
});

describe('B6 — enum-valued status filters are validated', () => {
  it('GET /api/jobs?status=bogus → 400 for a super-admin', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/jobs?status=bogus').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('GET /api/jobs?status=draft still works for a super-admin', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    stubList();
    const res = await request(app).get('/api/jobs?status=draft').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/employers/:id/jobs?status=bogus → 400', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).get(`/api/employers/${EMPLOYER}/jobs?status=bogus`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('GET /api/admin/users?status=bogus → 400', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/admin/users?status=bogus').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('GET /api/admin/jobs?status=bogus → 400', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/admin/jobs?status=bogus').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/applications?status=bogus → 400', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/admin/applications?status=bogus').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/companies?status=bogus → 400', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/admin/companies?status=bogus').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('a valid status filter still reaches the SQL as a parameter', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    on(/select count\(\*\)::int c from employers/, () => ({ rows: [{ c: 0 }] }));
    on(/select \* from employers/, () => ({ rows: [] }));
    const res = await request(app).get('/api/admin/companies?status=suspended').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // The filter param, then pageSize 25 / offset 0 — C2's LIMIT/OFFSET tail.
    expect(callsOf(/select \* from employers/)[0].params).toEqual(['suspended', 25, 0]);
  });
});
