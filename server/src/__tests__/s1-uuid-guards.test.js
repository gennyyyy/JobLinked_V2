import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '44444444-4444-4444-4444-444444444444';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

// S1: a malformed :id must answer 4xx from the load helpers, never reach a
// uuid column and raise 22P02 → 500 INTERNAL.
describe('S1 — malformed uuid :id never reaches Postgres', () => {
  it('GET /api/jobs/:id → 404, no query issued', async () => {
    const res = await request(app).get('/api/jobs/not-a-uuid');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(callsOf(/job_vacancies/)).toHaveLength(0);
  });

  it('PATCH /api/jobs/:id → 404 for the owner path too', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).patch('/api/jobs/xyz').set('Authorization', `Bearer ${token}`).send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(callsOf(/job_vacancies/)).toHaveLength(0);
  });

  it('POST /api/applications with a malformed job_id → 404 (body param too)', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).post('/api/applications')
      .set('Authorization', `Bearer ${token}`).send({ job_id: 'xyz' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/applications with a malformed resume_id → 400, no query', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    on((sql) => /from job_vacancies where id = \$1/.test(sql),
      () => ({ rows: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'published', company_id: EMPLOYER }] }));
    const res = await request(app).post('/api/applications')
      .set('Authorization', `Bearer ${token}`).send({ job_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', resume_id: 'nope' });
    expect(res.status).toBe(400);
    expect(callsOf(/from resumes where id/)).toHaveLength(0);
  });

  it('PATCH /api/admin/users/:id → 404 via findUserTable', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).patch('/api/admin/users/not-a-uuid')
      .set('Authorization', `Bearer ${token}`).send({ full_name: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE /api/files/resumes/:id → 404, no query', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).delete('/api/files/resumes/abc').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(callsOf(/from resumes where id/)).toHaveLength(0);
  });

  it('POST /api/files/resumes/:id/activate → 404, no query', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).post('/api/files/resumes/abc/activate').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(callsOf(/from resumes where id/)).toHaveLength(0);
  });

  it('PATCH /api/accreditations/:id → 404, no query', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).patch('/api/accreditations/123')
      .set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(res.status).toBe(404);
    expect(callsOf(/update employer_accreditations/)).toHaveLength(0);
  });

  it('PATCH /api/documents/:id → 404, no query (S1 gap closed)', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).patch('/api/documents/xyz')
      .set('Authorization', `Bearer ${token}`).send({ status: 'verified' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(callsOf(/update employer_documents/)).toHaveLength(0);
  });

  it('GET /api/employers/:employerId/jobs → 400 for a malformed company id', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/employers/nope/jobs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('PATCH /api/admin/jobs/:id → 404, no query', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).patch('/api/admin/jobs/zzz')
      .set('Authorization', `Bearer ${token}`).send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(callsOf(/from job_vacancies where id/)).toHaveLength(0);
  });

  it('POST /api/admin/jobs/:id/publish → 404, no query', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).post('/api/admin/jobs/zzz/publish').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(callsOf(/from job_vacancies where id/)).toHaveLength(0);
  });

  it('POST /api/admin/users/:id/role → 404 for a malformed id', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).post('/api/admin/users/not-a-uuid/role')
      .set('Authorization', `Bearer ${token}`).send({ role: 'employer' });
    expect(res.status).toBe(404);
  });
});
