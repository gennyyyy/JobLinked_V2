import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const profiles = srv('src/routes/profiles.js');
const upload = srv('src/upload.js');

const between = (src, start, end) => src.slice(src.indexOf(start), src.indexOf(end));

describe('file-storage regressions (2026-11-05 audit)', () => {
  it('serialises resume uploads per user before deactivate+insert', () => {
    const route = between(profiles, "router.post('/files/resumes'", "router.post('/files/documents'");
    expect(route).toContain('pg_advisory_xact_lock(hashtext($1))');
    expect(route.indexOf('pg_advisory_xact_lock')).toBeLessThan(route.indexOf('update resumes set is_active = false'));
    expect(route).toContain("insert into resumes (seeker_id, file_path, file_name, is_active)");
    // quota guard runs BEFORE multer writes the file (no orphan to clean up)
    expect(profiles).toContain('const MAX_RESUMES_PER_SEEKER');
    expect(profiles).toContain('resumeQuota');
    expect(profiles.indexOf('resumeQuota')).toBeLessThan(profiles.indexOf("router.post('/files/resumes'"));
    expect(route).toContain('fs.unlinkSync(req.file.path)');
  });

  it('promotes the newest remaining resume when the active one is deleted', () => {
    const route = between(profiles, "router.delete('/files/resumes/:id'", "router.get('/files/resumes/mine'");
    expect(route).toContain("if (rows[0].is_active)");
    expect(route).toContain('update resumes set is_active = true');
    expect(route).toContain('order by uploaded_at desc, id desc limit 1');
    expect(route).toContain('rmdirSync');
  });

  it('serialises resume activation with the same per-user lock as upload', () => {
    const route = between(profiles, "router.post('/files/resumes/:id/activate'", "// Addendum A: seeker profile children");
    expect(route).toContain('pg_advisory_xact_lock(hashtext($1))');
    expect(route.indexOf('pg_advisory_xact_lock')).toBeLessThan(route.indexOf('update resumes set is_active = false'));
  });

  it('marks authenticated file downloads private and varies on Authorization', () => {
    const route = between(profiles, "router.get('/files/:bucket/*'", 'export default router');
    expect(route).toContain("Cache-Control', 'private, max-age=0, must-revalidate");
    expect(route).toContain("vary('Authorization')");
    expect(route).toContain('Content-Disposition');
    expect(route).toContain('res.sendFile(abs)');
  });

  it('resolves UPLOAD_DIR against the server package, never cwd', () => {
    expect(upload).not.toContain('path.join(process.cwd()');
    expect(upload).toContain('fileURLToPath(import.meta.url)');
    expect(upload).toContain("path.resolve(SERVER_ROOT, configured)");
  });

  it('checks magic bytes on both disk and memory uploads', () => {
    expect(upload).toContain('matchesSignature(readHead(req.file.path), ext)');
    expect(upload).toContain('matchesSignature(req.file.buffer, ext)');
    expect(upload).toContain('File content does not match its extension.');
    expect(upload).toContain('Image content does not match its extension.');
  });
});
