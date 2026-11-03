import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { reset, on } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

describe('saved jobs', () => {
  beforeEach(() => { reset(); resetAuth(); });

  it('non-seeker gets 403', async () => {
    const token = loginAs({ id: 'emp-1', role: 'employer', status: 'active' });
    const app = makeApp();
    const r = await request(app).get('/api/seekers/me/saved-jobs').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
  });

  it('save a published job returns 201 then 200 on duplicate', async () => {
    const token = loginAs({ id: 'sk-1', role: 'job-seeker', status: 'active' });
    on((sql) => /from job_vacancies where id/i.test(String(sql)), async () => ({ rows: [{ id: 'job-1', status: 'published' }], rowCount: 1 }));
    let inserts = 0;
    on((sql) => /insert into saved_jobs/i.test(String(sql)), async () => {
      inserts += 1;
      return inserts === 1 ? { rows: [{ id: 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
    });
    const app = makeApp();
    const r1 = await request(app).post('/api/seekers/me/saved-jobs').set('Authorization', `Bearer ${token}`).send({ job_id: '11111111-1111-1111-1111-111111111111' });
    expect(r1.status).toBe(201);
    const r2 = await request(app).post('/api/seekers/me/saved-jobs').set('Authorization', `Bearer ${token}`).send({ job_id: '11111111-1111-1111-1111-111111111111' });
    expect(r2.status).toBe(200);
  });

  it('invalid uuid returns 400', async () => {
    const token = loginAs({ id: 'sk-1', role: 'job-seeker', status: 'active' });
    const app = makeApp();
    const r = await request(app).post('/api/seekers/me/saved-jobs').set('Authorization', `Bearer ${token}`).send({ job_id: 'not-uuid' });
    expect(r.status).toBe(400);
  });

  it('delete missing returns 404', async () => {
    const token = loginAs({ id: 'sk-1', role: 'job-seeker', status: 'active' });
    on((sql) => /delete from saved_jobs/i.test(String(sql)), async () => ({ rows: [], rowCount: 0 }));
    const app = makeApp();
    const r = await request(app).delete('/api/seekers/me/saved-jobs/11111111-1111-1111-1111-111111111111').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(404);
  });
});
