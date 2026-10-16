import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Contract test: DELETE /jobs/:id hard-deletes (ADR-013). Reads source text
// so no DB/auth env is needed.
const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const jobsSrc = srv('src/routes/jobs.js');

const delStart = jobsSrc.indexOf("router.delete('/jobs/:id'");
const delNext = jobsSrc.indexOf('router.', delStart + 1);
const del = jobsSrc.slice(delStart, delNext === -1 ? undefined : delNext);

describe('jobs permanent delete', () => {
  it('exposes DELETE /jobs/:id behind the ownOrAdmin ownership check', () => {
    expect(delStart).toBeGreaterThan(-1);
    expect(del).toContain('ownOrAdmin');
    expect(del).toContain('if (!job) return;');
  });

  it('counts job_applications before deleting the vacancy', () => {
    expect(del).toContain('select count(*)::int c from job_applications where job_id = $1');
    expect(del).toContain('delete from job_vacancies where id = $1');
    expect(del.indexOf('count(*)')).toBeLessThan(del.indexOf('delete from job_vacancies'));
  });

  it('returns and audits the destroyed application count', () => {
    expect(del).toContain('applications: rows[0].c');
    expect(del).toContain("'job.delete'");
    expect(del).toContain('{ applications: rows[0].c }');
  });
});
