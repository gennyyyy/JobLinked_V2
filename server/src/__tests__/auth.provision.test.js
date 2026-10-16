import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, tokenOnly, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

describe('POST /api/auth/provision', () => {
  it('creates a job-seeker profile on first call', async () => {
    const token = tokenOnly({ id: SEEKER });
    on((sql) => /insert into job_seekers/.test(sql) && /returning \*/.test(sql),
      () => ({ rows: [{ id: SEEKER, email: 'u@test.local', full_name: 'ana cruz' }] }));
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'job-seeker', first_name: 'Ana', last_name: 'Cruz' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('job-seeker');
    expect(res.body.full_name).toBe('ana cruz');
  });

  it('is idempotent — 200 with the existing row, no new insert', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'job-seeker' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('job-seeker');
    expect(callsOf(/insert into job_seekers/)).toHaveLength(0);
  });

  it('403 when an existing account is suspended', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker', status: 'suspended' });
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'job-seeker' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('400 BAD_REQUEST for an unknown role', async () => {
    const token = tokenOnly({ id: SEEKER });
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'wizard' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('403 FORBIDDEN when the super-admin body role is not backed by app_metadata', async () => {
    const token = tokenOnly({ id: SEEKER }); // no app_metadata.role
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'super-admin' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('400 BAD_REQUEST for an invalid employment_status', async () => {
    const token = tokenOnly({ id: SEEKER });
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
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

// F-03: the action vocabulary is allow-listed so no user can forge server
// audit action names (admin.login, user.role.change, …) into the admin view.
describe('POST /api/audit action allow-list', () => {
  const post = (body, token) => request(app).post('/api/audit')
    .set('Authorization', `Bearer ${token}`).send(body);

  it.each([
    'auth.login',
    'auth.logout',
    'auth.password.change',
    'auth.password.reset.request',
  ])('204 and writes the row for %s', async (action) => {
    const token = tokenOnly({ id: SEEKER });
    const res = await post({ action }, token);
    expect(res.status).toBe(204);
    const write = callsOf(/insert into audit_logs/)[0];
    expect(write.params[1]).toBe(action);
  });

  it.each([
    ['a forged server action name', 'admin.login'],
    ['a forged data-action name', 'user.role.change'],
    ['a plausible but unknown client event', 'auth.mfa.verify'],
    ['a non-string action', 42],
    ['an empty action', ''],
  ])('400 BAD_REQUEST for %s — no row written', async (_name, action) => {
    const token = tokenOnly({ id: SEEKER });
    const res = await post({ action }, token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/insert into audit_logs/)).toHaveLength(0);
  });

  it('401 UNAUTHORIZED without a token', async () => {
    const res = await post({ action: 'auth.login' }, '');
    expect(res.status).toBe(401);
  });
});
