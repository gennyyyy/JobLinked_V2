import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// ADR-056 decision 8 / Review Focus 5: with requireEmailVerification BA returns
// no session at sign-up and stores only name/email, so the registration form is
// parked in public.pending_signups against an existing UNVERIFIED auth."user"
// row. The pre-auth endpoint only writes that table (never auth.*, never a role
// row); provision merges the row, then claims and deletes it in the same
// transaction as the role insert. Real routers + the shared BA/db mock seam.
vi.mock('../db.js', async () => { const h = await import('../__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { auth: h.baAuth }; });

import { on, reset, callsOf } from '../__tests__/helpers/db.js';
import { loginAs, resetAuth } from '../__tests__/helpers/auth.js';
import { makeApp } from '../__tests__/helpers/app.js';
import { resetVocabularyCache } from '../vocabulary.js';

const SEEKER = '11111111-1111-4111-8111-111111111111';
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); resetVocabularyCache(); });

const pendingSignup = (body) => request(app).post('/api/auth/pending-signup').send(body);
const provision = (cookie, body = {}) => request(app).post('/api/auth/provision')
  .set('Cookie', cookie)
  .send(body);

const USER_LOOKUP = /from auth\."user"/;
const PENDING_UPSERT = /^insert into public\.pending_signups/;
// The auth."user" probe found an unverified row (the SQL itself pins the filter).
const unverifiedAccount = () => on(USER_LOOKUP, () => ({ rows: [{ id: SEEKER }], rowCount: 1 }));
const noAccount = () => on(USER_LOOKUP, () => ({ rows: [], rowCount: 0 }));

// Provision seam: a fresh session has no role row; a pending row is pre-read by
// its own aliased query; the transaction claim is a separate delete-returning.
const unprovisioned = () => on(/select role, profile from/, () => ({ rows: [], rowCount: 0 }));
const withPending = (row) => on(
  /^select p\.role, p\.profile from public\.pending_signups/,
  () => ({ rows: [row], rowCount: 1 }),
);
const pendingClaimed = () => on(/^delete from public\.pending_signups/, () => ({ rows: [{ user_id: SEEKER }], rowCount: 1 }));
const seekerInsert = () => on(
  (sql) => /insert into job_seekers/.test(sql) && /returning \*/.test(sql),
  (params) => ({
    rows: [{ id: params[0], email: params[1], first_name: params[2], last_name: params[4], full_name: params[6] }],
    rowCount: 1,
  }),
);
const employerInsert = () => on(
  (sql) => /insert into employers/.test(sql) && /returning \*/.test(sql),
  (params) => ({ rows: [{ id: params[0], company_name: params[8], full_name: params[6] }], rowCount: 1 }),
);
const withInvite = (row) => on(/^select \* from public\.admin_invites/, () => ({ rows: [row], rowCount: 1 }));
const inviteClaimed = () => on(/^delete from public\.admin_invites/, () => ({ rows: [{ user_id: SEEKER }], rowCount: 1 }));

describe('POST /api/auth/pending-signup', () => {
  it('stores the role and the profile fields for an unverified id+email match', async () => {
    unverifiedAccount();

    const res = await pendingSignup({
      userId: SEEKER,
      email: 'Ana@Example.com',
      role: 'job-seeker',
      first_name: 'Ana',
      last_name: 'Cruz',
      company_name: 'unknown keys survive harmlessly',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: true });
    // The probe is unverified-only and case-insensitive on email.
    const lookup = callsOf(USER_LOOKUP)[0];
    expect(lookup.sql).toMatch(/"emailVerified" = false/);
    expect(lookup.sql).toMatch(/lower\(email\) = lower\(\$2\)/);
    expect(lookup.params).toEqual([SEEKER, 'Ana@Example.com']);
    const upsert = callsOf(PENDING_UPSERT);
    expect(upsert).toHaveLength(1);
    expect(upsert[0].params).toEqual([SEEKER, 'job-seeker', {
      first_name: 'Ana',
      last_name: 'Cruz',
      company_name: 'unknown keys survive harmlessly',
    }]);
    // It never writes auth.* and never creates a role row or session.
    expect(callsOf(/^(insert|update|delete) /)).toHaveLength(1);
  });

  it('400 for a verified user (the probe excludes emailVerified = true)', async () => {
    noAccount();

    const res = await pendingSignup({ userId: SEEKER, email: 'ana@example.com', role: 'job-seeker' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(PENDING_UPSERT)).toHaveLength(0);
  });

  it('400 for an unknown id and for an email mismatch', async () => {
    noAccount();

    const res = await pendingSignup({ userId: SEEKER, email: 'someone@else.test', role: 'employer' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(PENDING_UPSERT)).toHaveLength(0);
  });

  it('400 for super-admin without touching the database', async () => {
    const res = await pendingSignup({ userId: SEEKER, email: 'ana@example.com', role: 'super-admin' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(USER_LOOKUP)).toHaveLength(0);
    expect(callsOf(PENDING_UPSERT)).toHaveLength(0);
  });

  it('400 for any custom_role_id, present or null', async () => {
    for (const custom_role_id of [7, null]) {
      const res = await pendingSignup({
        userId: SEEKER, email: 'ana@example.com', role: 'job-seeker', custom_role_id,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    }
    expect(callsOf(USER_LOOKUP)).toHaveLength(0);
  });

  it('400 for a malformed body (invalid uuid, missing email)', async () => {
    for (const body of [
      { userId: 'not-a-uuid', email: 'ana@example.com', role: 'job-seeker' },
      { email: 'ana@example.com', role: 'job-seeker' },
      { userId: SEEKER, role: 'job-seeker' },
      { userId: SEEKER, email: '', role: 'job-seeker' },
      {},
    ]) {
      const res = await pendingSignup(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    }
    expect(callsOf(USER_LOOKUP)).toHaveLength(0);
  });

  it('upserts by user_id, overwriting role and profile', async () => {
    unverifiedAccount();

    expect((await pendingSignup({ userId: SEEKER, email: 'ana@example.com', role: 'job-seeker', first_name: 'Ana' })).status).toBe(200);
    expect((await pendingSignup({ userId: SEEKER, email: 'ana@example.com', role: 'employer', first_name: 'Ben' })).status).toBe(200);

    const [first, second] = callsOf(PENDING_UPSERT);
    expect(first.params[2]).toEqual({ first_name: 'Ana' });
    expect(second.params[1]).toBe('employer');
    expect(second.params[2]).toEqual({ first_name: 'Ben' });
    expect(second.sql).toMatch(/on conflict \(user_id\) do update set role = excluded\.role, profile = excluded\.profile/);
  });
});

describe('provision claims the pending self-signup row', () => {
  // The whole point: BA's sign-up body is gone once the user verifies, so the
  // verified session sends {} and every field must come back from the row.
  it('merges the pending role and profile, then deletes the row in the transaction', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    withPending({
      role: 'job-seeker',
      profile: {
        first_name: 'Ana', middle_name: 'B', last_name: 'Cruz', suffix: 'Jr',
        phone: '09171234567', house_number_unit: '12A', street_address: 'Rizal St',
        subdivision_building: 'Sunrise', barangay_district: 'Poblacion',
        city_municipality: 'Cebu City', province_state: 'Cebu', postal_code: '6000',
        country: 'Philippines', birthdate: '1998-05-04', employment_status: 'Employed',
      },
    });
    pendingClaimed();
    seekerInsert();

    const res = await provision(cookie, {});

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('job-seeker');
    const params = callsOf(/insert into job_seekers/)[0].params;
    expect(params[1]).toBe(`${SEEKER}@test.local`);
    expect(params.slice(2, 8)).toEqual(['ana', 'b', 'cruz', 'jr', 'ana b cruz jr', '09171234567']);
    expect(params.slice(10, 20)).toEqual([
      'rizal st', '12a', 'sunrise', 'poblacion', 'cebu city', 'cebu', '6000',
      'philippines', '1998-05-04', 'Employed',
    ]);
    expect(params[22]).toBeNull(); // pending rows never carry a custom-role tag
    const claim = callsOf(/^delete from public\.pending_signups/);
    expect(claim).toHaveLength(1);
    expect(claim[0].via).toBe('tx');
    expect(claim[0].params).toEqual([SEEKER]);
    const ordered = callsOf(/^delete from public\.pending_signups|^insert into job_seekers/);
    expect(ordered.map((c) => c.via)).toEqual(['tx', 'tx']);
    expect(ordered[0].sql).toMatch(/^delete from public\.pending_signups/);
  });

  it('lets the body override the pending role and profile fields', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    withPending({
      role: 'job-seeker',
      profile: {
        first_name: 'Ana', middle_name: 'B', last_name: 'Cruz', suffix: 'Jr',
        barangay_district: 'Poblacion', city_municipality: 'Cebu City', country: 'Philippines',
      },
    });
    pendingClaimed();
    employerInsert();

    const res = await provision(cookie, {
      role: 'employer', first_name: 'Ben', company_name: 'Acme',
      phone: '440000000', representative_phone: '09171234567',
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('employer');
    expect(callsOf(/insert into job_seekers/)).toHaveLength(0);
    const insert = callsOf(/insert into employers/)[0];
    const params = insert.params;
    expect(params.slice(2, 7)).toEqual(['ben', 'b', 'cruz', 'jr', 'ben b cruz jr']);
    expect(params[8]).toBe('acme');
    expect(params.slice(14, 19)).toEqual(['poblacion', 'cebu city', null, null, 'philippines']);
    // The two numbers land in separate columns: phone stays $8, the new
    // representative_phone is appended last so earlier parameter indices hold.
    expect(params[7]).toBe('440000000');
    expect(insert.sql).toMatch(/representative_phone\)\s+values/);
    expect(params.at(-1)).toBe('09171234567');
    expect(callsOf(/^delete from public\.pending_signups/)[0].via).toBe('tx');
  });

  it('400 when there is no invite, no pending row, and no body role', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();

    const res = await provision(cookie, {});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/^delete from public\.pending_signups/)).toHaveLength(0);
    expect(callsOf(/insert into /)).toHaveLength(0);
  });

  it('an invite wins over a pending row and both rows are deleted', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    withInvite({ user_id: SEEKER, role: 'job-seeker', custom_role_id: null, profile: { first_name: 'Ana', last_name: 'Cruz' } });
    inviteClaimed();
    pendingClaimed();
    seekerInsert();

    const res = await provision(cookie, { role: 'employer', first_name: 'Ben' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('job-seeker');
    // The invite short-circuits the pre-read, so the pending profile cannot
    // contribute anything; the invitation's role is authoritative.
    expect(callsOf(/^select p\.role, p\.profile from public\.pending_signups/)).toHaveLength(0);
    const deletes = callsOf(/^delete from public\.(admin_invites|pending_signups)/);
    expect(deletes.map((c) => c.via)).toEqual(['tx', 'tx']);
    expect(deletes[0].sql).toMatch(/^delete from public\.admin_invites/);
    expect(deletes[1].sql).toMatch(/^delete from public\.pending_signups/);
    const ordered = callsOf(/^delete from public\.(admin_invites|pending_signups)|^insert into job_seekers/);
    expect(ordered).toHaveLength(3);
  });

  it('a second provision answers 200 and consumes nothing', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });

    const res = await provision(cookie, { role: 'job-seeker' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('job-seeker');
    expect(callsOf(/^delete from public\.pending_signups/)).toHaveLength(0);
    expect(callsOf(/insert into /)).toHaveLength(0);
  });

  // Same race as the invite: the pre-read row is gone by claim time, so the
  // loser inserts nothing and re-resolves the winner's row (200).
  it('a lost pending claim re-resolves and answers 200, never a second insert', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    let lookups = 0;
    on(/select role, profile from/, () => {
      lookups += 1;
      return {
        rows: lookups === 1 ? [] : [{ role: 'job-seeker', profile: { id: SEEKER, status: 'active' } }],
        rowCount: 1,
      };
    });
    withPending({ role: 'job-seeker', profile: { first_name: 'Ana' } });
    on(/^delete from public\.pending_signups/, () => ({ rows: [], rowCount: 0 }));

    const res = await provision(cookie);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(SEEKER);
    expect(callsOf(/insert into /)).toHaveLength(0);
  });

  it('a lost pending claim with no row appearing fails closed with 403', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    withPending({ role: 'job-seeker', profile: { first_name: 'Ana' } });
    on(/^delete from public\.pending_signups/, () => ({ rows: [], rowCount: 0 }));

    const res = await provision(cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(callsOf(/insert into /)).toHaveLength(0);
  });
});