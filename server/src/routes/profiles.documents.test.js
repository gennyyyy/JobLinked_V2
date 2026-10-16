import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Contract test: storeDocument compensates a failed DB insert by deleting the
// uploaded file, without ever masking the original DB error.
// Reads source text so no DB/auth env is needed.
const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const profilesSrc = srv('src/routes/profiles.js');

const storeStart = profilesSrc.indexOf('async function storeDocument');
const storeEnd = profilesSrc.indexOf('async function notifyDocAdmins');
const store = profilesSrc.slice(storeStart, storeEnd === -1 ? undefined : storeEnd);

describe('profiles storeDocument compensation', () => {
  it('unlinks the uploaded file in the catch block, then rethrows', () => {
    expect(storeStart).toBeGreaterThan(-1);
    expect(store).toContain('fs.unlinkSync(file.path)');
    expect(store).toContain('throw e');
    expect(store.indexOf('throw e')).toBeGreaterThan(store.indexOf('unlinkSync'));
  });

  it('never masks the DB error: the inner unlink catch swallows nothing outward', () => {
    expect(store).toContain('compensation best-effort');
    // Exactly one rethrow of the outer error — the inner catch has no throw.
    expect(store.match(/throw e/g)?.length ?? 0).toBe(1);
    expect(store.indexOf('catch (e)')).toBeLessThan(store.indexOf('unlinkSync'));
  });

  it('does not unlink on the success path', () => {
    expect(store).toContain('return rows[0]');
    expect(store.indexOf('return rows[0]')).toBeLessThan(store.indexOf('catch (e)'));
    expect(store.indexOf('unlinkSync')).toBeGreaterThan(store.indexOf('catch (e)'));
  });

  it('stores the relative path and the client original name', () => {
    expect(store).toContain("relPath('documents'");
    expect(store).toContain('file.originalname');
    expect(store).toContain('file_path, file_name');
  });
});

// F-04: POST /files/documents without doc_type wrote multer's 5 MB file with
// no employer_documents row, no audit, and no read/delete path — unbounded
// orphan growth (uploadLimiter capped it, never cleaned it). The route now
// mirrors POST /documents and unlinks the orphan.
describe('F-04 — POST /files/documents requires doc_type', () => {
  const src = readFileSync(path.join(process.cwd(), 'server', 'src/routes/profiles.js'), 'utf8');
  const start = src.indexOf("router.post('/files/documents'");
  const end = src.indexOf("router.delete('/files/resumes/:id'");
  const route = src.slice(start, end === -1 ? undefined : end);

  it('finds the route', () => {
    expect(start).toBeGreaterThan(-1);
  });

  it('rejects a missing doc_type with 400, mirroring POST /documents', () => {
    expect(route).toContain("err(res, 400, 'BAD_REQUEST', 'doc_type is required')");
    // The silent no-row branch (201 { path } with nothing stored) is gone.
    expect(route).not.toMatch(/if \(doc_type\)/);
    expect(route).not.toContain('{ path: rel })');
  });

  it('unlinks multer\'s file BEFORE answering 400 — no orphan left on disk', () => {
    expect(route).toContain('fs.unlinkSync(req.file.path)');
    expect(route.indexOf('unlinkSync')).toBeLessThan(route.indexOf("'doc_type is required'"));
  });

  it('keeps the storeDocument + audit + notify happy path', () => {
    expect(route).toContain('storeDocument(req.user.id, doc_type, accreditation_id, req.file)');
    expect(route).toContain("void audit(req.user.id, 'document.upload'");
    expect(route).toContain('void notifyDocAdmins(req.user.id, doc_type)');
  });
});
