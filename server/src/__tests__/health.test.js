import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { supabaseAuth } from './helpers/auth.js';
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

  // ADR-056: the deep probe is a local check that the BA schema exists — no
  // Supabase round-trip (the old dummy-token getUser call is gone).
  it('200 { auth: "ok" } when the auth schema is present, without touching Supabase', async () => {
    on(/^\s*select 1\s*$/, () => ({ rows: [1] }));
    on(/to_regclass\('auth\."user"'\)/, () => ({ rows: [{ t: 'auth."user"' }] }));
    const res = await request(app).get('/api/health?deep=true');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: 'ok', auth: 'ok' });
    expect(callsOf(/to_regclass\('auth\."user"'\)/)).toHaveLength(1);
    expect(supabaseAuth.getUser).not.toHaveBeenCalled();
  });

  it('503 { auth: "unavailable" } when the auth schema is missing', async () => {
    on(/^\s*select 1\s*$/, () => ({ rows: [1] }));
    on(/to_regclass\('auth\."user"'\)/, () => ({ rows: [{ t: null }] }));
    const res = await request(app).get('/api/health?deep=true');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, db: 'ok', auth: 'unavailable' });
  });

  it('503 on a failed auth-schema probe', async () => {
    on(/^\s*select 1\s*$/, () => ({ rows: [1] }));
    on(/to_regclass/, () => { throw new Error('42P01 undefined schema'); });
    const res = await request(app).get('/api/health?deep=true');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, db: 'ok', auth: 'unavailable' });
  });
});
