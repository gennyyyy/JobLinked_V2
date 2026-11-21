import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Task 3: structured `field` (job_field vocabulary) and `skills` (skill
// vocabulary) on the job contract. Create/PATCH answer 400 for a value the
// admin list does not contain, store the canonical casing, and the publish
// fan-out matches skills overlap OR the same field (location still ORed).
// (The GET /jobs?skills= text search has its own suite: jobs.skills.test.js.)
vi.mock('../db.js', async () => { const h = await import('../__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { auth: h.baAuth }; });

import { on, reset, callsOf } from '../__tests__/helpers/db.js';
import { loginAs, resetAuth } from '../__tests__/helpers/auth.js';
import { makeApp } from '../__tests__/helpers/app.js';
import { resetVocabularyCache } from '../vocabulary.js';
import { notifyMatchingSeekers } from './jobs.js';

const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '44444444-4444-4444-4444-444444444444';
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const FIELDS = ['Administrative & Office', 'Information Technology'];
const SKILLS = ['MS Excel', 'Teamwork', 'Driving', 'Customer Service'];

let vocabFields = FIELDS;
let vocabSkills = SKILLS;

const app = makeApp();

const jobRow = (extra = {}) => ({
  id: JOB, title: 'Encoder', status: 'published', company_id: EMPLOYER,
  company_name: 'Acme', logo_path: null, tags: [], field: null, skills: [], ...extra,
});

const requireJobLoad = (job = jobRow()) =>
  on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job] }));

const employerReady = (job = jobRow()) => {
  on(/select accreditation_status from employers/, () => ({ rows: [{ accreditation_status: 'approved' }] }));
  on((sql) => /insert into job_vacancies/.test(sql) && /returning id/.test(sql), () => ({ rows: [{ id: JOB }] }));
  requireJobLoad(job);
};

const create = (token, body) => request(app).post('/api/jobs')
  .set('Cookie', token).send(body);
const patch = (token, body, path = `/api/jobs/${JOB}`) => request(app).patch(path)
  .set('Cookie', token).send(body);

beforeEach(() => {
  reset();
  resetAuth();
  resetVocabularyCache();
  vocabFields = FIELDS;
  vocabSkills = SKILLS;
  on(/from reference_data where category = \$1/, ([category]) => ({
    rows: (category === 'job_field' ? vocabFields : vocabSkills).map((value) => ({ value })),
  }));
});

describe('POST /api/jobs field + skills', () => {
  it('round-trips canonical casing and dedupes skills case-insensitively', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    employerReady(jobRow({ field: 'Information Technology', skills: ['MS Excel', 'Teamwork'] }));

    const res = await create(token, {
      title: 'Encoder',
      field: 'information technology',
      skills: ['ms excel', 'TEAMWORK', 'MS Excel'],
    });

    expect(res.status).toBe(201);
    const insert = callsOf(/insert into job_vacancies/)[0];
    expect(insert.params).toContain('Information Technology');
    expect(insert.params).toContainEqual(['MS Excel', 'Teamwork']);
    expect(res.body.field).toBe('Information Technology');
    expect(res.body.skills).toEqual(['MS Excel', 'Teamwork']);
  });

  it('400s an unknown field without inserting', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });

    const res = await create(token, { title: 'Encoder', field: 'Astrology' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'field must be a listed job field' } });
    expect(callsOf(/insert into job_vacancies/)).toHaveLength(0);
  });

  it('400s an unknown skill, naming the value', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });

    const res = await create(token, { title: 'Encoder', skills: ['MS Excel', 'Underwater Basket Weaving'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.message).toBe('skills contains an unknown value: Underwater Basket Weaving');
    expect(callsOf(/insert into job_vacancies/)).toHaveLength(0);
  });

  it('400s more than 20 skills', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    vocabSkills = Array.from({ length: 21 }, (_, i) => `Skill ${i + 1}`);

    const res = await create(token, { title: 'Encoder', skills: vocabSkills });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('at most 20');
    expect(callsOf(/insert into job_vacancies/)).toHaveLength(0);
  });

  it('400s skills that are not an array', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });

    const res = await create(token, { title: 'Encoder', skills: 'MS Excel' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('skills must be an array');
  });

  it('publishes a legacy-shaped body with no field/skills (no vocabulary read)', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    employerReady();

    const res = await create(token, { title: 'Legacy posting', location: 'Manila' });

    expect(res.status).toBe(201);
    expect(callsOf(/from reference_data/)).toHaveLength(0);
    const insert = callsOf(/insert into job_vacancies/)[0];
    expect(insert.sql).not.toContain('field');
    expect(insert.sql).not.toContain('skills');
  });
});

describe('PATCH /api/jobs/:id field + skills', () => {
  it('rejects an unknown skill before writing', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad(jobRow({ company_id: EMPLOYER }));

    const res = await patch(token, { skills: ['Farming'] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'skills contains an unknown value: Farming' } });
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });

  it('rejects an unknown field before writing', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad(jobRow({ company_id: EMPLOYER }));

    const res = await patch(token, { field: 'Astrology' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('field must be a listed job field');
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });

  it('stores canonical values on a valid patch', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad(jobRow({ company_id: EMPLOYER }));
    on(/update job_vacancies set/, () => ({ rowCount: 1 }));

    const res = await patch(token, { field: 'information technology', skills: ['ms excel'] });

    expect(res.status).toBe(200);
    const update = callsOf(/update job_vacancies set/)[0];
    expect(update.sql).toContain('field = $2');
    expect(update.sql).toContain('skills = $3');
    expect(update.params).toEqual([JOB, 'Information Technology', ['MS Excel']]);
  });
});

describe('PATCH /api/admin/jobs/:id field + skills', () => {
  it('applies the same vocabulary validation', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    on(/select \* from job_vacancies where id = \$1/, () => ({ rows: [jobRow()] }));

    const res = await patch(token, { skills: ['Farming'] }, `/api/admin/jobs/${JOB}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('skills contains an unknown value: Farming');
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });
});

describe('notifyMatchingSeekers — structured matching', () => {
  it('ORs skills overlap, same field, and location; a same-field seeker needs no skill overlap', async () => {
    await notifyMatchingSeekers({
      id: JOB, title: 'IT Support', field: 'Information Technology', skills: ['Teamwork'], location: '100% WFH',
    });

    const insert = callsOf(/insert into notifications/)[0];
    expect(insert.sql).toMatch(/lower\(sk\) = any\(\$1::text\[\]\)\) or field = \$2 or preferred_location ilike \$3/);
    expect(insert.params[0]).toEqual(['teamwork']);
    expect(insert.params[1]).toBe('Information Technology');
    expect(insert.params[2]).toBe('%100\\% WFH%');
    // Cap + dedupe kept exactly as before.
    expect(insert.sql).toContain('date_trunc(\'day\', now())');
    expect(insert.sql).toContain('not exists');
  });

  it('does nothing for a legacy job with empty skills, null field, and no location', async () => {
    await notifyMatchingSeekers({ id: JOB, title: 'Legacy', skills: [], field: null, location: '  ' });
    expect(callsOf(/insert into notifications/)).toHaveLength(0);
  });
});
