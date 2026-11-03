import { readFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// Contract test: DELETE /api/notifications/:id deletes only the caller's own
// row (user_id from token, never params). Reads source text so no DB/auth
// env is needed.
const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const adminSrc = srv('src/routes/admin.js');

const delStart = adminSrc.indexOf("router.delete('/notifications/:id'");
const delNext = adminSrc.indexOf('router.', delStart + 1);
const del = adminSrc.slice(delStart, delNext === -1 ? undefined : delNext);

describe('notifications delete', () => {
  it('deletes the own notification and returns { deleted: true }', () => {
    expect(delStart).toBeGreaterThan(-1);
    expect(del).toContain('delete from notifications where id = $1 and user_id = $2');
    expect(del).toContain('[req.params.id, req.user.id]');
    expect(del).toContain('res.json({ deleted: true })');
  });

  it("returns 404 NOT_FOUND when the id belongs to another user (rowCount 0)", () => {
    expect(del).toContain('rowCount');
    expect(del).toContain("err(res, 404, 'NOT_FOUND', 'Notification not found')");
  });

  it('rejects a non-numeric id with 400 BAD_REQUEST', () => {
    expect(del).toContain("err(res, 400, 'BAD_REQUEST'");
    expect(del).toMatch(/\/\^\\d\+\$\/|\^\[0-9\]/);
  });
});

// Runtime tests with mocked pool + auth (no DB/supabase env needed).
const mocks = vi.hoisted(() => ({ poolQuery: vi.fn(), authed: true }));

vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, res, next) => {
    if (!mocks.authed) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing access token' } });
    req.user = { id: 'user-1', email: 'u@example.com', role: 'job-seeker' };
    next();
  },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: () => (_req, _res, next) => next(),
}));

process.env.RETENTION_DISABLE = '1';
const { default: adminRoutes } = await import('./admin.js');

let base;
let server;
beforeAll(async () => {
  const app = express();
  app.use('/api', adminRoutes);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => { mocks.authed = true; mocks.poolQuery.mockReset(); });

describe('notifications delete runtime', () => {
  it('200 { deleted: true } on own row, scoped by user_id from token', async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rowCount: 1 });
    const r = await fetch(`${base}/notifications/123`, { method: 'DELETE' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ deleted: true });
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      'delete from notifications where id = $1 and user_id = $2', ['123', 'user-1']);
  });

  it('404 NOT_FOUND when the id belongs to another user (rowCount 0)', async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rowCount: 0 });
    const r = await fetch(`${base}/notifications/999`, { method: 'DELETE' });
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe('NOT_FOUND');
  });

  it('400 BAD_REQUEST on non-numeric id without touching the db', async () => {
    const r = await fetch(`${base}/notifications/abc`, { method: 'DELETE' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('BAD_REQUEST');
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('401 when unauthenticated', async () => {
    mocks.authed = false;
    const r = await fetch(`${base}/notifications/123`, { method: 'DELETE' });
    expect(r.status).toBe(401);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });
});
