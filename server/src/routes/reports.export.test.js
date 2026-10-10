import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// ADR-030/031 contract test: CSV-only export, no heavy deps, stdlib path.
// Reads source text so no DB/auth env is needed to run it.
const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const reportsSrc = srv('src/routes/reports.js');
const uploadSrc = srv('src/upload.js');
const pkg = JSON.parse(srv('package.json'));

describe('ADR-030 csv-only export', () => {
  it('rejects non-csv formats with a csv-only 400', () => {
    expect(reportsSrc).toContain('format must be csv');
    expect(reportsSrc).not.toContain('exceljs');
    expect(reportsSrc).not.toContain('pdfkit');
    expect(reportsSrc).not.toContain("format === 'excel'");
    expect(pkg.dependencies ?? {}).not.toHaveProperty('exceljs');
    expect(pkg.dependencies ?? {}).not.toHaveProperty('pdfkit');
  });
});

describe('uploadDir stdlib path', () => {
  it('uses path.isAbsolute instead of a manual check', () => {
    expect(uploadSrc).toContain('path.isAbsolute');
    expect(uploadSrc).not.toContain('startsWith');
  });
});
