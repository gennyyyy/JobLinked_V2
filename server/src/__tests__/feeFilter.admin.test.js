import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const ADMIN = '44444444-4444-4444-4444-444444444444';
const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const job = (status = 'pending', extra = {}) => ({
  id: JOB, title: 'Dev', status, company_id: EMPLOYER, company_name: 'Acme', tags: [], description: 'deposit required', ...extra,
});

describe('feeFilter admin', () => {
  it('(e) admin publish on held post resolves flag + publishes + fans out once', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    let loads = 0;
    on((sql) => /select \* from job_vacancies where id = \$1/.test(sql), () => ({ rows: [job(loads++ === 0 ? 'pending' : 'published')] }));
    on((sql) => /update job_vacancies set status/.test(sql), () => ({ rowCount: 1 }));
    on((sql) => /insert into job_status_history/.test(sql), () => ({ rows: [], rowCount: 1 }));
    const res = await request(app).post(`/api/admin/jobs/${JOB}/publish`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    expect(callsOf(/update job_prohibited_flags set resolved/)).toHaveLength(1);
  });

  it('(f) employer clean edit clears draft + resolved flag', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    let loads = 0;
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(loads++ === 0 ? 'pending' : 'draft', { description: 'clean now' })] }));
    on((sql) => /update job_vacancies set/.test(sql), () => ({ rowCount: 1 }));
    on((sql) => /insert into job_status_history/.test(sql), () => ({ rows: [], rowCount: 1 }));
    const res = await request(app).patch(`/api/jobs/${JOB}`).set('Authorization', `Bearer ${token}`)
      .send({ description: 'clean now' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(callsOf(/update job_prohibited_flags set resolved/)).toHaveLength(1);
  });

  it('admin list includes fee_flags', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    on(/select count\(\*\)::int c from job_vacancies j left join employers/, () => ({ rows: [{ c: 1 }] }));
    on(/as employers/, () => ({ rows: [{ id: JOB, title: 'Dev', employers: { id: EMPLOYER, company_name: 'Acme' }, fee_flags: { matched_terms: ['deposit'], source_fields: ['description'], severity: 'held' } }] }));
    const res = await request(app).get('/api/admin/jobs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].fee_flags).toBeTruthy();
  });
});