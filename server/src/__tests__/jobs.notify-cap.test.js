import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db.js', async () => {
  const h = await import('./helpers/db.js');
  return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect };
});

import { reset, callsOf, on } from './helpers/db.js';
import { notifyMatchingSeekers } from '../routes/jobs.js';

beforeEach(() => reset());

describe('notifyMatchingSeekers — daily cap', () => {
  const job = { id: 'job-1', title: 'Dev', location: 'Manila', tags: ['react'] };

  it('includes the daily cap subquery with date_trunc in the emitted SQL', async () => {
    on(/insert into notifications/, async () => ({ rows: [], rowCount: 0 }));
    await notifyMatchingSeekers(job);
    const inserts = callsOf(/insert into notifications/);
    expect(inserts).toHaveLength(1);
    const { sql } = inserts[0];
    // The daily cap subquery counts today's job notifications per seeker.
    expect(sql).toContain('date_trunc(\'day\', now())');
    // The 25 cap is interpolated as a literal number (safe, named constant).
    expect(sql).toMatch(/<\s*25/);
  });

  it('still includes the per-link dedupe guard alongside the cap', async () => {
    on(/insert into notifications/, async () => ({ rows: [], rowCount: 0 }));
    await notifyMatchingSeekers(job);
    const { sql } = callsOf(/insert into notifications/)[0];
    expect(sql).toContain('not exists');
    expect(sql).toContain('n.link =');
  });

  it('binds title, message, link in the correct order (link shared by select list and dedupe)', async () => {
    on(/insert into notifications/, async (params) => {
      // vals built in notifyMatchingSeekers:
      //   [0] tags (text[]), [1] location ilike, [2] link, [3] title, [4] message
      const linkIdx = params.indexOf(`/job-seeker/jobs/${job.id}`);
      const titleIdx = params.indexOf('New job for you');
      const messageIdx = params.findIndex((p) => typeof p === 'string' && p.includes('matches your profile'));
      expect(linkIdx).toBe(2);
      expect(titleIdx).toBe(3);
      expect(messageIdx).toBe(4);
      return { rows: [], rowCount: 0 };
    });
    await notifyMatchingSeekers(job);
  });
});
