import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// Runtime: the skills filter must run in SQL (same where clause as the count)
// so `total` and the returned page agree — no post-pagination JS filtering.
const mocks = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => next(),
  optionalAuth: (req, _res, next) => next(),
  requireRole: () => (req, _res, next) => next(),
}));
const { default: jobRoutes } = await import('./jobs.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use('/api', jobRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  mocks.poolQuery.mockReset();
  mocks.poolQuery
    .mockResolvedValueOnce({ rows: [{ c: 2 }] })
    .mockResolvedValueOnce({ rows: [{ id: 'j1', company_id: 'c1', title: 'Welder needed', tags: ['manila'] }] });
});

const get = (qs) => fetch(`${base}/jobs${qs}`);

describe('GET /jobs skills filter', () => {
  it('filters in SQL for both the count and the list, response shape unchanged', async () => {
    const r = await get('?skills=Welder,Manila');
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ total: 2, page: 1, pageSize: 10 });
    expect(mocks.poolQuery.mock.calls).toHaveLength(2);
    for (const [sql, params] of mocks.poolQuery.mock.calls) {
      expect(sql).toContain('ilike any');
      expect(params).toContainEqual(['%welder%', '%manila%']);
    }
    const [countSql, listSql] = mocks.poolQuery.mock.calls.map((c) => c[0]);
    // Same predicate on both sides — the pager cannot disagree with the cards.
    expect(countSql).toContain('j.title');
    expect(countSql).toContain('array_to_string(j.tags');
    expect(listSql).toContain('ilike any');
  });

  it('escapes LIKE wildcards in skill terms (JS matched them literally)', async () => {
    const r = await get('?skills=ci_cd');
    expect(r.status).toBe(200);
    expect(mocks.poolQuery.mock.calls[0][1][1]).toEqual(['%ci\\_cd%']);
  });

  it('adds no skills predicate when the param is absent or blank', async () => {
    await get('');
    await get('?skills=%20');
    for (const [sql] of mocks.poolQuery.mock.calls) {
      expect(sql).not.toContain('ilike any');
    }
  });
});
