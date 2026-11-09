import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db.js', async () => {
  const h = await import('./helpers/db.js');
  return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect };
});

import { on, reset, callsOf } from './helpers/db.js';

// admin.js starts a 24h retention timer at import; skip it in tests.
process.env.RETENTION_DISABLE = '1';
const { runRetentionPurge } = await import('../routes/admin.js');

beforeEach(() => reset());

// Phase 2 (docs/plan/2026-11-04-05-testing-plan.md): the cutoff and retention
// law as a mocked contract. The real date behavior (rows on either side of the
// window actually surviving/being deleted) is Phase 1 integration coverage.
describe('runRetentionPurge — cutoff and retention law (mocked pool)', () => {
  it('bounds the delete by the Postgres-computed 12-month cutoff, no JS date', async () => {
    on(/delete from job_applications/, () => ({ rowCount: 3 }));
    expect(await runRetentionPurge()).toBe(3);
    const { sql, params } = callsOf(/delete from job_applications/)[0];
    expect(sql).toContain('applied_at < now() - make_interval(months => $1)');
    expect(params).toEqual([12]);
    expect(sql).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no baked JS timestamp to drift
  });

  it('retains Accepted / Placed / Terminated by excluding them from the delete', async () => {
    on(/delete from job_applications/, () => ({ rowCount: 0 }));
    await runRetentionPurge();
    const { sql } = callsOf(/delete from job_applications/)[0];
    expect(sql).toContain("status not in ('Accepted', 'Placed', 'Terminated')");
  });

  it('audits the purge with the month window, retained statuses and deleted count', async () => {
    on(/delete from job_applications/, () => ({ rowCount: 5 }));
    expect(await runRetentionPurge()).toBe(5);
    await vi.waitFor(() => expect(callsOf(/insert into audit_logs/)).toHaveLength(1));
    const call = callsOf(/insert into audit_logs/)[0];
    expect(call.params[0]).toBeNull(); // system user, not a request user
    expect(call.params[1]).toBe('data.purge');
    expect(JSON.parse(call.params[4])).toMatchObject({
      automated: true, monthsOld: 12,
      retainedStatuses: ['Accepted', 'Placed', 'Terminated'], deleted: 5,
    });
  });
});
