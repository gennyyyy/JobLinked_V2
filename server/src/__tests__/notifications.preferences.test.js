import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('./helpers/auth.js'); return { auth: h.baAuth }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';
import { notifyUser, notifyAdmins } from '../util.js';

const app = makeApp();

function stubPref(row) {
  on((sql) => /from public\.user_preferences where user_id/.test(sql), () => ({ rows: row ? [row] : [], rowCount: row ? 1 : 0 }));
}
function stubInsert() {
  on(/insert into notifications/, () => ({ rows: [], rowCount: 1 }));
}

describe('notifyUser preference gating', () => {
  beforeEach(() => reset());

  for (const type of ['application', 'document', 'accreditation', 'job']) {
    it(`suppresses ${type} when application_updates is false`, async () => {
      stubPref({ application_updates: false, community_announcements: true });
      stubInsert();
      await notifyUser('u1', { type, title: 't', message: 'm' });
      expect(callsOf(/insert into notifications/)).toHaveLength(0);
    });
  }

  it('delivers when application_updates is true', async () => {
    stubPref({ application_updates: true, community_announcements: true });
    stubInsert();
    await notifyUser('u1', { type: 'application', title: 't', message: 'm' });
    expect(callsOf(/insert into notifications/)).toHaveLength(1);
  });

  it('delivers when no preference row exists', async () => {
    stubPref(null);
    stubInsert();
    await notifyUser('u1', { type: 'application', title: 't', message: 'm' });
    expect(callsOf(/insert into notifications/)).toHaveLength(1);
  });

  it('delivers unknown types regardless of preferences', async () => {
    stubPref({ application_updates: false, community_announcements: false });
    stubInsert();
    await notifyUser('u1', { type: 'foo', title: 't', message: 'm' });
    expect(callsOf(/insert into notifications/)).toHaveLength(1);
  });

  it('suppresses system when community_announcements is false', async () => {
    stubPref({ application_updates: true, community_announcements: false });
    stubInsert();
    await notifyUser('u1', { type: 'system', title: 't', message: 'm' });
    expect(callsOf(/insert into notifications/)).toHaveLength(0);
  });
});

describe('notifyAdmins is ungated', () => {
  beforeEach(() => reset());
  it('inserts for all admins regardless of preferences', async () => {
    on(/select id from super_admins/, () => ({ rows: [{ id: 'a1' }, { id: 'a2' }], rowCount: 2 }));
    stubInsert();
    await notifyAdmins({ type: 'system', title: 't', message: 'm' });
    expect(callsOf(/insert into notifications/)).toHaveLength(1);
  });
});

describe('broadcast excludes opted-out users', () => {
  beforeEach(() => { reset(); resetAuth(); });
  it('query contains the coalesce predicate', async () => {
    const token = loginAs({ id: 'admin-1', role: 'super-admin' });
    on(/insert into notifications/, () => ({ rows: [], rowCount: 2 }));
    const res = await request(app).post('/api/admin/system-notifications')
      .set('Cookie', token).send({ title: 'Hi', message: 'Msg' });
    expect(res.status).toBe(200);
    const inserts = callsOf(/insert into notifications/);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sql).toContain('left join public.user_preferences p on p.user_id = u.id');
    expect(inserts[0].sql).toContain('where coalesce(p.community_announcements, true)');
  });
});
