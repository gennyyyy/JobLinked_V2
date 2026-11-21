import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('./helpers/auth.js'); return { auth: h.baAuth }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, sessionOnly, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';
import { resetVocabularyCache } from '../vocabulary.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); resetVocabularyCache(); });

describe('POST /api/auth/provision', () => {
  it('creates a job-seeker profile on first call', async () => {
    const token = sessionOnly({ id: SEEKER });
    on((sql) => /insert into job_seekers/.test(sql) && /returning \*/.test(sql),
      () => ({ rows: [{ id: SEEKER, email: 'u@test.local', full_name: 'ana cruz' }] }));
    const res = await request(app).post('/api/auth/provision')
      .set('Cookie', token)
      .send({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('job-seeker');
    expect(res.body.full_name).toBe('ana cruz');
  });

  it('stores a listed skill in the vocabulary casing and keeps an unlisted one as typed', async () => {
    const token = sessionOnly({ id: SEEKER });
    on(/from reference_data where category = \$1/, () => ({ rows: [{ value: 'MS Excel' }, { value: 'Teamwork' }] }));
    on((sql) => /insert into job_seekers/.test(sql) && /returning \*/.test(sql),
      () => ({ rows: [{ id: SEEKER }] }));

    const res = await request(app).post('/api/auth/provision')
      .set('Cookie', token)
      .send({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz',
        skills: ['ms excel', 'Excel Macros', 'TEAMWORK', 'MS Excel', ''] });

    expect(res.status).toBe(201);
    // $22 in the INSERT: canonical casing for a listed skill, free text kept
    // until the picker lands, case-insensitive dedupe.
    expect(callsOf(/insert into job_seekers/)[0].params[21]).toEqual(['MS Excel', 'Excel Macros', 'Teamwork']);
  });

  it('stores a listed field canonically and clears an empty one', async () => {
    const token = sessionOnly({ id: SEEKER });
    on(/from reference_data where category = \$1/, ([category]) => ({
      rows: category === 'job_field' ? [{ value: 'Information Technology' }] : [],
    }));
    on((sql) => /insert into job_seekers/.test(sql) && /returning \*/.test(sql),
      () => ({ rows: [{ id: SEEKER }] }));

    const created = await request(app).post('/api/auth/provision')
      .set('Cookie', token)
      .send({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz', field: 'information technology' });

    expect(created.status).toBe(201);
    expect(callsOf(/insert into job_seekers/)[0].params[20]).toBe('Information Technology');

    const cleared = await request(app).post('/api/auth/provision')
      .set('Cookie', token)
      .send({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz', field: '' });

    expect(cleared.status).toBe(201);
    expect(callsOf(/insert into job_seekers/)[1].params[20]).toBeNull();
  });

  it('400s a field that is not in the job_field vocabulary', async () => {
    const token = sessionOnly({ id: SEEKER });
    on(/from reference_data where category = \$1/, () => ({ rows: [{ value: 'Information Technology' }] }));

    const res = await request(app).post('/api/auth/provision')
      .set('Cookie', token)
      .send({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz', field: 'Astrology' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'field must be a listed job field' } });
    expect(callsOf(/insert into job_seekers/)).toHaveLength(0);
  });

  it('is idempotent — 200 with the existing row, no new insert', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).post('/api/auth/provision')
      .set('Cookie', token)
      .send({ role: 'job-seeker' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('job-seeker');
    expect(callsOf(/insert into job_seekers/)).toHaveLength(0);
  });

  it('403 when an existing account is suspended', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker', status: 'suspended' });
    const res = await request(app).post('/api/auth/provision')
      .set('Cookie', token)
      .send({ role: 'job-seeker' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('400 BAD_REQUEST for an unknown role', async () => {
    const token = sessionOnly({ id: SEEKER });
    const res = await request(app).post('/api/auth/provision')
      .set('Cookie', token)
      .send({ role: 'wizard' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('403 FORBIDDEN when the super-admin body role is not backed by the BA user role', async () => {
    const token = sessionOnly({ id: SEEKER }); // no BA user.role
    const res = await request(app).post('/api/auth/provision')
      .set('Cookie', token)
      .send({ role: 'super-admin' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('400 BAD_REQUEST for an invalid employment_status', async () => {
    const token = sessionOnly({ id: SEEKER });
    const res = await request(app).post('/api/auth/provision')
      .set('Cookie', token)
      .send({ role: 'job-seeker', employment_status: 'Retired' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('401 UNAUTHORIZED without a token', async () => {
    const res = await request(app).post('/api/auth/provision').send({ role: 'job-seeker' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
