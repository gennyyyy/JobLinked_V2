import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { APIError } from 'better-auth/api';

// ADR-056 API surface: the change-email panel re-authenticates through our
// session route. BA's verifyPassword reads the session cookie and answers
// { status: true } or throws INVALID_PASSWORD; the route translates that to the
// app contract and never forwards a BA error body.
vi.mock('../db.js', async () => { const h = await import('../__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });
vi.mock('../ba.js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { auth: h.baAuth }; });

import { reset } from '../__tests__/helpers/db.js';
import { baAuth, loginAsBA, resetAuth } from '../__tests__/helpers/auth.js';
import { makeApp } from '../__tests__/helpers/app.js';

const SEEKER = '11111111-1111-4111-8111-111111111111';
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

const verify = (cookie, body) => request(app).post('/api/auth/verify-password')
  .set('Cookie', cookie)
  .send(body);

describe('POST /api/auth/verify-password', () => {
  it('401s without a session', async () => {
    const res = await request(app).post('/api/auth/verify-password').send({ password: 'pw123456!' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(baAuth.api.verifyPassword).not.toHaveBeenCalled();
  });

  it('answers { valid: true } through BA when the password matches', async () => {
    const cookie = loginAsBA({ id: SEEKER, role: 'job-seeker' });
    baAuth.api.verifyPassword.mockResolvedValue({ status: true });

    const res = await verify(cookie, { password: 'pw123456!' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true });
    expect(baAuth.api.verifyPassword).toHaveBeenCalledWith({
      body: { password: 'pw123456!' },
      headers: expect.anything(),
    });
    // The session cookie reached BA (its API reads headers, not req.body).
    expect(baAuth.api.verifyPassword.mock.calls[0][0].headers.get('cookie')).toContain('better-auth.session_token');
  });

  it('401 INVALID_PASSWORD for a wrong password, with no BA internals in the body', async () => {
    const cookie = loginAsBA({ id: SEEKER, role: 'job-seeker' });
    baAuth.api.verifyPassword.mockRejectedValue(
      APIError.from('BAD_REQUEST', { code: 'INVALID_PASSWORD', message: 'Invalid password' }),
    );

    const res = await verify(cookie, { password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
  });

  it('400s when the password is missing', async () => {
    const cookie = loginAsBA({ id: SEEKER, role: 'job-seeker' });

    const res = await verify(cookie, {});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(baAuth.api.verifyPassword).not.toHaveBeenCalled();
  });
});
