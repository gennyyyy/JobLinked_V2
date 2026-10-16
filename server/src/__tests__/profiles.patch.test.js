import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const EMPLOYER = '22222222-2222-2222-2222-222222222222';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

describe('PATCH /api/seekers/me', () => {
  it('allow-lists columns, keeps "" (not NULL) for NOT NULL text, and audits', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    on((sql) => /update job_seekers set/.test(sql), () => ({ rows: [{ id: SEEKER, first_name: '', phone: '0917000000' }] }));
    const res = await request(app).patch('/api/seekers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: '', nickname: 'sneaky', phone: '0917000000', status: 'banned' });
    expect(res.status).toBe(200);
    const update = callsOf(/update job_seekers set/)[0];
    expect(update.sql).toContain('first_name = $2');
    expect(update.params).toContain(''); // REQUIRED_TEXT blank persists ''
    expect(update.sql).not.toContain('nickname'); // not on the allow-list
    expect(update.sql).not.toContain('status'); // not on the allow-list
    expect(update.sql).toContain('updated_at = now()');
    expect(callsOf(/insert into audit_logs/)[0].params[1]).toBe('profile.update');
  });

  it('400 BAD_REQUEST when no allow-listed field is present', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).patch('/api/seekers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ something_else: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('403 FORBIDDEN for an employer', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).patch('/api/seekers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '0917000000' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('PATCH /api/employers/me', () => {
  it('allow-lists columns and keeps "" for the NOT NULL company_name', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on((sql) => /update employers set/.test(sql), () => ({ rows: [{ id: EMPLOYER, company_name: '' }] }));
    const res = await request(app).patch('/api/employers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ company_name: '', id: EMPLOYER + '-hack' });
    expect(res.status).toBe(200);
    const update = callsOf(/update employers set/)[0];
    expect(update.params).toContain('');
    expect(update.sql).not.toMatch(/\bid = \$2/); // id never lands in the SET list
    expect(update.params[0]).toBe(EMPLOYER); // row keyed by the token id
  });

  it('403 FORBIDDEN for a job-seeker', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).patch('/api/employers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ company_name: 'Acme' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
