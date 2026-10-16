import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, tokenOnly, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const ADMIN = '44444444-4444-4444-4444-444444444444';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

// B12 — audit-log from/to filters were concatenated into timestamptz
// comparisons unchecked; any junk raised 22007 → 500.
describe('B12 — audit-log date filters are validated', () => {
  it('400 BAD_REQUEST for a malformed from', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/admin/audit-logs?from=abc').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/from audit_logs/)).toHaveLength(0);
  });

  it('400 BAD_REQUEST for a partial to date', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/admin/audit-logs?to=2026-01').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('200 and the date bounds reach SQL for valid dates', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    on(/coalesce\(js\.full_name/, () => ({ rows: [] }));
    const res = await request(app).get('/api/admin/audit-logs?from=2026-01-01&to=2026-01-31')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const call = callsOf(/l\.created_at >=/)[0];
    expect(call.params).toContain('2026-01-01T00:00:00');
    expect(callsOf(/l\.created_at <=/)[0].params).toContain('2026-01-31T23:59:59.999');
  });
});

// B15 — LIKE metacharacters in search input must match literally: a search of
// `%%` must not match everything, `a_b` must not match `axb`.
describe('B15 — LIKE wildcards are escaped', () => {
  it('GET /api/jobs?employer=% passes an escaped literal', async () => {
    on(/select count\(\*\)::int c from job_vacancies/, () => ({ rows: [{ c: 0 }] }));
    on(/select j\.\*, e\.company_name, e\.logo_path from job_vacancies/, () => ({ rows: [] }));
    const res = await request(app).get('/api/jobs?employer=%');
    expect(res.status).toBe(200);
    expect(callsOf(/e\.company_name ilike/)[0].params).toContain('%\\%%');
  });

  it('GET /api/jobs?search=a_b escapes the underscore', async () => {
    on(/select count\(\*\)::int c from job_vacancies/, () => ({ rows: [{ c: 0 }] }));
    on(/select j\.\*, e\.company_name, e\.logo_path from job_vacancies/, () => ({ rows: [] }));
    const res = await request(app).get('/api/jobs?search=a_b');
    expect(res.status).toBe(200);
    expect(callsOf(/j\.title ilike/)[0].params).toContain('%a\\_b%');
  });

  it('GET /api/admin/users?search=%% escapes both wildcards', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    // M2: the three tables are now one UNION ALL query (count + page rows).
    on(/select count\(\*\)::int c from \(/, () => ({ rows: [{ c: 0 }] }));
    on(/select t\.role, t\.profile/, () => ({ rows: [] }));
    const res = await request(app).get('/api/admin/users?search=%25%25').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // '%%' → each % escaped: % + \% + \% + % — a literal, not a match-all.
    // The filter runs on the deduped row's jsonb profile (F1); the params
    // must still be the escaped literal, never the raw wildcards.
    expect(callsOf(/profile->>'full_name' ilike/)[0].params).toEqual(['%\\%\\%%', '%\\%\\%%']);
  });
});

// B11 — POST /auth/provision is idempotent by design, but the prior-existence
// check raced a double-submit: both passed, the loser's insert hit the PK →
// 23505 → 500. The loser now answers the documented 200 idempotent body.
describe('B11 — provision double-submit answers 200, not 500', () => {
  it('23505 on the insert returns the existing row with 200', async () => {
    const token = tokenOnly({ id: SEEKER });
    on((sql) => /insert into job_seekers/.test(sql), () => {
      // The racing request wins: its row now exists in the registry.
      loginAs({ id: SEEKER, role: 'job-seeker' });
      const e = new Error('duplicate key value violates unique constraint "job_seekers_pkey"');
      e.code = '23505';
      throw e;
    });
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('job-seeker');
    expect(res.body.id).toBe(SEEKER);
    // The failed transaction was rolled back, nothing half-written.
    expect(callsOf(/^rollback/)).toHaveLength(1);
  });

  it('a real (non-23505) insert failure still 500s', async () => {
    const token = tokenOnly({ id: SEEKER });
    on((sql) => /insert into job_seekers/.test(sql), () => { throw new Error('disk full'); });
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
  });
});
