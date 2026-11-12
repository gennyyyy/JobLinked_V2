import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// B4: a failed resume INSERT/UPDATE must not leak multer's uploaded file.
// A second upload now replaces in place (one resume per account).
const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const profilesSrc = srv('src/routes/profiles.js');

const resumeStart = profilesSrc.indexOf("router.post('/files/resumes'");
const resumeEnd = profilesSrc.indexOf("router.post('/files/documents'");
const resumeRoute = profilesSrc.slice(resumeStart, resumeEnd === -1 ? undefined : resumeEnd);

describe('B4 — resume upload compensates a failed write', () => {
  it('finds the route', () => {
    expect(resumeStart).toBeGreaterThan(-1);
  });

  it('runs inside withTransaction with advisory lock', () => {
    expect(resumeRoute).toContain('withTransaction');
    expect(resumeRoute).toContain('pg_advisory_xact_lock(hashtext($1))');
  });

  it('replaces in place when a resume exists', () => {
    expect(resumeRoute).toContain('update resumes set file_path = $1, file_name = $2, uploaded_at = now(), is_active = true where seeker_id = $3');
    expect(resumeRoute).toContain('insert into resumes (seeker_id, file_path, file_name, is_active)');
  });

  it('unlinks the uploaded file in the catch, then rethrows', () => {
    expect(resumeRoute).toContain('fs.unlinkSync(req.file.path)');
    expect(resumeRoute).toContain('throw e');
  });

  it('unlinks the old file after commit on replace', () => {
    expect(resumeRoute).toContain('fs.unlinkSync(path.join(uploadDir, oldFile))');
  });

  it('updates in place on a second upload (same row id) and unlinks the first file', () => {
    expect(resumeRoute).toContain('update resumes set file_path = $1, file_name = $2, uploaded_at = now(), is_active = true where seeker_id = $3 returning *');
    expect(resumeRoute).toContain('if (oldFile && oldFile !== rel)');
    expect(resumeRoute).toContain('fs.unlinkSync(path.join(uploadDir, oldFile))');
  });
});