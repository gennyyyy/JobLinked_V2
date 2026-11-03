import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { reset, on } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

describe('announcements', () => {
  beforeEach(() => { reset(); resetAuth(); });

  it('public list returns published only', async () => {
    const token = loginAs({ id: 'sk-1', role: 'job-seeker', status: 'active' });
    on((sql) => /from announcements/i.test(String(sql)), async () => ({ rows: [{ id: 'a1', title: 't', body: 'b', category: 'General', status: 'published', published_at: new Date().toISOString(), created_at: new Date().toISOString(), author_name: null }], rowCount: 1 }));
    const app = makeApp();
    const r = await request(app).get('/api/announcements').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
  });

  it('create as admin with publish fans out (201)', async () => {
    const token = loginAs({ id: 'adm-1', role: 'super-admin', status: 'active' });
    on((sql) => /insert into announcements/i.test(String(sql)), async () => ({ rows: [{ id: 'a2', title: 't', body: 'b', category: 'General', status: 'published', published_at: new Date().toISOString(), created_at: new Date().toISOString(), author_id: 'adm-1' }], rowCount: 1 }));
    on((sql) => /insert into notifications/i.test(String(sql)), async () => ({ rows: [], rowCount: 0 }));
    on((sql) => /from super_admins where status/i.test(String(sql)), async () => ({ rows: [{ id: 'adm-1' }], rowCount: 1 }));
    const app = makeApp();
    const r = await request(app).post('/api/admin/announcements').set('Authorization', `Bearer ${token}`).send({ title: 't', body: 'b', publish: true });
    expect(r.status).toBe(201);
  });
});
