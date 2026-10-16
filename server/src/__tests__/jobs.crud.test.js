import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const OTHER = '33333333-3333-3333-3333-333333333333';
const SEEKER = '11111111-1111-1111-1111-111111111111';
const ADMIN = '44444444-4444-4444-4444-444444444444';
// Real uuid: a malformed :id now answers 404 from the load helper (S1)
// instead of reaching Postgres and raising 22P02.
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const job = (company, status = 'published') => ({
  id: JOB, title: 'Dev', status, company_id: company, company_name: 'Acme', logo_path: null, tags: [],
});
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const requireJobLoad = (company, status) =>
  on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(company, status)] }));
const requireCount = () => on(/select count\(\*\)::int/, () => ({ rows: [{ c: 1 }] }));
const requireList = (company) =>
  on((sql) => /select j\.\*, e\.company_name/.test(sql), () => ({ rows: [job(company)] }));

describe('POST /api/jobs', () => {
  it('creates a published job for an accredited employer', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on(/select accreditation_status from employers/, () => ({ rows: [{ accreditation_status: 'approved' }] }));
    on((sql) => /insert into job_vacancies/.test(sql) && /returning id/.test(sql), () => ({ rows: [{ id: JOB }] }));
    requireJobLoad(EMPLOYER);
    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev', work_arrangement: 'Remote / Work from home' });
    expect(res.status).toBe(201);
    expect(res.body.employers.company_name).toBe('Acme');
    // company_id comes from the token, never the body.
    expect(callsOf(/insert into job_vacancies/)[0].params[0]).toBe(EMPLOYER);
    expect(callsOf(/insert into job_status_history/)?.every((c) => c.via === 'tx')).toBe(true);
  });

  it('403 when a non-accredited employer tries to publish', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on(/select accreditation_status from employers/, () => ({ rows: [{ accreditation_status: 'pending' }] }));
    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('saves a draft without requiring accreditation', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on((sql) => /insert into job_vacancies/.test(sql) && /returning id/.test(sql), () => ({ rows: [{ id: JOB }] }));
    requireJobLoad(EMPLOYER, 'draft');
    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev', status: 'draft' });
    expect(res.status).toBe(201);
    expect(callsOf(/select accreditation_status/)).toHaveLength(0);
  });

  it('400 BAD_REQUEST when title is missing', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ location: 'Manila' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('403 FORBIDDEN for a job-seeker', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev', status: 'draft' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/jobs', () => {
  it('pins anonymous callers to published and embeds the employer', async () => {
    requireCount();
    requireList(EMPLOYER);
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.jobs[0].employers.company_name).toBe('Acme');
    expect(callsOf(/where j\.status = \$1/).some((c) => c.params[0] === 'published')).toBe(true);
  });
});

describe('PATCH /api/jobs/:id', () => {
  it('updates an owned job and stamps updated_at', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad(EMPLOYER);
    on((sql) => /update job_vacancies set/.test(sql), () => ({ rowCount: 1 }));
    requireJobLoad(EMPLOYER);
    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Senior Dev' });
    expect(res.status).toBe(200);
    const update = callsOf(/update job_vacancies set/)[0];
    expect(update.sql).toContain('title = $2');
    expect(update.sql).toContain('updated_at = now()');
    expect(update.params).toEqual([JOB, 'Senior Dev']);
  });

  it('403 FORBIDDEN when the job belongs to another employer', async () => {
    const token = loginAs({ id: OTHER, role: 'employer' });
    requireJobLoad(EMPLOYER);
    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Nope' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('404 NOT_FOUND when the job does not exist', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).patch('/api/jobs/nope')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('400 BAD_REQUEST for an invalid work_arrangement', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad(EMPLOYER);
    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ work_arrangement: 'Moon-based' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  // `'' → null` below can never express "clear" for a NOT NULL column, so an
  // emptied field must 400 (BAD_REQUEST) rather than reach the UPDATE and 500
  // on the constraint.
  it('400 BAD_REQUEST when vacancies is emptied, no update', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad(EMPLOYER);
    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vacancies: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });

  it('400 BAD_REQUEST when work_arrangement is emptied, no update', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad(EMPLOYER);
    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ work_arrangement: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });

  // The PESO review statuses (pending/approved/rejected) belong to the admin
  // review flow — an employer must not set them on their own job.
  it.each(['pending', 'approved', 'rejected'])('400 for an employer setting the admin-review status %s', async (status) => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad(EMPLOYER);
    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/update job_vacancies set status/)).toHaveLength(0);
    expect(callsOf(/insert into job_status_history/)).toHaveLength(0);
  });

  it('super-admin keeps the full status enum on PATCH', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    requireJobLoad(EMPLOYER);
    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'rejected' });
    expect(res.status).toBe(200);
    expect(callsOf(/update job_vacancies set status/)[0].params[1]).toBe('rejected');
  });
});

describe('DELETE /api/jobs/:id', () => {
  it('hard-deletes an owned job and reports the application count', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad(EMPLOYER);
    on(/select count\(\*\)::int c from job_applications/, () => ({ rows: [{ c: 3 }] }));
    const res = await request(app).delete(`/api/jobs/${JOB}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true, applications: 3 });
    expect(callsOf(/delete from job_vacancies where id = \$1/)).toHaveLength(1);
  });
});
