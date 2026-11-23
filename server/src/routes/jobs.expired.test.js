import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// A post past its deadline disappears from the public/seeker lists (the count
// and the page carry the same predicate). The super-admin ledger and the
// employer owner view stay complete — management tables still show dry posts.
vi.mock('../db.js', async () => { const h = await import('../__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { auth: h.baAuth }; });

import { on, reset, callsOf } from '../__tests__/helpers/db.js';
import { loginAs, resetAuth } from '../__tests__/helpers/auth.js';
import { makeApp } from '../__tests__/helpers/app.js';

const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '44444444-4444-4444-4444-444444444444';
const EXPIRY = '(j.deadline is null or j.deadline >= current_date)';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const COUNT = /select count\(\*\)::int c from job_vacancies/;
const LIST = /select j\.\*, e\.company_name, e\.logo_path.* from job_vacancies/;

const stubPublicList = () => {
  on(COUNT, () => ({ rows: [{ c: 0 }] }));
  on(LIST, () => ({ rows: [] }));
};

describe('GET /jobs hides expired posts', () => {
  it('adds the expiry clause to both the count and the page for a public caller', async () => {
    stubPublicList();

    const res = await request(app).get('/api/jobs');

    expect(res.status).toBe(200);
    expect(callsOf(COUNT)[0].sql).toContain(EXPIRY);
    expect(callsOf(LIST)[0].sql).toContain(EXPIRY);
  });

  it('leaves a super-admin query unfiltered', async () => {
    stubPublicList();
    const token = loginAs({ id: ADMIN, role: 'super-admin' });

    const res = await request(app).get('/api/jobs?status=published').set('Cookie', token);

    expect(res.status).toBe(200);
    expect(callsOf(COUNT)[0].sql).not.toContain(EXPIRY);
    expect(callsOf(LIST)[0].sql).not.toContain(EXPIRY);
  });
});

describe('GET /employers/:id/jobs hides expired posts from the public profile', () => {
  const EMPLOYER_COUNT = /select count\(\*\)::int c from job_vacancies j left join employers/;
  const EMPLOYER_LIST = /applicant_count/;

  it('adds the expiry clause for an anonymous caller', async () => {
    on(EMPLOYER_COUNT, () => ({ rows: [{ c: 0 }] }));
    on(EMPLOYER_LIST, () => ({ rows: [] }));

    const res = await request(app).get(`/api/employers/${EMPLOYER}/jobs`);

    expect(res.status).toBe(200);
    expect(callsOf(EMPLOYER_COUNT)[0].sql).toContain(EXPIRY);
    expect(callsOf(EMPLOYER_LIST)[0].sql).toContain(EXPIRY);
  });

  it('leaves the owner view complete', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on(EMPLOYER_COUNT, () => ({ rows: [{ c: 0 }] }));
    on(/count\(\*\) filter \(where status =/, () => ({ rows: [{ total: 0, published: 0, closed: 0, draft: 0 }] }));
    on(EMPLOYER_LIST, () => ({ rows: [] }));

    const res = await request(app).get(`/api/employers/${EMPLOYER}/jobs`).set('Cookie', token);

    expect(res.status).toBe(200);
    expect(callsOf(EMPLOYER_COUNT)[0].sql).not.toContain(EXPIRY);
    expect(callsOf(EMPLOYER_LIST)[0].sql).not.toContain(EXPIRY);
  });
});
