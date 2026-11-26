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

// T5 (RA 10173 retention): one transaction purges every data class on its own
// window. The real date behavior is Phase 1 integration coverage; here the SQL
// contract and the audit summary are asserted against the mocked pool.
const DELETES = {
  applications: /^delete from job_applications/,
  auditLogs: /^delete from audit_logs/,
  notifications: /^delete from notifications/,
  pendingSignups: /^delete from pending_signups/,
  verifications: /^delete from auth\."verification"/,
  sessions: /^delete from auth\."session"/,
  authUsers: /^delete from auth\."user"/,
};

describe('runRetentionPurge — every data class and its cutoff', () => {
  it('deletes stale non-employment applications, bounded by the Postgres 12-month cutoff', async () => {
    on(DELETES.applications, () => ({ rowCount: 3 }));
    expect(await runRetentionPurge()).toBe(3);
    const { sql, params } = callsOf(DELETES.applications)[0];
    expect(sql).toContain('applied_at < now() - make_interval(months => $1)');
    expect(params).toEqual([12]);
    expect(sql).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no baked JS timestamp to drift
  });

  it('retains Accepted / Placed / Terminated by excluding them from the delete', async () => {
    await runRetentionPurge();
    const { sql } = callsOf(DELETES.applications)[0];
    expect(sql).toContain("status not in ('Accepted', 'Placed', 'Terminated')");
  });

  it('deletes audit rows older than 12 months', async () => {
    await runRetentionPurge();
    const { sql, params } = callsOf(DELETES.auditLogs)[0];
    expect(sql).toContain('created_at < now() - make_interval(months => $1)');
    expect(params).toEqual([12]);
  });

  it('deletes only READ notifications older than 90 days', async () => {
    await runRetentionPurge();
    const { sql, params } = callsOf(DELETES.notifications)[0];
    expect(sql).toContain('is_read = true');
    expect(sql).toContain('created_at < now() - make_interval(days => $1)');
    expect(params).toEqual([90]);
  });

  it('deletes pending signups older than 30 days', async () => {
    await runRetentionPurge();
    const { sql, params } = callsOf(DELETES.pendingSignups)[0];
    expect(sql).toContain('created_at < now() - make_interval(days => $1)');
    expect(params).toEqual([30]);
  });

  it('deletes verification and expired session rows 30 days past expiry', async () => {
    await runRetentionPurge();
    const verifications = callsOf(DELETES.verifications);
    const sessions = callsOf(DELETES.sessions);
    expect(verifications).toHaveLength(1);
    expect(sessions).toHaveLength(1);
    for (const { sql, params } of [verifications[0], sessions[0]]) {
      expect(sql).toContain('"expiresAt" < now() - make_interval(days => $1)');
      expect(params).toEqual([30]);
      expect(sql).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  it('deletes unverified auth users older than 30 days, guarded by role/invite rows', async () => {
    await runRetentionPurge();
    const { sql, params } = callsOf(DELETES.authUsers)[0];
    expect(sql).toContain('"emailVerified" = false');
    expect(sql).toContain('"createdAt" < now() - make_interval(days => $1)');
    // An account that provisioned (any role) or has an outstanding invite is kept.
    expect(sql).toContain('not exists (select 1 from public.job_seekers');
    expect(sql).toContain('not exists (select 1 from public.employers');
    expect(sql).toContain('not exists (select 1 from public.super_admins');
    expect(sql).toContain('not exists (select 1 from public.admin_invites');
    expect(params).toEqual([30]);
  });

  it('runs all seven deletes in ONE transaction and never touches protected tables', async () => {
    await runRetentionPurge();

    const deletes = callsOf(/^delete from /);
    expect(deletes).toHaveLength(7);
    expect(deletes.every((c) => c.via === 'tx')).toBe(true);
    expect(callsOf(/^begin/)).toHaveLength(1);
    expect(callsOf(/^commit/)).toHaveLength(1);
    expect(callsOf(/^rollback/)).toHaveLength(0);

    // Lawful employment records and other users' live data are out of scope.
    expect(callsOf(/delete from (employment_history|employer_accreditations|job_vacancies|employers|job_seekers|profile_images|resumes)/))
      .toHaveLength(0);
    expect(callsOf(/delete from auth\."user"/)[0].params).toEqual([30]);
  });
});

describe('runRetentionPurge — data.purge audit summary', () => {
  it('writes ONE audit row on the transaction client with per-table counts', async () => {
    on(DELETES.applications, () => ({ rowCount: 5 }));
    on(DELETES.auditLogs, () => ({ rowCount: 40 }));
    on(DELETES.notifications, () => ({ rowCount: 7 }));
    on(DELETES.pendingSignups, () => ({ rowCount: 2 }));
    on(DELETES.verifications, () => ({ rowCount: 4 }));
    on(DELETES.sessions, () => ({ rowCount: 9 }));
    on(DELETES.authUsers, () => ({ rowCount: 3 }));

    expect(await runRetentionPurge()).toBe(5);
    const calls = callsOf(/insert into audit_logs/);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    // ADR-060: commits or rolls back with the deletes — never the pool helper.
    expect(call.via).toBe('tx');
    expect(call.params[0]).toBeNull(); // system user, not a request user
    expect(call.params[1]).toBe('data.purge');
    expect(JSON.parse(call.params[4])).toEqual({
      automated: true,
      monthsOld: 12,
      retainedStatuses: ['Accepted', 'Placed', 'Terminated'],
      deleted: {
        job_applications: 5,
        audit_logs: 40,
        notifications: 7,
        pending_signups: 2,
        verifications: 4,
        sessions: 9,
        auth_users: 3,
      },
    });
  });
});
