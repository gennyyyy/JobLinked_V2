# ADR-025 — Backend shared helpers, stay thin [RATIFIED 2026-10-15, recorded 2026-10-16]

## Context

Phase 1 scored backend layering 2.5/5 and found nine duplication patterns
(D1–D9): transaction boilerplate ×8, 3-table role union ×2, job status writer
×2, seeker JSON projection ×3, job constant sets ×2, ownership guards ×10,
`loadJob` ×2, notification fan-out ×3, frontend re-normalisation. ADR-020 chose
a *thin* Express API over controller/service/repository layers; the debt was
duplication, not missing structure.

## Decision

Share the primitive helpers in `server/src/util.js`. **Do not** add controllers,
services, repositories, a `queries.js` fragment module, or a service layer —
enforce a per-file size budget instead of adding indirection.

Landed as single definitions: `withTransaction` (the D1 fix — zero
`pool.connect()` outside `util.js`), `pageParams`, `err`, `ah`, `audit`,
`notifyUser`, `notifyAdmins`, `buildFullName`, `isUuid`, `isNumericId`,
`likeEscape`. `resolveRole` / `findUserTable` (`auth.js`, `admin.js`) are the D2
home: the role-union SQL is written twice, once per caller, and `/admin/users`
uses a third shape because it must dedupe before filtering.

Open when written: `writeStatus` vs `adminWriteStatus` are still near-identical;
`SEEKER_COLS`/`json_build_object` and the job constant sets are still replicated
across `jobs.js` / `admin.js` / `reports.js` / `applications.js`; `ownOrAdmin`,
`credByLink`, `seekerChildRead`, `loadJob` are still per-file. Batch them as one
refactor with the ADR-026 split, never piecemeal.

## Consequences

- Route files stay readable without a layer boundary. No abstraction with one
  implementation, no factory, no config for a fixed value.
- Ceiling: `util.js` is the catch-all. Past ~150 lines split by concern
  (transactions vs ids vs pagination) rather than adding a service layer.
- Cost: duplication outside `util.js` has no single fix site — which is why the
  D3–D8 leftovers must be batched, not forgotten.
