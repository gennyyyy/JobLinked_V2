import { describe, expect, it, beforeEach, vi } from 'vitest';
import request from 'supertest';

// P2 (ADR-046): full_name is derived from the name components whenever the
// patch touches one of them. A patch that sends ONLY full_name keeps the
// invite/legacy contract (verbatim). No DDL.
vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const priorName = (row) =>
  on(/select first_name, middle_name, last_name, suffix from job_seekers where id = \$1/, () => ({ rows: [row] }));
const updateReturns = (row) => on(/update job_seekers set/, () => ({ rows: [{ id: SEEKER, ...row }] }));

const patchMe = (token, body) => request(app)
  .patch('/api/seekers/me')
  .set('Authorization', `Bearer ${token}`)
  .send(body);

describe('PATCH /api/seekers/me — full_name derivation', () => {
  it('derives full_name from the patched and stored name components', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    priorName({ first_name: 'old', middle_name: '', last_name: 'old', suffix: '' });
    updateReturns({ first_name: 'john', last_name: 'smith', full_name: 'john smith' });

    const res = await patchMe(token, { first_name: 'John', last_name: 'Smith' });

    expect(res.status).toBe(200);
    expect(res.body.full_name).toBe('john smith');
    // Same normalized values as the components themselves (trim + lowercase).
    expect(callsOf(/update job_seekers set/)[0].params).toEqual([SEEKER, 'john', 'smith', 'john smith']);
  });

  it('stores a full_name-only patch verbatim, without the extra component SELECT', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    updateReturns({ full_name: 'jane doe' });

    const res = await patchMe(token, { full_name: 'Jane Doe' });

    expect(res.status).toBe(200);
    expect(callsOf(/select first_name, middle_name, last_name, suffix from/)).toHaveLength(0);
    expect(callsOf(/update job_seekers set/)[0].params).toEqual([SEEKER, 'jane doe']);
  });

  it('lets the derived value win over a full_name sent alongside components', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    priorName({ first_name: 'old', middle_name: '', last_name: 'doe', suffix: '' });
    updateReturns({ first_name: 'john', full_name: 'john doe' });

    const res = await patchMe(token, { first_name: 'John', full_name: 'x' });

    expect(res.status).toBe(200);
    const update = callsOf(/update job_seekers set/)[0];
    expect(update.params).toEqual([SEEKER, 'john', 'john doe']);
    expect(update.params).not.toContain('x');
  });

  it('404 NOT_FOUND when the profile row is missing (empty prior row is tolerated)', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    on(/update job_seekers set/, () => ({ rows: [] }));

    const res = await patchMe(token, { first_name: 'John' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
