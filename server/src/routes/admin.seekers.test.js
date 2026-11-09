import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Addendum A admin reads: the three seeker-child routes and the new
// /resumes route all run through the shared seekerChildRead helper — the
// same uuid 404 guard, the same `where seeker_id = $1` shape. The resumes
// route exists so a super-admin can learn a resume's file_path (the
// /files/* stream endpoint never exposes it).
vi.mock('../db.js', async () => { const h = await import('../__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from '../__tests__/helpers/db.js';
import { loginAs, resetAuth } from '../__tests__/helpers/auth.js';
import { makeApp } from '../__tests__/helpers/app.js';

const app = makeApp();

const ADMIN = '44444444-4444-4444-4444-444444444444';
const SEEKER = '11111111-1111-1111-1111-111111111111';

beforeEach(() => { reset(); resetAuth(); });

const asAdmin = () => loginAs({ id: ADMIN, role: 'super-admin' });
const get = (path, token) => request(app).get(`/api${path}`).set('Authorization', `Bearer ${token}`);

describe('GET /api/admin/seekers/:id/resumes', () => {
  it('returns the seeker resume rows as stored, active first', async () => {
    const rows = [
      { id: 2, seeker_id: SEEKER, file_path: `resumes/${SEEKER}/b.pdf`, file_name: 'b.pdf', is_active: true, uploaded_at: '2026-06-01T00:00:00.000Z' },
      { id: 1, seeker_id: SEEKER, file_path: `resumes/${SEEKER}/a.pdf`, file_name: 'a.pdf', is_active: false, uploaded_at: '2026-05-01T00:00:00.000Z' },
    ];
    on((sql) => sql.includes('from resumes where seeker_id = $1'), () => ({ rows }));
    const res = await get(`/admin/seekers/${SEEKER}/resumes`, asAdmin());
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    const call = callsOf(/from resumes where seeker_id = \$1/)[0];
    expect(call.params).toEqual([SEEKER]);
    expect(call.sql).toContain('order by is_active desc, uploaded_at desc');
  });

  it('404s a malformed id without querying Postgres', async () => {
    const res = await get('/admin/seekers/not-a-uuid/resumes', asAdmin());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(callsOf(/from resumes/)).toHaveLength(0);
  });

  it('403s a non-admin without querying Postgres', async () => {
    const token = loginAs({ id: '22222222-2222-2222-2222-222222222222', role: 'employer' });
    const res = await get(`/admin/seekers/${SEEKER}/resumes`, token);
    expect(res.status).toBe(403);
    expect(callsOf(/from resumes/)).toHaveLength(0);
  });
});

describe('shared seekerChildRead helper', () => {
  it('education still answers with the same shape through the helper', async () => {
    const rows = [{ id: 9, seeker_id: SEEKER, level: 'College', school: 'PUP Santa Maria', field: 'BSIT', start_year: 2018, end_year: 2022 }];
    on((sql) => sql.includes('from education where seeker_id = $1'), () => ({ rows }));
    const res = await get(`/admin/seekers/${SEEKER}/education`, asAdmin());
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(callsOf(/from education where seeker_id = \$1/)[0].sql).toContain('order by id desc');
  });

  it('experience reads work_experience and employment reads employment_history', async () => {
    on((sql) => sql.includes('from work_experience where seeker_id = $1'), () => ({ rows: [{ id: 1, company: 'Acme', position: 'Dev' }] }));
    on((sql) => sql.includes('from employment_history where seeker_id = $1'), () => ({ rows: [{ id: 'e-1', employer_name: 'Acme', position: 'Dev', is_current: true }] }));
    const a = await get(`/admin/seekers/${SEEKER}/experience`, asAdmin());
    const b = await get(`/admin/seekers/${SEEKER}/employment`, asAdmin());
    expect(a.body).toEqual([{ id: 1, company: 'Acme', position: 'Dev' }]);
    expect(b.body).toEqual([{ id: 'e-1', employer_name: 'Acme', position: 'Dev', is_current: true }]);
  });
});
