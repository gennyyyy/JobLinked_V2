import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf, unionOrder } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const ADMIN = '44444444-4444-4444-4444-444444444444';
const U = '55555555-5555-4555-8555-555555555555';

const app = makeApp();
beforeEach(() => {
  reset(); resetAuth();
  for (const t of Object.keys(state.rows)) state.rows[t] = [];
  state.vacancies = [];
  state.applications = [];
});

// F1 (HIGH, data loss): the role move used to `delete from ${table}` —
// job_vacancies.company_id → employers ON DELETE CASCADE (then
// job_applications, resumes, education, history rows) silently destroyed the
// user's postings, applications, and applicant PII. The move now DEACTIVATES
// the source row and upserts the target.
//
// This harness models the three-table registry and the FK-dependent rows so a
// delete shows up as destroyed data: `delete from employers` cascades to the
// jobs and their applications, `delete from job_seekers` to the applications.
const TABLE_ORD = { super_admins: 1, employers: 2, job_seekers: 3 };
const ROLE_LABEL = { super_admins: 'super-admin', employers: 'employer', job_seekers: 'job-seeker' };
const state = {
  rows: { super_admins: [], employers: [], job_seekers: [] },
  vacancies: [],    // { id, company_id } → employers ON DELETE CASCADE
  applications: [], // { id, job_id, seeker_id } → job_vacancies / job_seekers CASCADE
};

const register = () => {
  // findUserTable — same status-aware ordering as the real SQL (verified live
  // against Postgres): active row wins, then super-admin → employer → seeker.
  on(/select tbl, profile from/, () => {
    const winner = Object.entries(state.rows)
      .flatMap(([t, rows]) => rows.map((r) => ({ ...r, t })))
      .sort((a, b) => (b.status === 'active') - (a.status === 'active') || TABLE_ORD[a.t] - TABLE_ORD[b.t])[0];
    return { rows: winner ? [{ tbl: winner.t, profile: { role: ROLE_LABEL[winner.t], status: winner.status, email: winner.email, full_name: winner.full_name } }] : [] };
  });
  on(/^update (\w+) set status = 'inactive'/, (params, sql) => {
    const row = state.rows[sql.match(/^update (\w+)/)[1]].find((r) => r.id === params[0]);
    if (row) row.status = 'inactive';
    return { rowCount: row ? 1 : 0 };
  });
  on(/^insert into (\w+) \(id, email, full_name, status\)/, (params, sql) => {
    const t = sql.match(/^insert into (\w+)/)[1];
    const existing = state.rows[t].find((r) => r.id === params[0]);
    // The per-table email unique index fires even with on conflict (id) —
    // moving onto another account's email is a 409.
    if (state.rows[t].some((r) => r.email === params[1] && r.id !== params[0])) {
      const e = new Error('duplicate key value violates unique index'); e.code = '23505'; throw e;
    }
    // A plain insert onto an existing id is the old B2 500 (PK violation).
    if (existing && !/on conflict/i.test(sql)) {
      const e = new Error('duplicate key value violates unique constraint'); e.code = '23505'; throw e;
    }
    if (existing) existing.status = 'active';
    else state.rows[t].push({ id: params[0], email: params[1], full_name: params[2], status: 'active' });
    return { rows: [{ id: params[0] }], rowCount: 1 };
  });
  on(/^delete from (\w+)/, (params, sql) => {
    const t = sql.match(/^delete from (\w+)/)[1];
    if (t === 'employers') {
      const gone = new Set(state.vacancies.filter((v) => v.company_id === U).map((v) => v.id));
      state.vacancies = state.vacancies.filter((v) => v.company_id !== U);
      state.applications = state.applications.filter((a) => !gone.has(a.job_id));
    }
    if (t === 'job_seekers') state.applications = state.applications.filter((a) => a.seeker_id !== U);
    state.rows[t] = state.rows[t].filter((r) => r.id !== U);
    return { rowCount: 1 };
  });
};

const seedEmployerWithData = () => {
  state.rows.employers.push({ id: U, email: 'u@x.com', full_name: 'U', status: 'active' });
  state.vacancies.push({ id: 'v1', company_id: U }, { id: 'v2', company_id: U });
  state.applications.push({ id: 'a1', job_id: 'v1' }, { id: 'a2', job_id: 'v1' }, { id: 'a3', job_id: 'v2' });
};

const move = (token, role) => request(app).post(`/api/admin/users/${U}/role`)
  .set('Authorization', `Bearer ${token}`).send({ role });

describe('F1 — admin role move never deletes (data-loss regression)', () => {
  it('employer → job-seeker leaves jobs, applications, and their rows intact', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    seedEmployerWithData();
    register();

    const before = { jobs: state.vacancies.map((v) => v.id), apps: state.applications.map((a) => a.id) };
    const res = await move(token, 'job-seeker');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: U, role: 'job-seeker' });

    // THE fix: no DELETE statement at all — a delete cascades and destroys
    // every dependent row (mutation-proof: restoring `delete from ${table}`
    // empties the fixtures below and fails this test).
    expect(callsOf(/^delete from/)).toHaveLength(0);
    expect(state.vacancies.map((v) => v.id)).toEqual(before.jobs);
    expect(state.applications.map((a) => a.id)).toEqual(before.apps);
    // The source row is deactivated (recoverable), the target row is active.
    expect(state.rows.employers[0].status).toBe('inactive');
    expect(state.rows.job_seekers[0]).toMatchObject({ id: U, email: 'u@x.com', full_name: 'U', status: 'active' });
    // One transaction, both writes inside it.
    expect(callsOf(/^begin/)).toHaveLength(1);
    expect(callsOf(/^commit/)).toHaveLength(1);
    expect(callsOf(/^update employers set status = 'inactive'/)).toHaveLength(1);
  });

  it('round-trips job-seeker → employer → job-seeker and lands active (no PK 500)', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    state.rows.job_seekers.push({ id: U, email: 'u@x.com', full_name: 'U', status: 'active' });
    register();

    const first = await move(token, 'employer');
    expect(first.status).toBe(200);
    expect(state.rows.job_seekers).toHaveLength(1);
    expect(state.rows.job_seekers[0].status).toBe('inactive');

    // Moving back upserts onto the deactivated row (on conflict (id) do
    // update … status = 'active') instead of re-inserting into the PK — the
    // original B2 500. A plain insert here throws 23505 in this harness.
    const back = await move(token, 'job-seeker');
    expect(back.status).toBe(200);
    expect(back.body).toEqual({ id: U, role: 'job-seeker' });
    expect(state.rows.job_seekers).toHaveLength(1);
    expect(state.rows.job_seekers[0].status).toBe('active');
    expect(state.rows.employers[0].status).toBe('inactive');
    const upsert = callsOf(/insert into job_seekers \(id, email, full_name, status\)/).pop();
    expect(upsert.sql).toMatch(/on conflict \(id\) do update set email = excluded\.email/);
    expect(upsert.sql).toContain("status = 'active'");
  });

  it('409 CONFLICT when the target table already holds the email (unique index intact)', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    state.rows.employers.push({ id: U, email: 'u@x.com', full_name: 'U', status: 'active' });
    state.rows.job_seekers.push({ id: '99999999-9999-4999-8999-999999999999', email: 'u@x.com', full_name: 'Other', status: 'active' });
    register();
    const res = await move(token, 'job-seeker');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    // The transaction rolled back.
    expect(callsOf(/^rollback/)).toHaveLength(1);
  });

  it('403 when moving your own account (lockout footgun, unchanged)', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).post(`/api/admin/users/${ADMIN}/role`)
      .set('Authorization', `Bearer ${token}`).send({ role: 'employer' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('200 no-op when the role already matches', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    state.rows.employers.push({ id: U, email: 'u@x.com', full_name: 'U', status: 'active' });
    register();
    const res = await move(token, 'employer');
    expect(res.status).toBe(200);
    expect(callsOf(/^(update|insert|delete from)/)).toHaveLength(0);
  });
});

describe('F1 — the moved user resolves and lists under the NEW role', () => {
  it('after a move the registry (and resolveRole) answer the new role, not the shadowed old one', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    seedEmployerWithData();
    register();
    expect((await move(token, 'job-seeker')).status).toBe(200);
    // The deactivated employers row still exists — without the status-aware
    // ordering it would shadow the active job_seekers row everywhere.
    expect(state.rows.employers).toHaveLength(1);
    // findUserTable (status-aware here, verified live for the real SQL) now
    // resolves the job_seekers row: a second move to job-seeker is a no-op.
    const writesSoFar = callsOf(/^(update|insert|delete from)/).length;
    const again = await move(token, 'job-seeker');
    expect(again.status).toBe(200);
    expect(callsOf(/^(update|insert|delete from)/).length).toBe(writesSoFar);
  });

  it('GET /admin/users lists the moved user once, under the new role', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    seedEmployerWithData();
    register();
    expect((await move(token, 'job-seeker')).status).toBe(200);

    // Faithful mini-Postgres for the /admin/users union, built from the SAME
    // state.rows the move just mutated: after the move the id U has an inactive
    // employers row AND an active job_seekers row. DISTINCT ON (id) must dedupe
    // to one row per id, the active one. The dedupe + inner precedence are read
    // from the REAL sql (unionOrder), so dropping `distinct on (id)` from the
    // source leaves BOTH rows, and flipping the status term inverts the winner —
    // either inversion changes the asserted response and fails this test.
    const unionRows = (sql) => {
      const all = Object.entries(state.rows).flatMap(([t, rows]) => rows.map((r) => ({
        role: ROLE_LABEL[t], ord: TABLE_ORD[t], id: r.id, created_at: r.created_at, profile: { ...r, id: r.id },
      })));
      const outerOrder = (rows) => rows.slice().sort((a, b) =>
        String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')) || String(b.id).localeCompare(String(a.id)));
      if (!/distinct on \(id\)/i.test(sql)) return outerOrder(all);
      const groups = new Map();
      for (const r of all) {
        if (!groups.has(r.id)) groups.set(r.id, []);
        groups.get(r.id).push(r);
      }
      const cmp = unionOrder(sql);
      return outerOrder([...groups.values()].map((g) => g.slice().sort(cmp)[0]));
    };
    on(/select count\(\*\)::int c from \(/, (_p, sql) => ({ rows: [{ c: unionRows(sql).length }] }));
    on(/select t\.role, t\.profile/, (params, sql) => {
      const rows = unionRows(sql);
      const limit = Number(params[params.length - 2]);
      const offset = Number(params[params.length - 1]);
      return { rows: rows.slice(offset, offset + limit).map((r) => ({ role: r.role, profile: r.profile })) };
    });

    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Exactly one row for the moved id, and it is the ACTIVE job_seekers row —
    // never the shadowed inactive employers row the move left behind.
    expect(res.body.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: U, status: 'active', role: 'job-seeker', full_name: 'U' });
    expect(res.body).toMatchObject({ page: 1, pageSize: 25 });
  });
});
