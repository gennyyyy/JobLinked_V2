import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const OTHER = '33333333-3333-3333-3333-333333333333';
const ADMIN = '44444444-4444-4444-4444-444444444444';
// Real uuid: a malformed :id now answers 404 from the load helper (S1).
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const job = (company, status) => ({
  id: JOB, title: 'Dev', status, company_id: company, company_name: 'Acme', logo_path: null, tags: [],
});
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const loadOwnedDraft = (company) =>
  on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(company, 'draft')] }));

describe('POST /api/jobs/:id/status', () => {
  it('writes job + job_status_history in the SAME transaction (no two-write drift)', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    let loads = 0;
    // First load (ownership pre-check) is the draft; reload after commit is published.
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(EMPLOYER, loads++ === 0 ? 'draft' : 'published')] }));
    on(/select accreditation_status from employers/, () => ({ rows: [{ accreditation_status: 'approved' }] }));

    const res = await request(app).post(`/api/jobs/${JOB}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published', remarks: 'ok' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    const sqls = callsOf(/.*/).map((c) => ({ sql: c.sql, via: c.via }));
    const updIdx = sqls.findIndex((c) => /update job_vacancies set status/.test(c.sql) && c.via === 'tx');
    const histIdx = sqls.findIndex((c) => /insert into job_status_history/.test(c.sql) && c.via === 'tx');
    const commitIdx = sqls.findIndex((c) => c.sql === 'commit');
    expect(updIdx).toBeGreaterThan(-1);
    expect(histIdx).toBeGreaterThan(updIdx); // history written after the update...
    expect(commitIdx).toBeGreaterThan(histIdx); // ...and before commit, on the same client
    const hist = callsOf(/insert into job_status_history/)[0];
    expect(hist.params).toEqual([JOB, 'published', 'ok', EMPLOYER]);
  });

  it('records the changed_by as the token user, never a param', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    loadOwnedDraft(EMPLOYER);
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(EMPLOYER, 'closed')] }));
    const res = await request(app).post(`/api/jobs/${JOB}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'closed' });
    expect(res.status).toBe(200);
    expect(callsOf(/insert into job_status_history/)[0].params).toEqual([JOB, 'closed', undefined, EMPLOYER]);
  });

  it('400 BAD_REQUEST for an unknown status', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    loadOwnedDraft(EMPLOYER);
    const res = await request(app).post(`/api/jobs/${JOB}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'teleported' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/insert into job_status_history/)).toHaveLength(0);
  });

  it('404 NOT_FOUND for a malformed id (S1: never a 22P02 500)', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).post('/api/jobs/not-a-uuid/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'closed' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(callsOf(/begin/)).toHaveLength(0);
  });

  it('403 FORBIDDEN when the job belongs to another employer', async () => {
    const token = loginAs({ id: OTHER, role: 'employer' });
    loadOwnedDraft(EMPLOYER);
    const res = await request(app).post(`/api/jobs/${JOB}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'closed' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // The PESO review statuses belong to the admin review flow — the same
  // allow-list as PATCH /jobs/:id (one guard, both routes).
  it.each(['pending', 'approved', 'rejected'])('400 for an employer setting the admin-review status %s', async (status) => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    loadOwnedDraft(EMPLOYER);
    const res = await request(app).post(`/api/jobs/${JOB}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/insert into job_status_history/)).toHaveLength(0);
  });

  it('super-admin keeps the full status enum on POST /status', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    let loads = 0;
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(EMPLOYER, loads++ === 0 ? 'draft' : 'approved')] }));
    const res = await request(app).post(`/api/jobs/${JOB}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });
});
