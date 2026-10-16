import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const OTHER_EMPLOYER = '33333333-3333-3333-3333-333333333333';
const ADMIN = '44444444-4444-4444-4444-444444444444';

const app = makeApp();
const as = (id, role) => `Bearer ${loginAs({ id, role })}`;
const adminGet = (path) => request(app).get(`/api${path}`).set('Authorization', as(ADMIN, 'super-admin'));

beforeEach(() => { reset(); resetAuth(); });

// C2 — every admin list endpoint answers the { data, total, page, pageSize }
// envelope with LIMIT/OFFSET in SQL instead of returning whole tables.
describe('C2 — admin list endpoints are paginated', () => {
  it('GET /admin/users: one UNION ALL, sorted and limited in SQL (M2)', async () => {
    on(/select count\(\*\)::int c from \(/, () => ({ rows: [{ c: 7 }] }));
    on(/select t\.role, t\.profile/, () => ({ rows: [{ role: 'employer', profile: { id: EMPLOYER, full_name: 'Ada', created_at: '2026-02-02T00:00:00.000Z' } }] }));
    const res = await adminGet('/admin/users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [{ id: EMPLOYER, full_name: 'Ada', created_at: '2026-02-02T00:00:00.000Z', role: 'employer' }],
      total: 7, page: 1, pageSize: 25,
    });
    // M2: ORDER BY + LIMIT/OFFSET happen in SQL over the union — rows are no
    // longer fetched whole and sorted in JS.
    const list = callsOf(/select t\.role, t\.profile/)[0];
    expect(list.sql).toContain('union all');
    expect(list.sql).toMatch(/order by t\.created_at desc/);
    expect(list.sql).toMatch(/limit \$\d+ offset \$\d+/);
    expect(list.params).toEqual([25, 0]);
    expect(callsOf(/select count\(\*\)::int c from \(/)).toHaveLength(1);
  });

  it('GET /admin/users?role=employer unions only that table', async () => {
    on(/select count\(\*\)::int c from \(/, () => ({ rows: [{ c: 2 }] }));
    on(/select t\.role, t\.profile/, () => ({ rows: [] }));
    const res = await adminGet('/admin/users?role=employer');
    expect(res.body).toEqual({ data: [], total: 2, page: 1, pageSize: 25 });
    const list = callsOf(/select t\.role, t\.profile/)[0];
    expect(list.sql).toContain('from employers x');
    expect(list.sql).not.toContain('from job_seekers');
    expect(list.sql).not.toContain('from super_admins');
  });

  it('GET /admin/companies returns the envelope with SQL LIMIT/OFFSET', async () => {
    on(/select count\(\*\)::int c from employers/, () => ({ rows: [{ c: 12 }] }));
    on(/select \* from employers/, () => ({ rows: [{ id: EMPLOYER, company_name: 'Acme' }] }));
    const res = await adminGet('/admin/companies');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [{ id: EMPLOYER, company_name: 'Acme' }], total: 12, page: 1, pageSize: 25 });
    const list = callsOf(/select \* from employers/)[0];
    expect(list.sql).toMatch(/order by created_at desc limit \$\d+ offset \$\d+/);
    expect(list.params).toEqual([25, 0]);
  });

  it('GET /admin/jobs returns the envelope with the employer embed', async () => {
    on(/select count\(\*\)::int c from job_vacancies j left join employers/, () => ({ rows: [{ c: 4 }] }));
    on(/as employers/, () => ({ rows: [{ id: 'j1', title: 'Dev', employers: { id: EMPLOYER, company_name: 'Acme' } }] }));
    const res = await adminGet('/admin/jobs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [{ id: 'j1', title: 'Dev', employers: { id: EMPLOYER, company_name: 'Acme' } }],
      total: 4, page: 1, pageSize: 25,
    });
    expect(callsOf(/as employers/)[0].sql).toMatch(/order by j\.created_at desc limit \$\d+ offset \$\d+/);
  });

  it('GET /admin/applications returns the envelope with seeker/job embeds', async () => {
    on(/select count\(\*\)::int c from job_applications a join/, () => ({ rows: [{ c: 9 }] }));
    on(/as seeker/, () => ({ rows: [{ id: 'a1', status: 'Applied', job: { title: 'Dev' }, seeker: { full_name: 'Ana' } }] }));
    const res = await adminGet('/admin/applications');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [{ id: 'a1', status: 'Applied', job: { title: 'Dev' }, seeker: { full_name: 'Ana' } }],
      total: 9, page: 1, pageSize: 25,
    });
    expect(callsOf(/as seeker/)[0].sql).toMatch(/order by a\.applied_at desc limit \$\d+ offset \$\d+/);
  });

  it('GET /admin/accreditations returns the envelope with embeds', async () => {
    on(/select count\(\*\)::int c from employer_accreditations a left join employers/, () => ({ rows: [{ c: 6 }] }));
    on(/e as employers/, () => ({ rows: [{ id: 'acc-1', status: 'pending', employers: { company_name: 'Acme' }, decided_by: { full_name: 'Boss' } }] }));
    const res = await adminGet('/admin/accreditations');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [{ id: 'acc-1', status: 'pending', employers: { company_name: 'Acme' }, decided_by: { full_name: 'Boss' } }],
      total: 6, page: 1, pageSize: 25,
    });
    expect(callsOf(/e as employers/)[0].sql).toMatch(/order by a\.submitted_at desc limit \$\d+ offset \$\d+/);
  });

  it('page past the end → empty data, true total, OFFSET past the rows', async () => {
    on(/select count\(\*\)::int c from employers/, () => ({ rows: [{ c: 12 }] }));
    on(/select \* from employers/, () => ({ rows: [] }));
    const res = await adminGet('/admin/companies?page=99');
    expect(res.body).toEqual({ data: [], total: 12, page: 99, pageSize: 25 });
    expect(callsOf(/select \* from employers/)[0].params).toEqual([25, 2450]);
  });

  it.each([
    ['page=abc', 'page must be a positive integer'],
    ['page=0', 'page must be a positive integer'],
    ['page=1.5', 'page must be a positive integer'],
    ['pageSize=abc', 'pageSize must be a positive integer'],
    ['pageSize=0', 'pageSize must be a positive integer'],
    ['pageSize=-3', 'pageSize must be a positive integer'],
  ])('GET /admin/companies?%s → 400 with no DB round-trip', async (qs, message) => {
    const res = await adminGet(`/admin/companies?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'BAD_REQUEST', message });
    expect(callsOf(/count\(\*\)::int c/)).toHaveLength(0);
  });

  it('clamps an absurd page/pageSize instead of overflowing the SQL OFFSET', async () => {
    on(/select count\(\*\)::int c from employers/, () => ({ rows: [{ c: 12 }] }));
    on(/select \* from employers/, () => ({ rows: [] }));
    const res = await adminGet('/admin/companies?page=99999999999999999999&pageSize=5000');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1_000_000, pageSize: 500 });
    expect(callsOf(/select \* from employers/)[0].params).toEqual([500, 499_999_500]);
  });

  it.each([
    ['/admin/users', EMPLOYER, 'employer'],
    ['/admin/companies', SEEKER, 'job-seeker'],
    ['/admin/jobs', EMPLOYER, 'employer'],
    ['/admin/applications', SEEKER, 'job-seeker'],
    ['/admin/accreditations', EMPLOYER, 'employer'],
  ])('GET %s → 403 for a non-admin', async (path, id, role) => {
    const res = await request(app).get(`/api${path}`).set('Authorization', as(id, role));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// M1 — employer job listings carry the same envelope as the public list.
describe('M1 — GET /employers/:employerId/jobs is paginated', () => {
  it('returns the envelope with applicant_count and SQL LIMIT/OFFSET', async () => {
    on(/select count\(\*\)::int c from job_vacancies j left join employers/, () => ({ rows: [{ c: 9 }] }));
    on(/applicant_count/, () => ({ rows: [{ id: 'j1', company_id: EMPLOYER, company_name: 'Acme', logo_path: null, applicant_count: 4 }] }));
    const res = await request(app).get(`/api/employers/${EMPLOYER}/jobs`).set('Authorization', as(EMPLOYER, 'employer'));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(9);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(25);
    expect(res.body.data).toEqual([{
      id: 'j1', company_id: EMPLOYER, company_name: 'Acme', logo_path: null, applicant_count: 4,
      employers: { id: EMPLOYER, company_name: 'Acme', logo_path: null },
    }]);
    const list = callsOf(/applicant_count/)[0];
    expect(list.sql).toMatch(/order by j\.created_at desc limit \$\d+ offset \$\d+/);
    expect(list.params).toEqual([EMPLOYER, 25, 0]);
  });

  it('page past the end → empty data with the true total', async () => {
    on(/select count\(\*\)::int c from job_vacancies j left join employers/, () => ({ rows: [{ c: 9 }] }));
    on(/applicant_count/, () => ({ rows: [] }));
    const res = await request(app).get(`/api/employers/${EMPLOYER}/jobs?page=5`).set('Authorization', as(EMPLOYER, 'employer'));
    expect(res.body).toEqual({ data: [], total: 9, page: 5, pageSize: 25 });
    expect(callsOf(/applicant_count/)[0].params).toEqual([EMPLOYER, 25, 100]);
  });

  it('junk page params → 400 with no query', async () => {
    const res = await request(app).get(`/api/employers/${EMPLOYER}/jobs?page=abc`).set('Authorization', as(EMPLOYER, 'employer'));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('page must be a positive integer');
    expect(callsOf(/job_vacancies/)).toHaveLength(0);
  });

  it('403 for another employer company, unchanged', async () => {
    const res = await request(app).get(`/api/employers/${EMPLOYER}/jobs`).set('Authorization', as(OTHER_EMPLOYER, 'employer'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('400 for a malformed company id, unchanged', async () => {
    const res = await request(app).get('/api/employers/nope/jobs').set('Authorization', as(EMPLOYER, 'employer'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

// C2 — the CSV report builders scanned whole tables; they now bound the scan.
describe('C2 — report exports are bounded', () => {
  it('applies LIMIT/OFFSET to the row report (page 2)', async () => {
    on(/from job_vacancies j left join employers/, () => ({ rows: [] }));
    const res = await adminGet('/admin/reports/vacancies/export?page=2');
    expect(res.status).toBe(200);
    const call = callsOf(/from job_vacancies j left join employers/)[0];
    expect(call.sql).toMatch(/limit \$\d+ offset \$\d+/);
    expect(call.params).toEqual([500, 500]);
  });

  it('junk page → 400 with no query', async () => {
    const res = await adminGet('/admin/reports/vacancies/export?page=abc');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('page must be a positive integer');
    expect(callsOf(/from job_vacancies/)).toHaveLength(0);
  });

  it('403 for a non-admin, unchanged', async () => {
    const res = await request(app).get('/api/admin/reports/vacancies/export').set('Authorization', as(SEEKER, 'job-seeker'));
    expect(res.status).toBe(403);
  });
});
