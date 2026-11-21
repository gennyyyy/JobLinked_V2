import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// The single mock seam: Supabase + Better Auth sessions both resolve through
// helpers/auth.js, and resolveRole reads helpers/db.js.
vi.mock('./db.js', async () => { const h = await import('./__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./__tests__/helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });
vi.mock('./ba.js', async () => { const h = await import('./__tests__/helpers/auth.js'); return { auth: h.baAuth }; });

import { on, reset } from './__tests__/helpers/db.js';
import { baAuth, loginAs, loginAsBA, resetAuth } from './__tests__/helpers/auth.js';
import { makeApp, makeHardenedApp } from './__tests__/helpers/app.js';
import { tokenAuth } from './auth.js';

const SEEKER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

// Resolves { ok: true, req } when next() runs, { status, body } when the
// middleware answers with err(res, ...) itself.
const call = (mw, req) => new Promise((resolve) => {
  const res = { status: (s) => ({ json: (b) => resolve({ status: s, body: b }) }) };
  mw(req, res, () => resolve({ ok: true, req }));
});

describe('dual session resolution (ADR-056 decision 8)', () => {
  // (a) A BA cookie alone is a session. The role still comes from the Postgres
  // role table, and the retired app_metadata never rides on the principal.
  it('resolves a BA cookie to the role-table principal with no app_metadata', async () => {
    const cookie = loginAsBA({ id: SEEKER, role: 'job-seeker' });

    const res = await request(makeHardenedApp()).get('/api/auth/me').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('job-seeker');
    expect(res.body).not.toHaveProperty('app_metadata');
    // attachPrincipal (app-wide) and the route's tokenAuth share _session.
    expect(baAuth.api.getSession).toHaveBeenCalledTimes(1);
  });

  it('tokenAuth maps the BA user to { id, email, role } with app_metadata undefined', async () => {
    const cookie = loginAsBA({ id: SEEKER, role: 'employer' });

    const out = await call(tokenAuth, { headers: { cookie } });

    expect(out.ok).toBe(true);
    expect(out.req.user).toMatchObject({ id: SEEKER, email: `${SEEKER}@test.local`, role: 'employer' });
    expect(out.req.user.app_metadata).toBeUndefined();
  });

  // (b) The legacy Supabase bearer path is untouched — and the BA fast path
  // means no BA lookup is even attempted without the cookie.
  it('keeps the Supabase bearer path working and skips BA on a cookie-less request', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('job-seeker');
    expect(baAuth.api.getSession).not.toHaveBeenCalled();
  });

  // (c) A BA session whose user has no role row is a valid identity, not a
  // provisioned account.
  it('404s /auth/me and 403s an auth route when the BA user has no role row', async () => {
    const cookie = loginAsBA({ id: SEEKER, role: 'job-seeker' });
    on(/select role, profile from/, () => ({ rows: [], rowCount: 0 }));

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(404);
    expect(me.body.error.code).toBe('NOT_FOUND');

    const guarded = await request(app).get('/api/notifications/mine').set('Cookie', cookie);
    expect(guarded.status).toBe(403);
    expect(guarded.body.error).toEqual({ code: 'FORBIDDEN', message: 'Account not provisioned' });
  });

  // (d) Suspension wording must stay identical to the Supabase-era contract.
  it('403s a suspended BA account with the existing suspension message', async () => {
    const cookie = loginAsBA({ id: SEEKER, role: 'job-seeker', status: 'suspended' });

    const res = await request(app).get('/api/notifications/mine').set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('This account has been suspended or deactivated. Contact PESO.');
  });

  // (e) Decision 7: the super_admins row AND the BA user role must agree.
  it('403s Insufficient privileges when the BA role contradicts a super_admins row', async () => {
    const cookie = loginAsBA({ id: SEEKER, role: 'job-seeker' });
    on(/select role, profile from/, () => ({ rows: [{ role: 'super-admin', profile: { id: SEEKER, status: 'active' } }] }));

    const res = await request(app).get('/api/notifications/mine').set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: 'FORBIDDEN', message: 'Insufficient privileges' });
  });

  it('allows a super-admin when the BA role agrees with the row', async () => {
    const cookie = loginAsBA({ id: SEEKER, role: 'super-admin' });

    const res = await request(app).get('/api/notifications/mine').set('Cookie', cookie);

    expect(res.status).toBe(200);
  });

  // (f) Dual window: a BA outage must not invalidate a still-valid Supabase
  // bearer (both credentials present, BA throws).
  it('falls back to the Supabase bearer when the BA lookup throws', async () => {
    const cookie = loginAsBA({ id: OTHER, role: 'employer' });
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    baAuth.api.getSession.mockRejectedValue(new Error('BA down'));

    const res = await request(app).get('/api/auth/me')
      .set('Cookie', cookie)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('job-seeker');
    expect(baAuth.api.getSession).toHaveBeenCalledTimes(1);
  });
});
