import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// The whole backend suite (including the source-contract route tests) reads
// project files via process.cwd() and is designed to run from the repo root.
// Align the working dir so `cd server && npx vitest run` behaves identically to
// the root `npm test`, with no per-test edits and no coverage skipped.
// ponytail: chdir-in-config; if the run-context ever needs to be server-local,
// switch the contract tests to import.meta-relative paths instead.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(repoRoot);

// Absolute + POSIX separators so the glob targets server/src regardless of the
// (now repo-root) working dir.
const serverSrcGlob = `${path.join(repoRoot, 'server', 'src').replace(/\\/g, '/')}/**/*.test.js`;

export default defineConfig({
  test: {
    environment: 'node',
    include: [serverSrcGlob],
  },
});

