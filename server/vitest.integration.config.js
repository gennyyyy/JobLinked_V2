import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Phase 1 (docs/plan/2026-11-04-05-testing-plan.md): the real-Postgres slice,
// run only via `npm run test:integration` (server/). INTEGRATION_TEST=1 is the
// same marker every integration case gates on. CI stays untouched (Phase 4).
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  test: {
    environment: 'node',
    env: { INTEGRATION_TEST: '1' },
    include: [`${repoRoot.replace(/\\/g, '/')}/server/src/__tests__/integration/*.test.js`],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
