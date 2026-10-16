import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset } from './helpers/db.js';
import { makeApp } from './helpers/app.js';

const app = makeApp();
beforeEach(() => reset());

describe('GET /api/health', () => {
  it('200 { ok: true, db: "ok" } when the database answers', async () => {
    on(/^\s*select 1\s*$/, () => ({ rows: [1] }));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: 'ok' });
  });

  it('503 { ok: false, db: "unavailable" } when the database is unreachable', async () => {
    on(/^\s*select 1\s*$/, () => { throw new Error('connect ECONNREFUSED'); });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, db: 'unavailable' });
  });
});
