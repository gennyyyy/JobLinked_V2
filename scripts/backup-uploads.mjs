#!/usr/bin/env node
// Archive the uploads directory that holds resume/document bytes (ADR-040).
// Run this next to pg_dump: the database only stores file paths.
//
//   npm run backup:uploads
//
// Creates backups/uploads-<timestamp>.tgz. Restore with:
//   tar -xzf backups/uploads-<timestamp>.tgz -C server
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'server', 'uploads');
if (!existsSync(source)) {
  console.error(`[backup] uploads directory not found: ${source}`);
  process.exit(1);
}
const outDir = path.join(root, 'backups');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const out = path.join(outDir, `uploads-${stamp}.tgz`);

try {
  execFileSync('tar', ['-czf', out, '-C', path.join(root, 'server'), 'uploads'], { stdio: 'inherit' });
} catch (error) {
  console.error('[backup] could not run tar. Archive server/uploads manually:');
  console.error(`[backup]   tar -czf ${out} -C server uploads`);
  console.error(String(error?.message || error));
  process.exit(1);
}

console.log(`[backup] wrote ${path.relative(root, out)} (${(statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);
console.log('[backup] pair this archive with your pg_dump; neither alone is a complete backup.');
