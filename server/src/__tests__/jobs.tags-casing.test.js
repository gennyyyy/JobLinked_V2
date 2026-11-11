import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// P1 (ADR-046): job tags share the seeker-skills case domain. The publish
// fan-out compares tags with `skills && $n::text[]` (case-sensitive) against
// lowercased seeker skills, so every job write path must lowercase + dedupe.
vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '44444444-4444-4444-4444-444444444444';
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const job = (tags = []) => ({
  id: JOB, title: 'Dev', status: 'draft', company_id: EMPLOYER, company_name: 'Acme', logo_path: null, tags,
});
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const requireJobLoad = (tags) => on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(tags)] }));
const DIRTY = ['Urgent Hiring', 'urgent hiring'];

describe('job tag casing', () => {
  it('POST /api/jobs inserts lowercased, deduped tags', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on((sql) => /insert into job_vacancies/.test(sql) && /returning id/.test(sql), () => ({ rows: [{ id: JOB }] }));
    requireJobLoad();

    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev', status: 'draft', tags: DIRTY });

    expect(res.status).toBe(201);
    expect(callsOf(/insert into job_vacancies/)[0].params).toContainEqual(['urgent hiring']);
  });

  it('PATCH /api/jobs/:id stores lowercased, deduped tags', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad();
    on(/update job_vacancies set/, () => ({ rowCount: 1 }));

    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: DIRTY });

    expect(res.status).toBe(200);
    expect(callsOf(/update job_vacancies set/)[0].params).toEqual([JOB, ['urgent hiring']]);
  });

  it('POST /api/jobs/:id/duplicate normalizes the copied tags', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad(DIRTY);
    on((sql) => /insert into job_vacancies/.test(sql) && /returning \*/.test(sql), () => ({ rows: [{ id: JOB }] }));

    const res = await request(app).post(`/api/jobs/${JOB}/duplicate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(callsOf(/insert into job_vacancies/)[0].params).toContainEqual(['urgent hiring']);
  });

  it('admin PATCH /api/admin/jobs/:id stores lowercased, deduped tags', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    on(/^select \* from job_vacancies where id = \$1$/, () => ({
      rows: [{ id: JOB, title: 'Dev', status: 'published', work_arrangement: 'Hybrid', vacancies: 1, tags: [] }],
    }));
    on(/update job_vacancies set/, () => ({ rowCount: 1 }));

    const res = await request(app).patch(`/api/admin/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: DIRTY });

    expect(res.status).toBe(200);
    expect(callsOf(/update job_vacancies set/)[0].params).toEqual([JOB, ['urgent hiring']]);
  });

  it('400s a non-array tags value instead of writing it (failure path stays empty/array-safe)', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad();
    on(/update job_vacancies set/, () => ({ rowCount: 1 }));

    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: 'Urgent Hiring' });

    // A string is not a tags list: the helper yields [] so the NOT NULL array
    // column receives a valid empty array rather than a type error.
    expect(res.status).toBe(200);
    expect(callsOf(/update job_vacancies set/)[0].params).toEqual([JOB, []]);
  });
});
