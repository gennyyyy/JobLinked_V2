import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const OWNER = '22222222-2222-2222-2222-222222222222';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

// Notification routes live in admin.js but are user-scoped (auth, not admin).
describe('notifications are user-scoped (auth, not admin-only)', () => {
  it('GET /api/notifications/mine returns only the caller rows', async () => {
    const token = loginAs({ id: OWNER, role: 'employer' });
    on((sql) => /from notifications where user_id/.test(sql), () => ({ rows: [{ id: 1, title: 'hi', is_read: false }] }));
    const res = await request(app).get('/api/notifications/mine').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(callsOf(/from notifications where user_id/)[0].params).toEqual([OWNER]);
  });

  it('GET /api/notifications/mine?unreadOnly=true filters to unread', async () => {
    const token = loginAs({ id: OWNER, role: 'employer' });
    on((sql) => /from notifications where user_id/.test(sql), () => ({ rows: [] }));
    const res = await request(app).get('/api/notifications/mine?unreadOnly=true').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(callsOf(/from notifications where user_id/)[0].sql).toContain('is_read = $2');
  });

  it('POST /api/notifications/:id/read scopes by the token user_id', async () => {
    const token = loginAs({ id: OWNER, role: 'employer' });
    on(/update notifications set is_read = true where id = \$1 and user_id = \$2 returning id/, () => ({ rows: [{ id: 5 }] }));
    const res = await request(app).post('/api/notifications/5/read').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ read: true });
    expect(callsOf(/update notifications set is_read = true where id = \$1 and user_id = \$2 returning id/)[0].params).toEqual(['5', OWNER]);
  });

  it('POST /api/notifications/:id/read → 404 for another user\'s row (matches DELETE, Addendum C)', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    on(/update notifications set is_read = true/, () => ({ rows: [] }));
    const res = await request(app).post('/api/notifications/5/read').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/notifications/:id/read → 400 on a non-numeric id, no db write', async () => {
    const token = loginAs({ id: OWNER, role: 'employer' });
    const res = await request(app).post('/api/notifications/abc/read').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(callsOf(/update notifications set is_read/)).toHaveLength(0);
  });

  it('POST /api/notifications/read-all marks the caller unread as read', async () => {
    const token = loginAs({ id: OWNER, role: 'employer' });
    const res = await request(app).post('/api/notifications/read-all').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(callsOf(/update notifications set is_read = true where user_id = \$1 and is_read = false/)[0].params).toEqual([OWNER]);
  });

  it('DELETE /api/notifications/:id deletes the caller row', async () => {
    const token = loginAs({ id: OWNER, role: 'employer' });
    on((sql) => /delete from notifications where id = \$1 and user_id = \$2/.test(sql), () => ({ rowCount: 1 }));
    const res = await request(app).delete('/api/notifications/5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(callsOf(/delete from notifications where id = \$1 and user_id = \$2/)[0].params).toEqual(['5', OWNER]);
  });

  it('DELETE /api/notifications/:id → 404 when the row belongs to another user', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    on((sql) => /delete from notifications/.test(sql), () => ({ rowCount: 0 }));
    const res = await request(app).delete('/api/notifications/9').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE /api/notifications/:id → 400 on a non-numeric id, no db write', async () => {
    const token = loginAs({ id: OWNER, role: 'employer' });
    const res = await request(app).delete('/api/notifications/abc').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/delete from notifications/)).toHaveLength(0);
  });

  it('401 UNAUTHORIZED without a token', async () => {
    const res = await request(app).get('/api/notifications/mine');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
