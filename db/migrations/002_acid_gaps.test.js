import { readFileSync } from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Contract test: 002_acid_gaps migration guards. Reads the SQL text directly
// so no database is needed to run it.
const mig = readFileSync(
  path.join(process.cwd(), 'db', 'migrations', '002_acid_gaps.sql'),
  'utf8',
);

describe('002_acid_gaps migration guards', () => {
  it('guards both email uniques with a duplicate check that raises a notice', () => {
    for (const table of ['job_seekers', 'employers']) {
      expect(mig).toContain(`SELECT email FROM public.${table} GROUP BY email HAVING COUNT(*) > 1`);
    }
    expect(mig).toContain('RAISE NOTICE');
  });

  it('is safe to re-run via IF NOT EXISTS indexes and a WHERE NOT EXISTS backfill', () => {
    expect(mig).toContain('IF NOT EXISTS');
    expect(mig).toContain('WHERE NOT EXISTS');
  });

  it('marks backfilled history rows and leaves changed_by null', () => {
    expect(mig).toContain("'backfill: duplicate-path orphan'");
    expect(mig).toContain(
      "SELECT v.id, v.status, 'backfill: duplicate-path orphan', NULL",
    );
  });

  it('scopes the backfill to orphans only (jobs missing any history row)', () => {
    expect(mig).toContain('SELECT 1 FROM public.job_status_history h WHERE h.job_id = v.id');
  });

  it('runs in a single transaction with plain CREATE INDEX (no CONCURRENTLY)', () => {
    expect(mig).toContain('BEGIN;');
    expect(mig).toContain('COMMIT;');
    const code = mig.replace(/--[^\n]*/g, '');
    expect(code).not.toMatch(/CONCURRENTLY/);
  });

  it('ships a complete rollback block covering the marker rows and both indexes', () => {
    expect(mig).toContain(
      "DELETE FROM public.job_status_history WHERE remarks = 'backfill: duplicate-path orphan' AND changed_by IS NULL;",
    );
    expect(mig).toContain('DROP INDEX IF EXISTS public.employers_email_uidx;');
    expect(mig).toContain('DROP INDEX IF EXISTS public.job_seekers_email_uidx;');
  });
});
