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

// Phase 2 (docs/plan/2026-11-04-05-testing-plan.md): matching by skills /
// preferred location — and the deliberate non-broadcast when neither is set.
// (The duplicate-guard and daily-cap angles live in the existing suites.)
describe('notifyMatchingSeekers — who gets matched, not broadcast', () => {
  it('does nothing when the job has neither tags nor a location', async () => {
    await notifyMatchingSeekers({ id: 'job-0', title: 'Untitled', tags: [], location: '   ' });
    expect(callsOf(/insert into notifications/)).toHaveLength(0);
  });

  it('matches by skills overlap when only tags are set', async () => {
    const seen = capture();
    await notifyMatchingSeekers({ id: 'job-1', title: 'Cook', tags: ['Cooking', 'Food Safety'] });
    const { sql, params } = seen();
    expect(sql).toContain('skills && $1::text[]');
    expect(sql).not.toContain('preferred_location');
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('limit 100');
    expect(params[0]).toEqual(['Cooking', 'Food Safety']);
  });

  it('matches by preferred_location when only a location is set', async () => {
    const seen = capture();
    await notifyMatchingSeekers({ id: 'job-2', title: 'Driver', tags: [], location: 'Cebu City' });
    const { sql, params } = seen();
    expect(sql).toContain('preferred_location ilike $1');
    expect(sql).not.toContain('skills &&');
    expect(params[0]).toBe('%Cebu City%');
  });

  it('ORs skills and location, escaping LIKE metacharacters in the location', async () => {
    const seen = capture();
    await notifyMatchingSeekers({ id: 'job-3', title: 'Dev', tags: ['react'], location: '100% WFH' });
    const { sql, params } = seen();
    expect(sql).toMatch(/skills && \$1::text\[\] or preferred_location ilike \$2/);
    expect(params[0]).toEqual(['react']);
    expect(params[1]).toBe('%100\\% WFH%');
    // Link is bound before title/message and shared with the dedupe guard.
    expect(params[2]).toBe('/job-seeker/jobs/job-3');
    expect(params[3]).toBe('New job for you');
  });

  it('filters blank tags instead of matching on them', async () => {
    const seen = capture();
    await notifyMatchingSeekers({ id: 'job-4', title: 'Cook', tags: ['', null, 'Cooking'], location: '' });
    expect(seen().params[0]).toEqual(['Cooking']);
  });
});
