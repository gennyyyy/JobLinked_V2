import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// B4: a failed resume INSERT (e.g. the resumes_one_active_uidx partial unique
// index on a concurrent upload) rolled back but left multer's uploaded file on
// disk forever. The route now compensates exactly like storeDocument.
const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const profilesSrc = srv('src/routes/profiles.js');

const resumeStart = profilesSrc.indexOf("router.post('/files/resumes'");
const resumeEnd = profilesSrc.indexOf("router.post('/files/documents'");
const resumeRoute = profilesSrc.slice(resumeStart, resumeEnd === -1 ? undefined : resumeEnd);

describe('B4 — resume upload compensates a failed insert', () => {
  it('finds the route', () => {
    expect(resumeStart).toBeGreaterThan(-1);
  });

  it('runs the insert inside withTransaction (S6)', () => {
    expect(resumeRoute).toContain('withTransaction');
    expect(resumeRoute).toContain('update resumes set is_active = false where seeker_id = $1');
    expect(resumeRoute).toContain('insert into resumes (seeker_id, file_path, file_name, is_active)');
  });

  it('unlinks the uploaded file in the catch, then rethrows', () => {
    expect(resumeRoute).toContain('fs.unlinkSync(req.file.path)');
    expect(resumeRoute).toContain('throw e');
    expect(resumeRoute.indexOf('unlinkSync')).toBeGreaterThan(resumeRoute.indexOf('catch (e)'));
    expect(resumeRoute.indexOf('throw e')).toBeGreaterThan(resumeRoute.indexOf('unlinkSync'));
  });

  it('succeeds without touching the filesystem (no unlink on the happy path)', () => {
    const happy = resumeRoute.slice(0, resumeRoute.indexOf('catch (e)'));
    expect(happy).not.toContain('unlinkSync');
  });
});
