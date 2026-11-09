#!/usr/bin/env node
// Authed browser smoke (Phase 3, docs/plan/2026-11-04-05-testing-plan.md).
// One harness only: this is the thin entry point that switches
// scripts/system-check.mjs into `--smoke` mode, so the public route sweep, the
// Chrome discovery, and the problem reporting stay in a single file.
//
//   psql -U postgres -h localhost -d joblinked -f db/seed-dev.sql   # once
//   npm run preview (or dev) + npm run dev:api
//   npm run smoke          # requires INTEGRATION_TEST=1, else SKIP + exit 0
process.argv.push('--smoke')
await import('./system-check.mjs')
