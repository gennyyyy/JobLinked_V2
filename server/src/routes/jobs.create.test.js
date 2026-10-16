import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Contract test: POST /jobs publishes directly (ADR-000, no PESO review gate).
// Reads source text so no DB/auth env is needed.
const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const jobsSrc = srv('src/routes/jobs.js');
const utilSrc = srv('src/util.js');

const createStart = jobsSrc.indexOf("router.post('/jobs',");
const createEnd = jobsSrc.indexOf('router.', createStart + 1);
const create = jobsSrc.slice(createStart, createEnd === -1 ? undefined : createEnd);

// The shared helper the create path routes through (stamps published_at + history).
const wsStart = jobsSrc.indexOf('export async function writeStatus');
const writeStatus = jobsSrc.slice(wsStart, jobsSrc.indexOf('\n}', wsStart));

describe('jobs create direct publish', () => {
  it('maps non-draft creates to published, drafts to draft', () => {
    expect(createStart).toBeGreaterThan(-1);
    expect(create).toContain("const status = b.status === 'draft' ? 'draft' : 'published';");
  });

  it('never produces pending from any create request', () => {
    expect(create).not.toContain("'pending'");
  });

  it('writes status through writeStatus inside the withTransaction block (S6)', () => {
    expect(create).toContain('await writeStatus(client, jobId, status, b.remarks ?? null, req.user.id)');
    expect(create).toContain('await withTransaction(async (client) => {');
    expect(create.indexOf('writeStatus(client, jobId')).toBeGreaterThan(create.indexOf('withTransaction'));
    // One history row only: the direct insert is gone, writeStatus owns it.
    expect(create).not.toContain('insert into job_status_history');
    expect(writeStatus.match(/insert into job_status_history/g)?.length).toBe(1);
  });

  it('stamps published_at via the shared helper and returns the job with 201', () => {
    expect(writeStatus).toContain("published: 'published_at'");
    expect(create).toContain('status(201)');
  });

  it('fans out an informational (non-gating) publish notice, not a review request', () => {
    expect(create).toContain('notifyAdmins');
    expect(create).toContain("title: 'Job published'");
    expect(create).toContain('notifyMatchingSeekers(job)');
    expect(create.indexOf('notifyMatchingSeekers(job)')).toBeGreaterThan(create.indexOf('void audit('));
    expect(jobsSrc).not.toContain('Job awaiting review');
  });

  it('transaction begin/commit/rollback live once in util.js withTransaction', () => {
    expect(utilSrc).toContain('export async function withTransaction(fn)');
    expect(utilSrc).toMatch(/await client\.query\('begin'\)/);
    expect(utilSrc).toMatch(/await client\.query\('commit'\)/);
    expect(utilSrc).toMatch(/await client\.query\('rollback'\)/);
    expect(utilSrc).toContain('client.release()');
  });
});
