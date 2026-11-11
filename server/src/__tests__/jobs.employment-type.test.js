import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// P3 (ADR-046): one canonical employment_type list shared by the DB CHECK,
// db/seed.sql, this server constant and the two UI forms.
vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';
import { EMPLOYMENT_TYPES } from '../routes/jobs.js';

const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '44444444-4444-4444-4444-444444444444';
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CANONICAL = ['Full-time', 'Part-time', 'Contractual', 'Seasonal', 'Casual', 'Job Order', 'Project-based', 'Internship'];

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const requireJobLoad = () =>
  on((sql) => /where j\.id = \$1/.test(sql), () => ({
    rows: [{ id: JOB, title: 'Dev', status: 'draft', company_id: EMPLOYER, company_name: 'Acme', logo_path: null, tags: [] }],
  }));
const stubAdminJob = () =>
  on(/^select \* from job_vacancies where id = \$1$/, () => ({
    rows: [{ id: JOB, title: 'Dev', status: 'published', work_arrangement: 'Hybrid', vacancies: 1, tags: [] }],
  }));

describe('employment_type domain', () => {
  it('exports the canonical list exactly once (DB CHECK / seed / UI must agree)', () => {
    expect(EMPLOYMENT_TYPES).toEqual(CANONICAL);
  });

  it('POST /api/jobs 400s a non-canonical value with no write', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });

    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev', status: 'draft', employment_type: 'Freelance' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.message).toContain('Project-based');
    expect(callsOf(/insert into job_vacancies/)).toHaveLength(0);
  });

  it.each(EMPLOYMENT_TYPES)('POST /api/jobs accepts the canonical value %s', async (type) => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on((sql) => /insert into job_vacancies/.test(sql) && /returning id/.test(sql), () => ({ rows: [{ id: JOB }] }));
    requireJobLoad();

    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev', status: 'draft', employment_type: type });

    expect(res.status).toBe(201);
    expect(callsOf(/insert into job_vacancies/)[0].params).toContain(type);
  });

  it('POST /api/jobs still accepts an empty employment_type (nullable column)', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on((sql) => /insert into job_vacancies/.test(sql) && /returning id/.test(sql), () => ({ rows: [{ id: JOB }] }));
    requireJobLoad();

    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev', status: 'draft', employment_type: '' });

    expect(res.status).toBe(201);
    expect(callsOf(/insert into job_vacancies/)[0].params).toContain(null);
  });

  it('PATCH /api/jobs/:id 400s a non-canonical value with no update', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad();

    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employment_type: 'Freelance' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });

  it.each(EMPLOYMENT_TYPES)('PATCH /api/jobs/:id accepts the canonical value %s', async (type) => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad();
    on(/update job_vacancies set/, () => ({ rowCount: 1 }));

    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employment_type: type });

    expect(res.status).toBe(200);
    expect(callsOf(/update job_vacancies set/)[0].params).toEqual([JOB, type]);
  });

  it('admin PATCH /api/admin/jobs/:id 400s a non-canonical value with no update', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    stubAdminJob();

    const res = await request(app).patch(`/api/admin/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employment_type: 'Freelance' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });

  it.each(EMPLOYMENT_TYPES)('admin PATCH /api/admin/jobs/:id accepts the canonical value %s', async (type) => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    stubAdminJob();
    on(/update job_vacancies set/, () => ({ rowCount: 1 }));

    const res = await request(app).patch(`/api/admin/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employment_type: type });

    expect(res.status).toBe(200);
    expect(callsOf(/update job_vacancies set/)[0].params).toEqual([JOB, type]);
  });
});
