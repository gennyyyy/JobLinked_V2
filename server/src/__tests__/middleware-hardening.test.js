import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset } from './helpers/db.js';
import { resetAuth, supabaseAuth } from './helpers/auth.js';
import { makeHardenedApp } from './helpers/app.js';

const app = makeHardenedApp();
beforeEach(() => { reset(); resetAuth(); });

describe('C3 — security headers (helmet)', () => {
  it('sets the helmet defaults plus the cross-origin resource policy the SPA needs', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    // The SPA fetches /api/files/* from another origin: CORP must not be
    // same-origin or cross-origin reads get blocked.
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    // helmet removes the Express fingerprint.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('L2 — CORS preflight caching', () => {
  it('answers OPTIONS with Access-Control-Max-Age: 86400', async () => {
    const res = await request(app)
      .options('/api/jobs')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-max-age']).toBe('86400');
  });
});

describe('L3 — request id', () => {
  it('mints an X-Request-ID (uuid) when the client sends none', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('echoes a sane client-supplied X-Request-ID', async () => {
    const res = await request(app).get('/api/health').set('X-Request-ID', 'trace-42');
    expect(res.headers['x-request-id']).toBe('trace-42');
  });
});

describe('H1 — compression', () => {
  it('gzips responses over the 1kb threshold', async () => {
    on(/count\(\*\)::int/, () => ({ rows: [{ c: 1 }] }));
    on(/limit \$/, () => ({
      rows: [{ id: '00000000-0000-4000-8000-000000000000', title: 'Big job', description: 'x'.repeat(8192), company_id: null }],
    }));
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.body.jobs[0].description).toHaveLength(8192);
  });

  it('leaves small responses uncompressed', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-encoding']).toBeUndefined();
  });
});

describe('M6 — deep health check', () => {
  it('?deep=true reports auth ok when Supabase answers', async () => {
    // A healthy Supabase always answers 4xx for a dummy token; auth-js surfaces
    // that as a resolved AuthError carrying the HTTP status.
    supabaseAuth.getUser.mockImplementationOnce(async () => ({
      data: null, error: { message: 'Invalid JWT', status: 401 },
    }));
    const res = await request(app).get('/api/health?deep=true');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: 'ok', auth: 'ok' });
  });

  it('?deep=true reports auth unavailable when the probe cannot reach Supabase', async () => {
    // auth-js resolves with status 0 when the transport fails (lib/fetch.js).
    supabaseAuth.getUser.mockImplementationOnce(async () => ({
      data: null, error: { message: 'fetch failed', status: 0 },
    }));
    const res = await request(app).get('/api/health?deep=true');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, db: 'ok', auth: 'unavailable' });
  });

  it('?deep=true treats a thrown probe as auth unavailable', async () => {
    supabaseAuth.getUser.mockImplementationOnce(async () => { throw new Error('ECONNREFUSED'); });
    const res = await request(app).get('/api/health?deep=true');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, db: 'ok', auth: 'unavailable' });
  });

  it('?deep=true still fails fast with db unavailable when the database is down', async () => {
    on(/^\s*select 1\s*$/, () => { throw new Error('connect ECONNREFUSED'); });
    const res = await request(app).get('/api/health?deep=true');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, db: 'unavailable' });
  });
});
