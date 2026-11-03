import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { reset, on } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

describe('employment corrections', () => {
  beforeEach(() => { reset(); resetAuth(); });

  it('message > 1000 chars returns 400', async () => {
    const token = loginAs({ id: 'sk-1', role: 'job-seeker', status: 'active' });
    on((sql) => /from employment_history where id/i.test(String(sql)), async () => ({ rows: [{ id: 'e1', seeker_id: 'sk-1', employer_name: 'C', position: 'P' }], rowCount: 1 }));
    const app = makeApp();
    const r = await request(app).post('/api/seekers/me/employment/e1/corrections').set('Authorization', `Bearer ${token}`).send({ message: 'a'.repeat(1001) });
    expect(r.status).toBe(400);
  });

  it('valid correction returns 201', async () => {
    const token = loginAs({ id: 'sk-1', role: 'job-seeker', status: 'active' });
    on((sql) => /from employment_history where id/i.test(String(sql)), async () => ({ rows: [{ id: 'e1', seeker_id: 'sk-1', employer_name: 'C', position: 'P' }], rowCount: 1 }));
    on((sql) => /insert into employment_corrections/i.test(String(sql)), async () => ({ rows: [{ id: 'c1', employment_id: 'e1', seeker_id: 'sk-1', message: 'fix', status: 'Pending', created_at: new Date().toISOString() }], rowCount: 1 }));
    const app = makeApp();
    const r = await request(app).post('/api/seekers/me/employment/11111111-1111-1111-1111-111111111111/corrections').set('Authorization', `Bearer ${token}`).send({ message: 'fix' });
    expect(r.status).toBe(201);
  });

  it('cannot correct another seekers employment (404)', async () => {
    const token = loginAs({ id: 'sk-1', role: 'job-seeker', status: 'active' });
    on((sql) => /from employment_history where id/i.test(String(sql)), async () => ({ rows: [{ id: 'e1', seeker_id: 'other', employer_name: 'C', position: 'P' }], rowCount: 1 }));
    const app = makeApp();
    const r = await request(app).post('/api/seekers/me/employment/11111111-1111-1111-1111-111111111111/corrections').set('Authorization', `Bearer ${token}`).send({ message: 'fix' });
    expect(r.status).toBe(404);
  });
});
