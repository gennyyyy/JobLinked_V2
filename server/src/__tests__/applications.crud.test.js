import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const OTHER = '33333333-3333-3333-3333-333333333333';
// Real uuids: a malformed job_id / :id now answers 4xx from the load helpers
// (S1) instead of reaching Postgres and raising 22P02.
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const APP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// applications.js loads the job with `select * from job_vacancies where id = $1`.
const publishJob = (s = 'published', company = EMPLOYER) =>
  on((sql) => /from job_vacancies where id = \$1/.test(sql),
    () => ({ rows: [{ id: JOB, title: 'Dev', status: s, company_id: company }] }));

const appRow = { id: APP, job_id: JOB, seeker_id: SEEKER, resume_id: null, status: 'Applied', job: { title: 'Dev' } };

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

describe('POST /api/applications', () => {
  it('applies to a published job', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    publishJob();
    on((sql) => /insert into job_applications/.test(sql), () => ({ rows: [appRow] }));
    const res = await request(app).post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: JOB, resume_id: null });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Applied');
    expect(callsOf(/insert into job_applications/)[0].params[1]).toBe(SEEKER); // seeker_id from token
  });

  it('409 CONFLICT on a duplicate application', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    publishJob();
    on((sql) => /insert into job_applications/.test(sql), () => {
      const e = new Error('duplicate key'); e.code = '23505'; throw e;
    });
    const res = await request(app).post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: JOB });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('400 BAD_REQUEST when the deadline guard blocks the insert (B3, TOCTOU-safe)', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    publishJob();
    // Postgres evaluates the exists-guard inside the INSERT…SELECT, so a job
    // whose deadline passed returns no row — the handler must 400, not 201.
    on((sql) => /insert into job_applications/.test(sql), () => ({ rows: [] }));
    const res = await request(app).post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: JOB });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.message).toMatch(/deadline/i);
    // The deadline check lives in the write statement itself (current_date),
    // not in a JS compare — no check-then-act window.
    expect(callsOf(/insert into job_applications/)[0].sql).toContain('current_date');
    expect(callsOf(/insert into job_applications/)[0].sql).toContain('deadline');
  });

  it('400 BAD_REQUEST when the job is not accepting applications', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    publishJob('draft');
    const res = await request(app).post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: JOB });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('404 NOT_FOUND when the job does not exist', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: 'nope' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('403 FORBIDDEN for an employer', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: 'job-1' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('POST /api/applications/:id/status', () => {
  const loadOwnedApp = () => on((sql) => /where a\.id = \$1/.test(sql), () => ({ rows: [appRow] }));

  it('moves the status and writes application_status_history in one transaction', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    loadOwnedApp();
    publishJob('published', EMPLOYER);
    const res = await request(app).post(`/api/applications/${APP}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Interview', remarks: 'Sat 10am' });
    expect(res.status).toBe(200);
    const history = callsOf(/insert into application_status_history/)[0];
    expect(history.via).toBe('tx');
    expect(history.params).toEqual([APP, 'Interview', 'Sat 10am', EMPLOYER]);
  });

  it('404 NOT_FOUND for a malformed :id (S1: never a 22P02 500)', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).post('/api/applications/not-a-uuid/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Interview' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(callsOf(/begin/)).toHaveLength(0);
  });

  it('400 BAD_REQUEST for an unknown status', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    loadOwnedApp();
    publishJob();
    const res = await request(app).post(`/api/applications/${APP}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Hired' });
    expect(res.status).toBe(400);
    expect(callsOf(/insert into application_status_history/)).toHaveLength(0);
  });

  it('403 FORBIDDEN when the application belongs to another employer job', async () => {
    const token = loginAs({ id: OTHER, role: 'employer' });
    loadOwnedApp();
    publishJob();
    const res = await request(app).post(`/api/applications/${APP}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Interview' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
