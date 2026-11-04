import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => {
  const h = await import('./helpers/db.js');
  return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect };
});
vi.mock('@supabase/supabase-js', async () => {
  const h = await import('./helpers/auth.js');
  return { createClient: () => ({ auth: h.supabaseAuth }) };
});

process.env.SUPABASE_URL ||= 'http://127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.RETENTION_DISABLE ||= '1';
// A proxy hop so supertest can give each scenario its own limiter bucket via
// X-Forwarded-For instead of sharing the ::ffff:127.0.0.1 store key. Scoped to
// this file so no other suite inherits it.
beforeAll(() => { process.env.TRUST_PROXY = '1'; });
afterAll(() => { delete process.env.TRUST_PROXY; });

const { on, reset, seedRoleTable, callsOf, query } = await import('./helpers/db.js');
const { loginAs, resetAuth } = await import('./helpers/auth.js');
const { makeApp, makeHardenedApp } = await import('./helpers/app.js');

const ADMIN = '77777777-7777-4777-8777-777777777777';
const U = '88888888-8888-4888-8888-888888888888';

describe('resilience regressions (live 2026-11-05)', () => {
  beforeEach(() => { reset(); resetAuth(); });

  // A suspended current row + the stale `inactive` row a role move leaves in a
  // higher-precedence table. Before the fix, reinstating updated `employers`
  // and answered 200 while the real `job_seekers` row stayed suspended.
  it('reactivating a suspended account updates the CURRENT row, not the stale one', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    seedRoleTable(U, 'job_seekers', { id: U, status: 'suspended', full_name: 'Real Seeker' });
    seedRoleTable(U, 'employers', { id: U, status: 'inactive', full_name: 'Real Seeker' });
    on(/information_schema\.columns/, () => ({ rows: [{ column_name: 'status' }, { column_name: 'updated_at' }] }));
    on(/^update (job_seekers|employers) set status = \$2/, (params, sql) => ({
      rows: [{ id: U, status: params[1] }], rowCount: 1,
      // the sql is asserted below; returning the row keeps the handler happy
      table: sql.match(/^update (\w+)/)[1],
    }));

    const res = await request(makeApp())
      .patch(`/api/admin/users/${U}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(callsOf(/^update job_seekers set status/)).toHaveLength(1);
    expect(callsOf(/^update employers set status/)).toHaveLength(0);
  });

  it("rejects 'inactive' as an admin-selectable status (it is the stale marker)", async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(makeApp())
      .patch(`/api/admin/users/${U}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    // Nothing was even looked up, let alone written.
    expect(callsOf(/^update /)).toHaveLength(0);
  });

  // Pool exhaustion is backpressure: 503 + Retry-After, never a 500 that reads
  // as an application bug. pg's pool-connect timeout carries no SQLSTATE.
  it('answers 503 + Retry-After when the pool connect times out', async () => {
    query.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'));
    const res = await request(makeHardenedApp())
      .get('/api/jobs')
      .set('X-Forwarded-For', '10.1.1.1');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.headers['retry-after']).toBe('5');
  });

  // The body parser must run after the throttles: once an IP is over its auth
  // budget, an oversized body still gets 429 (throttled) instead of forcing a
  // 1 MB parse before answering 400/413.
  it('throttles before the route/body work runs', async () => {
    const app = makeHardenedApp();
    const ip = '10.1.1.2';
    for (let i = 0; i < 100; i += 1) {
      const r = await request(app).get('/api/auth/me').set('X-Forwarded-For', ip);
      expect(r.status).toBe(401);
    }
    // Over budget: the limiter answers before the route (and before the body
    // parser); a 1 MB body is not consumed at all, so a live client may see a
    // reset — the ordering itself is proven by the benchmark in
    // docs/arch/testing/2026-11-05-campaign.md.
    const over = await request(app)
      .post('/api/auth/me')
      .set('X-Forwarded-For', ip)
      .send({ pad: 'x' });
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe('RATE_LIMITED');
  }, 30000);
});
