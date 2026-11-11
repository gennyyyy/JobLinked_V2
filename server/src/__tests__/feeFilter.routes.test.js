import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const job = (company, status = 'draft', extra = {}) => ({
  id: JOB, title: 'Dev', status, company_id: company, company_name: 'Acme', logo_path: null, tags: [], description: 'clean', ...extra,
});

describe('feeFilter routes', () => {
  it('(a) POST /jobs blocked -> 422 zero writes', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on((sql) => /insert into job_vacancies/.test(sql), () => ({ rows: [{ id: JOB }] }));
    const res = await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev', description: 'registration fee applies' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('FEE_POLICY_BLOCKED');
    expect(callsOf(/insert into job_vacancies/)).toHaveLength(0);
  });

  it('(b) PATCH blocked keeps post unchanged', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(EMPLOYER)] }));
    const res = await request(app).patch(`/api/jobs/${JOB}`).set('Authorization', `Bearer ${token}`)
      .send({ description: 'processing payment required' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('FEE_POLICY_BLOCKED');
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });

  it('(c) status to published with hold term -> pending + flag', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    let loads = 0;
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(EMPLOYER, loads++ === 0 ? 'draft' : 'pending', { description: 'deposit required' })] }));
    on(/select accreditation_status from employers/, () => ({ rows: [{ accreditation_status: 'approved' }] }));
    on((sql) => /insert into job_prohibited_flags/.test(sql), () => ({ rows: [], rowCount: 1 }));
    const res = await request(app).post(`/api/jobs/${JOB}/status`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(callsOf(/insert into job_prohibited_flags/)).toHaveLength(1);
  });

  it('(d) clean publish path publishes', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    let loads = 0;
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(EMPLOYER, loads++ === 0 ? 'draft' : 'published')] }));
    on(/select accreditation_status from employers/, () => ({ rows: [{ accreditation_status: 'approved' }] }));
    const res = await request(app).post(`/api/jobs/${JOB}/status`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    expect(callsOf(/insert into job_prohibited_flags/)).toHaveLength(0);
  });

  it('(g) duplicate of held parent 422s', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job(EMPLOYER)] }));
    on((sql) => /from job_prohibited_flags/.test(sql) && /resolved is null/.test(sql), () => ({ rows: [{ id: 'f' }] }));
    const res = await request(app).post(`/api/jobs/${JOB}/duplicate`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('FEE_POLICY_BLOCKED');
  });

  it('GET /jobs/fee-filter/terms returns terms', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).get('/api/jobs/fee-filter/terms').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.block).toContain('registration fee');
    expect(res.body.hold).toContain('fee');
  });
});