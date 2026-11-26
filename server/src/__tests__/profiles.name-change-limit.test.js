import { describe, expect, it, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('./helpers/auth.js'); return { auth: h.baAuth }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const EMPLOYER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '33333333-3333-3333-3333-333333333333';
const TARGET = '44444444-4444-4444-4444-444444444444';
const RECENT = '2026-11-20T00:00:00.000Z';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const prior = (table, row) => on(
  new RegExp(`select first_name, middle_name, last_name, suffix, full_name, name_changed_at from ${table} where id = \\$1`),
  () => ({ rows: [row] }),
);
const updateRows = (table, rows) => on(new RegExp(`update ${table} set`), () => ({ rows }));
const probe = (table, row) => on(
  new RegExp(`select name_changed_at from ${table} where id = \\$1`),
  () => ({ rows: row ? [row] : [] }),
);

const patchSeeker = (token, body) => request(app).patch('/api/seekers/me').set('Cookie', token).send(body);

describe('name-change cooldown', () => {
  it('allows the first change and stamps name_changed_at', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    prior('job_seekers', { first_name: 'old', middle_name: '', last_name: 'old', suffix: '', full_name: 'old old', name_changed_at: null });
    updateRows('job_seekers', [{ id: SEEKER, first_name: 'john' }]);

    const res = await patchSeeker(token, { first_name: 'John' });

    expect(res.status).toBe(200);
    const sql = callsOf(/update job_seekers set/)[0].sql;
    expect(sql).toContain('name_changed_at = now()');
    expect(sql).toContain("name_changed_at is null or name_changed_at <= now() - interval '30 days'");
  });

  it('does not consume the change when the name is unchanged', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    prior('job_seekers', { first_name: 'ana', middle_name: '', last_name: 'cruz', suffix: '', full_name: 'ana cruz', name_changed_at: RECENT });
    updateRows('job_seekers', [{ id: SEEKER, phone: '0917000000' }]);

    const res = await patchSeeker(token, { first_name: 'Ana', phone: '0917000000' });

    expect(res.status).toBe(200);
    const sql = callsOf(/update job_seekers set/)[0].sql;
    expect(sql).not.toContain('name_changed_at');
  });

  it('409 NAME_CHANGE_LIMIT inside the window', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    prior('job_seekers', { first_name: 'ana', middle_name: '', last_name: 'cruz', suffix: '', full_name: 'ana cruz', name_changed_at: RECENT });
    updateRows('job_seekers', []);
    probe('job_seekers', { name_changed_at: RECENT });

    const res = await patchSeeker(token, { first_name: 'Maria', phone: '0917000000' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_CHANGE_LIMIT');
    expect(res.body.error.message).toMatch(/You can change your name again on /);
  });

  it('guards a full_name-only change', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    prior('job_seekers', { first_name: '', middle_name: '', last_name: '', suffix: '', full_name: 'old name', name_changed_at: RECENT });
    updateRows('job_seekers', []);
    probe('job_seekers', { name_changed_at: RECENT });

    const res = await patchSeeker(token, { full_name: 'new name' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_CHANGE_LIMIT');
  });

  it('allows the change at the 30-day boundary', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    prior('job_seekers', { first_name: 'ana', middle_name: '', last_name: 'cruz', suffix: '', full_name: 'ana cruz', name_changed_at: old });
    updateRows('job_seekers', [{ id: SEEKER, first_name: 'maria' }]);

    const res = await patchSeeker(token, { first_name: 'Maria' });

    expect(res.status).toBe(200);
    expect(callsOf(/update job_seekers set/)[0].sql).toContain('name_changed_at = now()');
  });

  it('guards the employer representative name', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    prior('employers', { first_name: 'ana', middle_name: '', last_name: 'cruz', suffix: '', full_name: 'ana cruz', name_changed_at: RECENT });
    updateRows('employers', []);
    probe('employers', { name_changed_at: RECENT });

    const res = await request(app).patch('/api/employers/me').set('Cookie', token).send({ first_name: 'Maria' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_CHANGE_LIMIT');
  });

  it('an admin edit respects the target user window (no exemption)', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    on(/select tbl, profile from/, () => ({
      rows: [{ tbl: 'job_seekers', profile: { id: TARGET, status: 'active', first_name: 'ana', middle_name: '', last_name: 'cruz', suffix: '', full_name: 'ana cruz', name_changed_at: RECENT } }],
    }));
    updateRows('job_seekers', []);
    probe('job_seekers', { name_changed_at: RECENT });

    const res = await request(app).patch(`/api/admin/users/${TARGET}`).set('Cookie', token).send({ first_name: 'Maria' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_CHANGE_LIMIT');
  });
});
