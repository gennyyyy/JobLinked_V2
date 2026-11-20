import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db.js', async () => {
  const h = await import('./helpers/db.js');
  return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect };
});

import { on, reset, callsOf } from './helpers/db.js';
import { notifyMatchingSeekers } from '../routes/jobs.js';

beforeEach(() => reset());

// Capture the single fan-out insert (SQL + params) this function emits.
const capture = () => {
  let seen = null;
  on(/insert into notifications/, (params, sql) => { seen = { params, sql }; return { rows: [], rowCount: 0 }; });
  return () => {
    expect(seen).not.toBeNull();
    return seen;
  };
};

// Matching by structured skills overlap, same field, or preferred location —
// and the deliberate non-broadcast when none is set. (The duplicate-guard and
// daily-cap angles live in the existing suites.)
describe('notifyMatchingSeekers — who gets matched, not broadcast', () => {
  it('does nothing when the job has no skills, field, or location', async () => {
    await notifyMatchingSeekers({ id: 'job-0', title: 'Untitled', skills: [], field: null, location: '   ' });
    expect(callsOf(/insert into notifications/)).toHaveLength(0);
  });

  it('matches by case-insensitive skills overlap when only skills are set', async () => {
    const seen = capture();
    await notifyMatchingSeekers({ id: 'job-1', title: 'Cook', skills: ['Cooking', 'Food Safety'] });
    const { sql, params } = seen();
    // Seekers may still carry the lowercase profile form, so both sides lower().
    expect(sql).toContain('exists (select 1 from unnest(skills) sk where lower(sk) = any($1::text[]))');
    expect(sql).not.toContain('preferred_location');
    expect(sql).not.toContain('field =');
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('limit 100');
    expect(params[0]).toEqual(['cooking', 'food safety']);
  });

  it('matches a same-field seeker even with no skill overlap', async () => {
    const seen = capture();
    await notifyMatchingSeekers({ id: 'job-2', title: 'IT Support', field: 'Information Technology' });
    const { sql, params } = seen();
    expect(sql).not.toContain('unnest');
    expect(sql).toContain('field = $1');
    expect(sql).not.toContain('preferred_location');
    expect(params[0]).toBe('Information Technology');
  });

  it('matches by preferred_location when only a location is set', async () => {
    const seen = capture();
    await notifyMatchingSeekers({ id: 'job-3', title: 'Driver', skills: [], field: null, location: 'Cebu City' });
    const { sql, params } = seen();
    expect(sql).toContain('preferred_location ilike $1');
    expect(sql).not.toContain('unnest');
    expect(sql).not.toContain('field =');
    expect(params[0]).toBe('%Cebu City%');
  });

  it('ORs skills, field, and location, escaping LIKE metacharacters in the location', async () => {
    const seen = capture();
    await notifyMatchingSeekers({
      id: 'job-4', title: 'Dev', field: 'Information Technology', skills: ['React'], location: '100% WFH',
    });
    const { sql, params } = seen();
    expect(sql).toMatch(/lower\(sk\) = any\(\$1::text\[\]\)\) or field = \$2 or preferred_location ilike \$3/);
    expect(params[0]).toEqual(['react']);
    expect(params[1]).toBe('Information Technology');
    expect(params[2]).toBe('%100\\% WFH%');
    // Link is bound before title/message and shared with the dedupe guard.
    expect(params[3]).toBe('/job-seeker/jobs/job-4');
    expect(params[4]).toBe('New job for you');
  });

  it('filters blank skills instead of matching on them', async () => {
    const seen = capture();
    await notifyMatchingSeekers({ id: 'job-5', title: 'Cook', skills: ['', null, 'Cooking'], location: '' });
    expect(seen().params[0]).toEqual(['cooking']);
  });
});
