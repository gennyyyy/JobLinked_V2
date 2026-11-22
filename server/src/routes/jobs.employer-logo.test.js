import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Job postings carry the employer's current logo version: the embeds read
// profile_images.updated_at (kind 'employer-logo') as logo_updated_at, and the
// frontend turns { id, logo_updated_at } into a cache-busted logo URL.
vi.mock('../db.js', async () => { const h = await import('../__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { auth: h.baAuth }; });

import { on, reset, callsOf } from '../__tests__/helpers/db.js';
import { resetAuth } from '../__tests__/helpers/auth.js';
import { makeApp } from '../__tests__/helpers/app.js';

const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LOGO_AT = '2026-02-03T04:05:06.000Z';
const LOGO_JOIN = "left join profile_images i on i.owner_id = e.id and i.kind = 'employer-logo'";

const jobRow = (extra = {}) => ({
  id: JOB, title: 'Encoder', status: 'published', company_id: EMPLOYER,
  company_name: 'Acme', logo_path: null, logo_updated_at: LOGO_AT, tags: [], ...extra,
});

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

describe('job employer logo version', () => {
  it('GET /jobs/:id embeds employers.logo_updated_at from the profile_images join', async () => {
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [jobRow()] }));

    const res = await request(app).get(`/api/jobs/${JOB}`);

    expect(res.status).toBe(200);
    expect(res.body.employers).toEqual({
      id: EMPLOYER, company_name: 'Acme', logo_path: null, logo_updated_at: LOGO_AT,
    });
    const load = callsOf(/i\.updated_at as logo_updated_at/)[0];
    expect(load.sql).toContain(LOGO_JOIN);
  });

  it('GET /jobs embeds the logo version on every listed job', async () => {
    on(/select count\(\*\)::int c from job_vacancies/, () => ({ rows: [{ c: 1 }] }));
    on(/select j\.\*, e\.company_name, e\.logo_path, i\.updated_at as logo_updated_at from job_vacancies/, () => ({ rows: [jobRow()] }));

    const res = await request(app).get('/api/jobs');

    expect(res.status).toBe(200);
    expect(res.body.jobs[0].employers.logo_updated_at).toBe(LOGO_AT);
    const list = callsOf(/select j\.\*, e\.company_name, e\.logo_path, i\.updated_at as logo_updated_at from job_vacancies/)[0];
    expect(list.sql).toContain(LOGO_JOIN);
  });

  it("GET /employers/:id/jobs embeds the logo version alongside applicant_count", async () => {
    on(/select count\(\*\)::int c from job_vacancies/, () => ({ rows: [{ c: 1 }] }));
    on(/select j\.\*, e\.company_name, e\.logo_path, i\.updated_at as logo_updated_at,/, () => ({
      rows: [{ ...jobRow(), applicant_count: 2 }],
    }));

    const res = await request(app).get(`/api/employers/${EMPLOYER}/jobs`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].employers.logo_updated_at).toBe(LOGO_AT);
    expect(res.body.data[0].applicant_count).toBe(2);
    const list = callsOf(/select j\.\*, e\.company_name, e\.logo_path, i\.updated_at as logo_updated_at,/)[0];
    expect(list.sql).toContain(LOGO_JOIN);
  });
});
