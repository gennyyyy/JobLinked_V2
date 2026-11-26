import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// ADR-056 decision 7 / Review Focus 6: public.admin_invites is the server-only
// grant. Provision takes the role and the custom-role tag from that row (never
// the body), consumes the row in the same transaction as the role insert, and
// /auth/me derives aal from the BA two-factor flag. Real routers + the shared
// BA/db mock seam.
vi.mock('../db.js', async () => { const h = await import('../__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { auth: h.baAuth }; });

import { on, reset, callsOf } from '../__tests__/helpers/db.js';
import { loginAs, resetAuth } from '../__tests__/helpers/auth.js';
import { makeApp } from '../__tests__/helpers/app.js';
import { resetVocabularyCache } from '../vocabulary.js';

const SEEKER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '44444444-4444-4444-8444-444444444444';
const app = makeApp();
beforeEach(() => { reset(); resetAuth(); resetVocabularyCache(); });

const inviteRow = (over = {}) => ({
  user_id: SEEKER,
  role: 'job-seeker',
  custom_role_id: null,
  profile: {
    first_name: 'Ana', middle_name: '', last_name: 'Cruz', suffix: '',
    phone: '0917', company_name: '',
  },
  ...over,
});

// A freshly invited account has no role row; loginAs always seeds one.
const unprovisioned = () => on(/select role, profile from/, () => ({ rows: [], rowCount: 0 }));
const withInvite = (row) => on(/^select \* from public\.admin_invites/, () => ({ rows: [row], rowCount: 1 }));
const inviteClaimed = () => on(/^delete from public\.admin_invites/, () => ({ rows: [{ user_id: SEEKER }], rowCount: 1 }));
const seekerInsert = () => on(
  (sql) => /insert into job_seekers/.test(sql) && /returning \*/.test(sql),
  (params) => ({
    rows: [{
      id: params[0], email: params[1], first_name: params[2], last_name: params[4],
      full_name: params[6], custom_role_id: params[22],
    }],
    rowCount: 1,
  }),
);

const provision = (cookie, body = {}) => request(app).post('/api/auth/provision')
  .set('Cookie', cookie)
  .send(body);

describe('provision on better-auth: the admin_invites grant wins', () => {
  // Review Focus 6: a client sending role/custom_role_id must not change its
  // role. The invite row is the only source; the body is ordinary profile only.
  it('creates the INVITE role and profile when the body asks for super-admin', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    withInvite(inviteRow());
    inviteClaimed();
    seekerInsert();

    const res = await provision(cookie, { role: 'super-admin', custom_role_id: 9 });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('job-seeker');
    expect(callsOf(/^insert into super_admins/)).toHaveLength(0);
    const insert = callsOf(/insert into job_seekers/)[0];
    expect(insert.params[2]).toBe('ana');
    expect(insert.params[4]).toBe('cruz');
    expect(insert.params[6]).toBe('ana cruz');
    // The body tag was ignored: the invite's null means "no custom role".
    expect(insert.params[23]).toBeNull();
    expect(callsOf(/category = 'custom_role'/)).toHaveLength(0);
  });

  it('claims and deletes the invite in the same transaction as the insert', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    withInvite(inviteRow());
    inviteClaimed();
    seekerInsert();

    expect((await provision(cookie)).status).toBe(201);

    const claim = callsOf(/^delete from public\.admin_invites/);
    expect(claim).toHaveLength(1);
    expect(claim[0].via).toBe('tx');
    expect(claim[0].params).toEqual([SEEKER]);
    // Claim first, then the role insert, both on the transaction connection.
    const ordered = callsOf(/^delete from public\.admin_invites|^insert into job_seekers/);
    expect(ordered.map((c) => c.via)).toEqual(['tx', 'tx']);
    expect(ordered[0].sql).toMatch(/^delete from public\.admin_invites/);
    expect(ordered[1].sql).toMatch(/^insert into job_seekers/);
  });

  it('resolves a non-null invite custom_role_id inside the transaction', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    withInvite(inviteRow({ custom_role_id: 7 }));
    on(/category = 'custom_role'/, () => ({ rows: [{ id: 7 }], rowCount: 1 }));
    inviteClaimed();
    seekerInsert();

    const res = await provision(cookie);

    expect(res.status).toBe(201);
    expect(callsOf(/insert into job_seekers/)[0].params[23]).toBe(7);
    const ordered = callsOf(/category = 'custom_role'|^delete from public\.admin_invites/);
    expect(ordered).toHaveLength(2);
    expect(ordered[0].sql).toMatch(/category = 'custom_role'/);
    expect(ordered[0].via).toBe('tx');
    expect(ordered[1].sql).toMatch(/^delete from public\.admin_invites/);
  });

  it('403 INVITE_INCOMPLETE for an invite tag that no longer resolves, without burning the invite', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    withInvite(inviteRow({ custom_role_id: 999 }));
    on(/category = 'custom_role'/, () => ({ rows: [], rowCount: 0 }));

    const res = await provision(cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVITE_INCOMPLETE');
    expect(callsOf(/^delete from public\.admin_invites/)).toHaveLength(0);
    expect(callsOf(/insert into /)).toHaveLength(0);
  });

  it('super-admin invite: 201 when the provider role agrees', async () => {
    const cookie = loginAs({ id: ADMIN, role: 'super-admin' });
    unprovisioned();
    withInvite(inviteRow({ role: 'super-admin', profile: { first_name: 'Cid', last_name: 'Reyes' } }));
    inviteClaimed();
    on(/^insert into super_admins/, (params) => ({
      rows: [{ id: params[0], full_name: params[6], custom_role_id: params[7] }], rowCount: 1,
    }));

    const res = await provision(cookie);

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('super-admin');
    expect(callsOf(/insert into super_admins/)[0].params[7]).toBeNull();
  });

  it('super-admin invite: 403 when the provider role disagrees', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    withInvite(inviteRow({ role: 'super-admin' }));

    const res = await provision(cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(callsOf(/^delete from public\.admin_invites/)).toHaveLength(0);
    expect(callsOf(/insert into super_admins/)).toHaveLength(0);
  });

  it('no invite row + super-admin body role -> 403, no write', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });

    const res = await provision(cookie, { role: 'super-admin' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(callsOf(/insert into /)).toHaveLength(0);
  });

  // Replay: the invite is gone and the role row exists — the documented 200,
  // and nothing is inserted or deleted again.
  it('replay answers 200 with the existing row and performs no second insert', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });

    const res = await provision(cookie, { role: 'job-seeker' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('job-seeker');
    expect(callsOf(/^delete from public\.admin_invites/)).toHaveLength(0);
    expect(callsOf(/insert into /)).toHaveLength(0);
  });

  // Two concurrent provisions: the loser's claim returns no row, so it must not
  // insert — it re-resolves the winner's row and answers the documented 200.
  it('a lost claim re-resolves and answers 200, never a second insert', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    let lookups = 0;
    on(/select role, profile from/, () => {
      lookups += 1;
      return {
        rows: lookups === 1 ? [] : [{ role: 'job-seeker', profile: { id: SEEKER, status: 'active' } }],
        rowCount: 1,
      };
    });
    withInvite(inviteRow());
    on(/^delete from public\.admin_invites/, () => ({ rows: [], rowCount: 0 }));

    const res = await provision(cookie);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(SEEKER);
    expect(callsOf(/insert into /)).toHaveLength(0);
  });

  it('a lost claim with no row appearing fails closed with 403', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    withInvite(inviteRow());
    on(/^delete from public\.admin_invites/, () => ({ rows: [], rowCount: 0 }));

    const res = await provision(cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(callsOf(/insert into /)).toHaveLength(0);
  });

  it('self-signup on a BA session (no invite) keeps the body role and a null tag', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    seekerInsert();

    const res = await provision(cookie, { role: 'job-seeker', terms_accepted: true, first_name: 'Ana', last_name: 'Cruz' });

    expect(res.status).toBe(201);
    expect(callsOf(/insert into job_seekers/)[0].params[23]).toBeNull();
    expect(callsOf(/^delete from public\.admin_invites/)).toHaveLength(0);
  });

  // ADR-059: staff consent is an HR/onboarding act — an invite needs no
  // checkbox, and no consent is stamped on the row.
  it('an admin invite provisions without terms_accepted and stamps no consent', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    unprovisioned();
    withInvite(inviteRow());
    inviteClaimed();
    seekerInsert();

    const res = await provision(cookie);

    expect(res.status).toBe(201);
    const insert = callsOf(/insert into job_seekers/)[0];
    expect(insert.params[24]).toBe(false); // not a self-signup
    expect(insert.params[25]).toBeNull(); // no consent recorded
    expect(callsOf(/from public\.legal_documents/)).toHaveLength(0);
  });
});

// The carry (resolveSession -> tokenAuth -> route): /auth/me must not re-query
// BA for aal, and must never decode a JWT for a BA session.
describe('/auth/me aal on a BA session', () => {
  it('aal2 when the BA user has a two-factor factor', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker', twoFactorEnabled: true });

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.aal).toBe('aal2');
  });

  it('aal1 without a factor, even with a JWT-shaped Authorization header', async () => {
    const cookie = loginAs({ id: SEEKER, role: 'job-seeker' });
    const payload = Buffer.from(JSON.stringify({ aal: 'aal2' })).toString('base64url');

    const res = await request(app).get('/api/auth/me')
      .set('Cookie', cookie)
      .set('Authorization', `Bearer x.${payload}.sig`);

    expect(res.status).toBe(200);
    expect(res.body.aal).toBe('aal1');
  });
});