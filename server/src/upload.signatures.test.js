import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { matchesSignature, mimeForExt, uploadDir, IMAGE_EXTS } from './upload.js';

const b = (...bytes) => Buffer.from(bytes);
const ascii = (s) => Buffer.from(s, 'latin1');

describe('upload signatures (audit F6: extension is a client claim)', () => {
  it('accepts real PDF headers and rejects an EXE renamed .pdf', () => {
    expect(matchesSignature(ascii('%PDF-1.7\n...'), 'pdf')).toBe(true);
    expect(matchesSignature(b(0x4d, 0x5a, 0x90, 0x00), 'pdf')).toBe(false);
  });

  it('accepts PNG / JPEG / WEBP and rejects a mismatch', () => {
    expect(matchesSignature(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'png')).toBe(true);
    expect(matchesSignature(b(0xff, 0xd8, 0xff, 0xe0), 'jpg')).toBe(true);
    expect(matchesSignature(b(0xff, 0xd8, 0xff, 0xe0), 'jpeg')).toBe(true);
    expect(matchesSignature(Buffer.concat([ascii('RIFF'), b(0, 0, 0, 0), ascii('WEBP')]), 'webp')).toBe(true);
    expect(matchesSignature(ascii('%PDF-'), 'png')).toBe(false);
    expect(matchesSignature(ascii('RIFF'), 'webp')).toBe(false);
  });

  it('accepts DOC (OLE) and DOCX (zip) headers', () => {
    expect(matchesSignature(b(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), 'doc')).toBe(true);
    expect(matchesSignature(b(0x50, 0x4b, 0x03, 0x04), 'docx')).toBe(true);
    expect(matchesSignature(ascii('%PDF-'), 'docx')).toBe(false);
  });

  it('maps image extensions to the DB mime allow-list', () => {
    expect(mimeForExt('png')).toBe('image/png');
    expect(mimeForExt('jpg')).toBe('image/jpeg');
    expect(mimeForExt('jpeg')).toBe('image/jpeg');
    expect(mimeForExt('webp')).toBe('image/webp');
    expect(IMAGE_EXTS).toContain('webp');
  });

  it('resolves a relative UPLOAD_DIR against the server package, not cwd', () => {
    expect(path.isAbsolute(uploadDir)).toBe(true);
    expect(uploadDir.replace(/\\/g, '/')).toMatch(/\/server\/uploads$/);
  });
});
