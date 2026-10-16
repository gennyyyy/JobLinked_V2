import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, callsOf, reset } from './helpers/db.js';
import { tokenOnly, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '22222222-2222-2222-2222-222222222222';
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

// Regression: provision inserted an EXPLICIT NULL for the not-null-defaulted
// name columns when the body omitted them, so `payload omits middle_name`
// raised PG 23502 and 500'd. The DB default only applies to ABSENT columns and
// the insert column list is always full, so the route itself must land ''.
describe('auth.provision missing name fields (B16 regression)', () => {
  it('defaults omitted middle_name/suffix to "" instead of NULL (job-seeker)', async () => {
    const token = tokenOnly({ id: SEEKER });
    on((sql) => /insert into job_seekers/.test(sql),
      () => ({ rows: [{ id: SEEKER, email: 'u@test.local', full_name: 'ana cruz' }] }));
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(res.status).toBe(201);
    const [, params] = [null, callsOf(/insert into job_seekers/)[0].params];
    // Column order: id, email, first_name, middle_name, last_name, suffix, ...
    expect(params[3]).toBe(''); // middle_name
    expect(params[5]).toBe(''); // suffix
  });

  it('defaults every omitted name part for an employer provision', async () => {
    const token = tokenOnly({ id: SEEKER, email: 'u2@test.local' });
    on((sql) => /insert into employers/.test(sql),
      () => ({ rows: [{ id: SEEKER, email: 'u2@test.local', full_name: 'an co' }] }));
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'employer', last_name: 'Co' });
    expect(res.status).toBe(201);
    const params = callsOf(/insert into employers/)[0].params;
    // id, email, first_name, middle_name, last_name, suffix, full_name, ...
    expect(params[2]).toBe(''); // first_name
    expect(params[3]).toBe(''); // middle_name
    expect(params[5]).toBe(''); // suffix
  });
});
