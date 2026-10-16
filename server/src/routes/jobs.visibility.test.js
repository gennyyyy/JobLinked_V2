import { describe, it, expect } from 'vitest';

// server/src/auth.js constructs a Supabase client at import time; stub env first.
process.env.SUPABASE_URL ||= 'http://127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const { canViewJob, listStatusFor } = await import('./jobs.js');

describe('canViewJob', () => {
  const job = (status, company = 'emp-1') => ({ id: 'j1', company_id: company, status });

  it('lets anyone read a published job', () => {
    expect(canViewJob(job('published'), null)).toBe(true);
  });

  // Deviation from the spec snippet: the provided predicate returns false
  // here (no status !== 'published'), and fail-closed is the safe reading —
  // job_vacancies.status is NOT NULL DEFAULT 'draft', so this is a
  // hand-built object, never a loadJob() row.
  it('hides a job with no loaded status', () => {
    expect(canViewJob({ id: 'j1', company_id: 'emp-1' }, null)).toBe(false);
  });

  it('hides non-published jobs from anonymous visitors', () => {
    for (const status of ['draft', 'pending', 'rejected', 'closed', 'archived']) {
      expect(canViewJob(job(status), null)).toBe(false);
    }
  });

  it('lets the owning employer read their non-published job', () => {
    expect(canViewJob(job('draft'), { id: 'emp-1', role: 'employer' })).toBe(true);
  });

  it('hides a non-published job from other employers', () => {
    expect(canViewJob(job('draft'), { id: 'emp-2', role: 'employer' })).toBe(false);
  });

  it('hides a non-published job from a job seeker', () => {
    expect(canViewJob(job('draft'), { id: 'sk-1', role: 'job-seeker' })).toBe(false);
  });

  it('lets a super-admin read anything', () => {
    expect(canViewJob(job('rejected'), { id: 'sa-1', role: 'super-admin' })).toBe(true);
  });

  it('returns false for a missing job', () => {
    expect(canViewJob(null, { id: 'emp-1', role: 'employer' })).toBe(false);
  });
});

describe('listStatusFor', () => {
  it('pins anonymous callers to published even when a status is requested', () => {
    expect(listStatusFor('draft', null)).toBe('published');
  });

  it('pins a job-seeker to published', () => {
    expect(listStatusFor('draft', { id: 'sk-1', role: 'job-seeker' })).toBe('published');
  });

  it('pins an employer to published', () => {
    expect(listStatusFor('pending', { id: 'emp-1', role: 'employer' })).toBe('published');
  });

  it('honours a status for a super-admin', () => {
    expect(listStatusFor('draft', { id: 'sa-1', role: 'super-admin' })).toBe('draft');
  });

  it('defaults a super-admin with no status to published', () => {
    expect(listStatusFor(undefined, { id: 'sa-1', role: 'super-admin' })).toBe('published');
  });
});
