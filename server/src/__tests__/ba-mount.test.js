import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Better Auth reads its environment at module load. Give it the dev-shaped
// values a test needs; ba.js pins the origin check on regardless of NODE_ENV
// (see advanced.disableOriginCheck), so the CSRF gate is exercised here. The
// dummy Turnstile secret keeps the captcha plugin answering 400 (missing token)
// instead of 500 (missing key); with no x-captcha-response it never calls out.
vi.hoisted(() => {
  process.env.BETTER_AUTH_URL ||= 'http://localhost:4000';
  process.env.BETTER_AUTH_SECRET ||= 'ba-mount-test-secret-0123456789abcdef';
  process.env.TURNSTILE_SECRET_KEY ||= 'ba-mount-test-turnstile-secret';
});

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset } from './helpers/db.js';
import { tokenOnlyLegacy, resetAuth } from './helpers/auth.js';
import { makeHardenedApp } from './helpers/app.js';

const SEEKER = '11111111-1111-4111-8111-111111111111';
const app = makeHardenedApp();
beforeEach(() => { reset(); resetAuth(); });

describe('better-auth mount', () => {
  // (a) The BA catch-all is reachable through the real middleware stack.
  it('GET /api/auth/ok answers 200 through the real stack', async () => {
    const res = await request(app).get('/api/auth/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  // (c) CSRF gate (Review Focus 2). BA validates the Origin of a credentialed
  // POST before any DB work. Note: in 1.7.27 the captcha plugin's onRequest runs
  // BEFORE the endpoint's origin middleware, so /sign-in/email reliably answers
  // the captcha 400 first; sign-out with a cookie is the endpoint that exposes
  // the origin gate itself. Both cases are pinned below.
  it('403 INVALID_ORIGIN for an untrusted Origin on a credentialed auth POST', async () => {
    const res = await request(app).post('/api/auth/sign-out')
      .set('Origin', 'https://evil.example')
      .set('Cookie', 'better-auth.session_token=forged')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INVALID_ORIGIN');
  });

  it('accepts a Vite dev Origin (not 403) on the same POST', async () => {
    const res = await request(app).post('/api/auth/sign-out')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'better-auth.session_token=forged')
      .send({});
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts a Vite fallback Origin (5174) in dev, matching the CORS list', async () => {
    const res = await request(app).post('/api/auth/sign-out')
      .set('Origin', 'http://localhost:5174')
      .set('Cookie', 'better-auth.session_token=forged')
      .send({});
    expect(res.status).not.toBe(403);
  });

  it('lets a trusted Origin reach sign-in (captcha, not CSRF, stops it before the DB)', async () => {
    const res = await request(app).post('/api/auth/sign-in/email')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'nobody@test.local', password: 'whatever1!' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_RESPONSE');
  });

  // (e) Our /auth/provision must match BEFORE the BA catch-all, and must parse
  // its own body now that express.json() sits after the BA mount.
  it('POST /api/auth/provision 401s with no token (ours, not BA)', async () => {
    const res = await request(app).post('/api/auth/provision').send({ role: 'job-seeker' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/auth/provision 400s without a role (route-level body parser)', async () => {
    const token = tokenOnlyLegacy({ id: SEEKER });
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('POST /api/auth/provision creates the row from a parsed body', async () => {
    const token = tokenOnlyLegacy({ id: SEEKER });
    on((sql) => /insert into job_seekers/.test(sql) && /returning \*/.test(sql),
      () => ({ rows: [{ id: SEEKER, email: 'u@test.local', full_name: 'ana cruz' }] }));
    const res = await request(app).post('/api/auth/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'job-seeker', terms_accepted: true, first_name: 'Ana', last_name: 'Cruz' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('job-seeker');
  });
});

describe('better-auth mount order', () => {
  // (d) The ordering is the task: BA must see the raw request (req.body still
  // undefined) and the path unstripped, or its node handler cannot read the
  // body. A stub replaces the real handler so this makes no DB/network call.
  it('hands the raw body and full /api/auth path to the BA node handler', async () => {
    const seen = { url: null, body: 'unset', method: null };
    const handler = vi.fn((req, res) => {
      seen.url = req.url;
      seen.body = req.body;
      seen.method = req.method;
      res.status(200).json({ handled: 'ba-stub' });
    });
    vi.doMock('better-auth/node', () => ({ toNodeHandler: () => handler }));
    vi.doMock('../ba.js', () => ({ auth: {} }));
    vi.resetModules();
    try {
      const { createApp } = await import('../app.js');
      const res = await request(createApp())
        .post('/api/auth/sign-in/email')
        .set('Content-Type', 'application/json')
        .send({ email: 'x@y.z', password: 'pw' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ handled: 'ba-stub' });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(seen.method).toBe('POST');
      expect(seen.url).toBe('/api/auth/sign-in/email');
      // express.json() sits AFTER the BA mount: the stub got the raw stream.
      expect(seen.body).toBeUndefined();
    } finally {
      vi.doUnmock('better-auth/node');
      vi.doUnmock('../ba.js');
      vi.resetModules();
    }
  });

  // ADR-056 decision 6: without the secret the plugin is absent, so a credential
  // POST cannot answer 400 MISSING_RESPONSE. Asserted on the built instance (not
  // through a request) because BA's own pg pool is outside the mounted mock seam.
  it('loads no captcha plugin when TURNSTILE_SECRET_KEY is unset (dev)', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules();
    try {
      const { auth } = await import('../ba.js');
      const ids = auth.options.plugins.map((plugin) => plugin.id);
      expect(ids).not.toContain('captcha');
      expect(warn.mock.calls.some(([line]) => /TURNSTILE_SECRET_KEY/.test(line))).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
