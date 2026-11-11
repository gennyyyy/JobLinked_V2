#!/usr/bin/env node
// Archive the uploads directory that holds resume/document bytes (ADR-040).
// Run this next to pg_dump: the database only stores file paths.
//
//   npm run backup:uploads
//
// Creates backups/uploads-<timestamp>.tgz. Restore with:
//   tar -xzf backups/uploads-<timestamp>.tgz -C server
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load server/.env so UPLOAD_DIR (and any override) is honoured, mirroring
// backup.sh. Never require a new dependency for this.
const loadServerEnv = () => {
  try {
    for (const line of readFileSync(path.join(root, 'server', '.env'), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z0-9_]+)=(.*)$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* no server/.env - fall back to defaults below */ }
};
loadServerEnv();

const uploadDirRaw = process.env.UPLOAD_DIR || 'uploads';
const source = path.isAbsolute(uploadDirRaw)
  ? uploadDirRaw
  : path.join(root, 'server', uploadDirRaw);

if (!existsSync(source)) {
  console.error(`[backup] uploads directory not found: ${source}`);
  process.exit(1);
}

// tar is a documented dependency (backup.sh relies on it too); fail loudly
// instead of crashing mid-archive.
try { execFileSync('tar', ['--version'], { stdio: 'ignore' }); }
catch {
  console.error('[backup] tar is required but was not found on PATH. Install tar or archive manually:');
  console.error(`[backup]   tar -czf backups/uploads.tgz -C ${path.dirname(source)} ${path.basename(source)}`);
  process.exit(1);
}

const outDir = path.join(root, 'backups');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const out = path.join(outDir, `uploads-${stamp}.tgz`);

try {
  execFileSync('tar', ['-czf', out, '-C', path.dirname(source), path.basename(source)], { stdio: 'inherit' });
} catch (error) {
  console.error('[backup] could not run tar. Archive the uploads directory manually:');
  console.error(`[backup]   tar -czf ${out} -C ${path.dirname(source)} ${path.basename(source)}`);
  console.error(String(error?.message || error));
  process.exit(1);
}

console.log(`[backup] wrote ${path.relative(root, out)} (${(statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);
console.log('[backup] pair this archive with your pg_dump; neither alone is a complete backup.');
