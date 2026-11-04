import { describe, it, expect } from 'vitest';
import { rankPool, capReason } from './score.js';
import { normalize } from '../aiProvider.js';

// Minimal job row shape produced by the aiMatch route's SELECT.
const job = (overrides = {}) => ({
  id: 'job-1',
  title: 'Welder',
  description: 'Tig welding',
  tags: [],
  location: 'Poblacion',
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const reasonFor = (result, jobId) => result.reasons.find((r) => r.jobId === jobId)?.reason;

describe('rankPool', () => {
  it('skills-overlap dominates', () => {
    const profile = {
      skills: ['Welding', 'Fabrication', 'Blueprint'],
      barangay_district: 'Poblacion',
      preferred_position: 'Welder',
    };
    const jobs = [
      // Full skills overlap but old, different barangay, unrelated title.
      job({ id: 'skills', title: 'Factory Helper', tags: ['welding', 'fabrication', 'blueprint'], location: 'Mabini', created_at: '2026-01-01T00:00:00.000Z' }),
      // Everything except skills: newest, same barangay, title affinity.
      job({ id: 'signals', title: 'Senior Welder', tags: [], location: 'Poblacion', created_at: '2026-02-01T00:00:00.000Z' }),
    ];

    const result = rankPool(jobs, profile);

    expect(result.order).toEqual(['skills', 'signals']);
    expect(reasonFor(result, 'skills')).toBe('Skills match 3 of 3');
  });

  it('barangay tiebreak', () => {
    const profile = { skills: [], barangay_district: 'Poblacion' };
    const jobs = [
      job({ id: 'elsewhere', location: 'Mabini' }),
      job({ id: 'nearby', location: 'Poblacion' }),
    ];

    const result = rankPool(jobs, profile);

    expect(result.order).toEqual(['nearby', 'elsewhere']);
    expect(reasonFor(result, 'nearby')).toBe('Same barangay');
  });

  it('handles an empty profile with recency-only ordering', () => {
    const jobs = [
      job({ id: 'old', created_at: '2026-01-01T00:00:00.000Z' }),
      job({ id: 'new', created_at: '2026-03-01T00:00:00.000Z' }),
      job({ id: 'mid', created_at: '2026-02-01T00:00:00.000Z' }),
    ];

    const result = rankPool(jobs, {});

    expect(result.order).toEqual(['new', 'mid', 'old']);
    expect(result.reasons).toEqual([
      { jobId: 'new', reason: 'Ranked by posting date' },
      { jobId: 'mid', reason: 'Ranked by posting date' },
      { jobId: 'old', reason: 'Ranked by posting date' },
    ]);
  });

  it('reasons are capped at 200 normalized chars', () => {
    // A designed over-long reason: 400 non-space chars plus ragged whitespace.
    const designed = `  ${'x'.repeat(150)}\n\n\t${'y'.repeat(250)}  `;

    const reason = capReason(designed);

    expect(reason).toHaveLength(200);
    expect(reason).toBe(normalize(reason));
    expect(reason).not.toMatch(/\s{2,}/);
  });

  it('stability with ties', () => {
    const jobs = [
      job({ id: 'c' }),
      job({ id: 'a' }),
      job({ id: 'b' }),
    ];

    // Equal scores and timestamps -> id order, regardless of input order.
    expect(rankPool(jobs, {}).order).toEqual(['a', 'b', 'c']);
    expect(rankPool([jobs[2], jobs[0], jobs[1]], {}).order).toEqual(['a', 'b', 'c']);
  });

  it('builds explainable reasons with counts and matching', () => {
    const profile = { skills: ['welding', 'tig', 'blueprint'], barangay_district: 'Poblacion' };
    const jobs = [job({ id: 'j', tags: ['Welding', 'TIG'], location: 'Poblacion' })];

    expect(reasonFor(rankPool(jobs, profile), 'j')).toBe('Skills match 2 of 3 · Same barangay');
  });

  it('matches preferred position against title tokens', () => {
    const profile = { preferred_position: 'Senior Welder' };
    const jobs = [
      job({ id: 'cashier', title: 'Cashier' }),
      job({ id: 'welder', title: 'Senior Welder - Tig' }),
    ];

    const result = rankPool(jobs, profile);

    expect(result.order).toEqual(['welder', 'cashier']);
    expect(reasonFor(result, 'welder')).toBe('Title matches your preferred position');
  });

  it('counts duplicate profile skills once', () => {
    const profile = { skills: ['welding', 'Welding', 'tig'] };
    const jobs = [job({ id: 'j', tags: ['welding', 'tig'] })];

    expect(reasonFor(rankPool(jobs, profile), 'j')).toBe('Skills match 2 of 2');
  });

  it('caps reasons at 30 while ordering every job', () => {
    const jobs = Array.from({ length: 35 }, (_, i) => job({
      id: `job-${String(i).padStart(2, '0')}`,
      created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    }));

    const { order, reasons } = rankPool(jobs, {});

    expect(order).toHaveLength(35);
    expect(reasons).toHaveLength(30);
    expect(reasons.map((r) => r.jobId)).toEqual(order.slice(0, 30));
    for (const { reason } of reasons) {
      expect(reason).toBe(normalize(reason));
      expect(reason.length).toBeGreaterThan(0);
      expect(reason.length).toBeLessThanOrEqual(200);
    }
  });
});
