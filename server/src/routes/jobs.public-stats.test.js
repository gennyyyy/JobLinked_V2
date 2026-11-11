import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => res.status(500).json({ error: { message: error.message } }));
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => mocks.poolQuery.mockReset());

describe('GET /public/stats', () => {
  it('returns current public counts without caching', async () => {
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ open_jobs: 12, employers: 6, job_seekers: 25, barangays_covered: 8 }],
    });

    const response = await fetch(`${base}/public/stats`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ openJobs: 12, employers: 6, jobSeekers: 25, barangaysCovered: 8 });
    const [query] = mocks.poolQuery.mock.calls[0];
    expect(query).toContain("status = 'published'");
    expect(query).toContain("deadline is null or deadline >= current_date");
    expect(query).toContain("where status = 'active'");
    expect(query).toContain('from job_seekers');
    expect(query).toContain('count(distinct lower(btrim(location)))');
  });

  it('returns a server error when the counts cannot be loaded', async () => {
    mocks.poolQuery.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await fetch(`${base}/public/stats`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { message: 'database unavailable' } });
  });
});
