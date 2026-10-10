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
