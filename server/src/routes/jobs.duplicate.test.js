import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Contract test: POST /jobs/:id/duplicate writes the copy + its history row
// in one transaction. Reads source text so no DB/auth env is needed.
const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const jobsSrc = srv('src/routes/jobs.js');

const dupStart = jobsSrc.indexOf('/jobs/:id/duplicate');
const dupNext = jobsSrc.indexOf('router.', dupStart + 1);
const dup = jobsSrc.slice(dupStart, dupNext === -1 ? undefined : dupNext);

describe('jobs duplicate transaction', () => {
  it('writes the copy and its history row between begin and commit', () => {
    expect(dupStart).toBeGreaterThan(-1);
    expect(dup).toContain("'begin'");
    expect(dup).toContain('insert into job_vacancies');
    expect(dup).toContain('insert into job_status_history');
    expect(dup).toContain("'commit'");
    expect(dup.indexOf("'commit'")).toBeGreaterThan(dup.indexOf("'begin'"));
  });

  it('writes the history row as draft with null remarks and req.user.id', () => {
    expect(dup).toContain("[copyId, 'draft', null, req.user.id]");
  });

  it('rolls back on failure instead of leaving a copy without history', () => {
    expect(dup).toContain("'rollback'");
    expect(dup).toContain('catch (e)');
    expect(dup.indexOf("'rollback'")).toBeGreaterThan(dup.indexOf("'begin'"));
    expect(dup).toContain('throw e');
  });

  it('gates the duplicate behind the ownOrAdmin ownership check', () => {
    expect(dup).toContain('ownOrAdmin');
  });

  it('resets the copy to draft, strips timestamps/status, and nulls the deadline', () => {
    expect(dup).toContain('(Copy)');
    expect(dup).toContain("rest.status = 'draft'");
    expect(dup).toContain('rest.deadline = null');
    for (const col of ['published_at', 'closed_at', 'archived_at', 'status', 'remarks']) {
      expect(dup).toContain(`'${col}'`);
    }
  });

  it('reloads the copy and returns it with a 201', () => {
    expect(dup).toContain('loadJob(copyId)');
    expect(dup).toContain('status(201)');
  });
});
