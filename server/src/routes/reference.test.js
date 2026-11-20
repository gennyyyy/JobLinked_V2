import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));

const { default: referenceRoutes } = await import('./reference.js');

// Seeded rows, including the custom_role bundle that must never be served.
// The mock answers the real query's WHERE/ORDER BY so the endpoint is under
// test, not a hardcoded array in the handler.
const CATALOGUE = [
  { category: 'job_field', value: 'Sales & Retail', sort_order: 2 },
  { category: 'job_field', value: 'Administrative & Office', sort_order: 1 },
  { category: 'skill', value: 'MS Excel', sort_order: 4 },
  { category: 'skill', value: 'Cashiering', sort_order: 2 },
  { category: 'custom_role', value: 'Secret Role', sort_order: 1 },
];

const app = express();
app.use('/api', referenceRoutes);
// eslint-disable-next-line no-unused-vars
app.use((e, _req, res, _next) => res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } }));

beforeEach(() => {
  mocks.poolQuery.mockReset().mockImplementation(async (_sql, params) => {
    const rows = CATALOGUE
      .filter((r) => r.category === params[0])
      .sort((a, b) => a.sort_order - b.sort_order || a.value.localeCompare(b.value))
      .map(({ value }) => ({ value }));
    return { rows };
  });
});

describe('GET /reference/:category', () => {
  it('serves an allowlisted vocabulary in sort_order without auth', async () => {
    const r = await request(app).get('/api/reference/skill');

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ values: ['Cashiering', 'MS Excel'] });
    const [sql, params] = mocks.poolQuery.mock.calls[0];
    expect(sql).toBe('select value from reference_data where category = $1 order by sort_order, value');
    expect(params).toEqual(['skill']);
  });

  it('serves job_field with the same contract', async () => {
    const r = await request(app).get('/api/reference/job_field');

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ values: ['Administrative & Office', 'Sales & Retail'] });
  });

  it('rejects custom_role with 400 UNKNOWN_CATEGORY and never reads it', async () => {
    const r = await request(app).get('/api/reference/custom_role');

    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: { code: 'UNKNOWN_CATEGORY', message: 'Unknown reference category' } });
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('rejects an unknown category with 400 UNKNOWN_CATEGORY', async () => {
    const r = await request(app).get('/api/reference/nope');

    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('UNKNOWN_CATEGORY');
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('rejects an empty category with 400 UNKNOWN_CATEGORY', async () => {
    const empty = await request(app).get('/api/reference/');
    const blank = await request(app).get('/api/reference/%20');

    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('UNKNOWN_CATEGORY');
    expect(blank.status).toBe(400);
    expect(blank.body.error.code).toBe('UNKNOWN_CATEGORY');
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('answers 500 when the vocabulary cannot be read', async () => {
    mocks.poolQuery.mockRejectedValueOnce(new Error('database unavailable'));

    const r = await request(app).get('/api/reference/skill');

    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  });
});
