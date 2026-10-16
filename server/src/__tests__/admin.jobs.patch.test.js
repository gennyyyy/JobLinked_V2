import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// The admin PATCH /admin/jobs/:id allow-list must reject an emptied NOT NULL
// column before the UPDATE: `'' → null` cannot express "clear" for
// `vacancies int not null` (schema.sql:190) or the NOT NULL + CHECK
// `work_arrangement` (schema.sql:183-184), and a null write is a 23502 500.
vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const ADMIN = '44444444-4444-4444-4444-444444444444';
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const asAdmin = () => `Bearer ${loginAs({ id: ADMIN, role: 'super-admin' })}`;
const stubJob = () => on(/^select \* from job_vacancies where id = \$1$/, () => ({
  rows: [{ id: JOB, title: 'Dev', work_arrangement: 'Hybrid', vacancies: 3, status: 'published' }],
}));

describe('PATCH /api/admin/jobs/:id — NOT NULL columns', () => {
  it('400 BAD_REQUEST when vacancies is emptied, no update', async () => {
    stubJob();
    const res = await request(app).patch(`/api/admin/jobs/${JOB}`)
      .set('Authorization', asAdmin())
      .send({ vacancies: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });

  it('400 BAD_REQUEST when work_arrangement is emptied, no update', async () => {
    stubJob();
    const res = await request(app).patch(`/api/admin/jobs/${JOB}`)
      .set('Authorization', asAdmin())
      .send({ work_arrangement: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });

  it('still updates a nullable text column when it is emptied', async () => {
    stubJob();
    on(/update job_vacancies set/, () => ({ rowCount: 1 }));
    on(/^select \* from job_vacancies where id = \$1$/, () => ({
      rows: [{ id: JOB, title: 'Dev', work_arrangement: 'Hybrid', vacancies: 3, location: null }],
    }));
    const res = await request(app).patch(`/api/admin/jobs/${JOB}`)
      .set('Authorization', asAdmin())
      .send({ location: '' });
    expect(res.status).toBe(200);
    const update = callsOf(/update job_vacancies set/)[0];
    expect(update.params).toEqual([JOB, null]);
  });
});
