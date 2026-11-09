import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset } from './helpers/db.js';
import { loginAs, resetAuth, supabaseAuth } from './helpers/auth.js';
import { makeHardenedApp } from './helpers/app.js';
import { createApp } from '../app.js';
import { uploadDir } from '../upload.js';

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

  // CSP review (docs/plan/2026-11-04-04-security-compliance-plan.md item 4):
  // helmet's default CSP is already conservative and is the policy this API
  // ships. Pin it so a helmet major bump cannot drop it silently.
  it('emits the conservative default CSP', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
  });

  // The CSP must not disturb the flows the plan called out. The SPA fetches the
  // resume as a blob (api.blob -> object URL), so the response only has to
  // stream the bytes intact.
  it('streams a resume byte-for-byte with the CSP header applied', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const token = loginAs({ id, role: 'job-seeker' });
    on(/select seeker_id, file_name from resumes/, () => ({ rows: [{ seeker_id: id, file_name: 'cv.pdf' }] }));
    const dir = path.join(uploadDir, 'resumes', id);
    fs.mkdirSync(dir, { recursive: true });
    const bytes = Buffer.from('%PDF-1.4\ncsp stream test\n');
    fs.writeFileSync(path.join(dir, 'csp-stream-test.pdf'), bytes);
    try {
      const res = await request(app)
        .get(`/api/files/resumes/${id}/csp-stream-test.pdf`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-length']).toBe(String(bytes.length));
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(Buffer.isBuffer(res.body) ? res.body.equals(bytes) : res.text).toBeTruthy();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // CSV export is either a direct attachment (server) or built client-side into
  // a Blob (super-admin screens). Neither is a subresource fetch, so the CSP
  // must leave the attachment response alone.
  it('sends the CSV report attachment with the CSP header applied', async () => {
    const token = loginAs({ id: '44444444-4444-4444-4444-444444444444', role: 'super-admin' });
    on(/select id, full_name, email, status, created_at from job_seekers/, () => ({
      rows: [{ id: 's1', full_name: 'Ana Cruz', email: 'ana@test.local', status: 'active', created_at: '2026-01-01' }],
    }));
    const res = await request(app)
      .get('/api/admin/reports/seekers/export?format=csv')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.text).toContain('Ana Cruz');
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

  // Vite falls back to 5174+ when 5173 is taken; a CORS_ORIGIN pinned to 5173
  // used to lock those sessions out with a headerless 204.
  it('also allows a Vite fallback port when CORS_ORIGIN lists only 5173', async () => {
    const previous = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    try {
      const devApp = createApp();
      const res = await request(devApp)
        .options('/api/jobs')
        .set('Origin', 'http://localhost:5174')
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5174');
    } finally {
      if (previous === undefined) delete process.env.CORS_ORIGIN;
      else process.env.CORS_ORIGIN = previous;
    }
  });

  it('still rejects a non-localhost origin outside production', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil.test');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
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
