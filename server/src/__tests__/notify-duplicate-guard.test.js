import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });

import { reset, callsOf, on } from './helpers/db.js';
import { notifyMatchingSeekers } from '../routes/jobs.js';

beforeEach(() => reset());

describe('notifyMatchingSeekers — duplicate guard', () => {
  const job = { id: 'job-1', title: 'Dev', location: 'Manila', tags: ['react'] };

  it('emits SQL that guards against duplicate notifications for the same seeker+link', async () => {
    // No matching seekers — the insert runs but inserts zero rows.
    on(/insert into notifications/, async () => ({ rows: [], rowCount: 0 }));
    await notifyMatchingSeekers(job);
    await notifyMatchingSeekers(job);
    const inserts = callsOf(/insert into notifications/);
    // One insert per call — never more, never fewer.
    expect(inserts).toHaveLength(2);
    // The dedup subquery is the whole point of this fix — assert the SQL
    // literally contains it, so no future rewrite silently removes it.
    for (const { sql } of inserts) {
      expect(sql).toContain('not exists');
      expect(sql).toContain('n.link =');
    }
  });

  it('skips the insert entirely when neither tags nor location are set', async () => {
    await notifyMatchingSeekers({ id: 'job-2', title: 'No Match' });
    expect(callsOf(/insert into notifications/)).toHaveLength(0);
  });

  it('uses the same bind index for the inserted link and the dedup guard', async () => {
    on(/insert into notifications/, async (params, sql) => {
      // The link param must be bound once and referenced twice in the SQL —
      // find its index and verify both references resolve to the same slot.
      const matches = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
      const linkIdx = params.indexOf(`/job-seeker/jobs/${job.id}`);
      // params is 0-indexed, SQL params are 1-indexed.
      const linkSlot = linkIdx + 1;
      // link slot appears exactly twice: once in the select list, once in
      // the exists subquery.
      expect(matches.filter((n) => n === linkSlot)).toHaveLength(2);
      return { rows: [], rowCount: 0 };
    });
    await notifyMatchingSeekers(job);
  });
});
