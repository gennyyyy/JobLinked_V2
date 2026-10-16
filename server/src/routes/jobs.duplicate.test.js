import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// POST /jobs/:id/duplicate: the copy row and its job_status_history row are
// written in ONE transaction. This was previously a source-text contract that
// devolved into "util.js contains the word rollback" — which proved the *helper*
// exists, not that the *duplicate path* rolls back. Now the REAL route runs
// against the shared harness (mocked pool + real withTransaction), so the
// behaviour is executed and asserted: the copy is a (Copy) draft with timestamps
// stripped and the deadline nulled, both writes share one tx, and a failing
// history write rolls the whole duplicate back (500, rollback fired, no commit).

vi.mock('../db.js', async () => { const h = await import('../__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from '../__tests__/helpers/db.js';
import { loginAs, resetAuth } from '../__tests__/helpers/auth.js';
import { makeApp } from '../__tests__/helpers/app.js';

const app = makeApp();

const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const OTHER = '33333333-3333-3333-3333-333333333333';
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COPY = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// A live job with the columns a duplicate would otherwise drag along.
const origJob = {
  id: JOB, title: 'Dev', status: 'published', company_id: EMPLOYER,
  company_name: 'Acme', logo_path: null, deadline: '2099-01-01', tags: [], description: 'Build things',
};

beforeEach(() => { reset(); resetAuth(); });

const asEmployer = (job = origJob, failHistory = false) => {
  const token = loginAs({ id: EMPLOYER, role: 'employer' });
  on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [job] })); // loadJob (load + reload)
  on((sql) => /insert into job_vacancies/.test(sql) && /returning \*/.test(sql), () => ({ rows: [{ id: COPY }], rowCount: 1 }));
  if (failHistory) on(/insert into job_status_history/, () => { throw new Error('history write failed'); });
  return token;
};
const dup = (token) => request(app).post(`/api/jobs/${JOB}/duplicate`).set('Authorization', `Bearer ${token}`);

describe('POST /jobs/:id/duplicate', () => {
  it('reloads the copy and returns it with a 201', async () => {
    const token = asEmployer();
    const res = await dup(token);
    expect(res.status).toBe(201);
    expect(callsOf(/insert into job_vacancies/)).toHaveLength(1);
  });

  it('writes the copy + history row inside ONE transaction (both via tx, one begin/commit)', async () => {
    const token = asEmployer();
    expect((await dup(token)).status).toBe(201);
    expect(callsOf(/^begin/)).toHaveLength(1);
    expect(callsOf(/^commit/)).toHaveLength(1);
    expect(callsOf(/^rollback/)).toHaveLength(0);
    // Both writes happen on the transaction client, never the pool.
    expect(callsOf(/insert into job_vacancies/).every((c) => c.via === 'tx')).toBe(true);
    expect(callsOf(/insert into job_status_history/).every((c) => c.via === 'tx')).toBe(true);
  });

  it('resets the copy to draft, marks it a (Copy), nulls the deadline, strips timestamps/status', async () => {
    const token = asEmployer();
    expect((await dup(token)).status).toBe(201);
    const insert = callsOf(/insert into job_vacancies/)[0];
    expect(insert.params).toContain('Dev (Copy)'); // (Copy) suffix
    expect(insert.params).toContain('draft');       // status reset
    expect(insert.params).toContain(null);          // deadline nulled
    // Stripped columns never become INSERT columns.
    expect(insert.sql).not.toMatch(/\b(created_at|updated_at|published_at|closed_at|archived_at|remarks|company_name|logo_path)\b/);
    expect(insert.params).not.toContain(JOB);       // the source id is not reused
  });

  it('writes the history row as draft with null remarks and req.user.id', async () => {
    const token = asEmployer();
    expect((await dup(token)).status).toBe(201);
    const history = callsOf(/insert into job_status_history/)[0];
    expect(history.params).toEqual([COPY, 'draft', null, EMPLOYER]);
  });

  // The restored assertion: the duplicate PATH rolls back when a write fails —
  // not merely that util.js mentions rollback. Removing the rollback from
  // withTransaction (or the route) leaves no rollback call and fails this.
  it('rolls back through withTransaction when the history write fails (no copy left behind)', async () => {
    const token = asEmployer(origJob, /* failHistory */ true);
    const res = await dup(token);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    // The copy INSERT was attempted, then the whole tx was rolled back.
    expect(callsOf(/insert into job_vacancies/)).toHaveLength(1);
    expect(callsOf(/^rollback/)).toHaveLength(1);
    expect(callsOf(/^commit/)).toHaveLength(0);
  });

  it('gates the duplicate behind the ownOrAdmin ownership check', async () => {
    // Another employer's job → 403, and not a single write is issued.
    const token = loginAs({ id: OTHER, role: 'employer' });
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [origJob] })); // owned by EMPLOYER
    const res = await dup(token);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(callsOf(/^(insert|update|delete) /)).toHaveLength(0);
  });

  it('404 when the source job does not exist', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on((sql) => /where j\.id = \$1/.test(sql), () => ({ rows: [] })); // load + reload both empty
    const res = await dup(token);
    expect(res.status).toBe(404);
    expect(callsOf(/insert into job_vacancies/)).toHaveLength(0);
  });
});
