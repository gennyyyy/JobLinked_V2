# ADR-026 — Admin router decomposition [RATIFIED 2026-10-15, DONE 2026-11-09]

## Context

`server/src/routes/admin.js` is the biggest maintainability drag in the backend: **697 lines** across nine unrelated domains — stats, users (list/patch/invite/role/custom-role), companies, jobs (list + PATCH + publish/unpublish), applications, employees, referrals, accreditations, audit logs, reference data, custom roles, permissions, system notifications, retention purge, and `/notifications/*` — owner-scoped routes that belong to every role, not just admins. Phase 1 flagged it as a god router.

## Decision

Split into sibling routers `server/src/routes/admin-users.js` (users), `admin-jobs.js` (job moderation), `admin-reference.js` (reference data + custom roles + permissions) beside a slimmed `admin.js` (stats + read endpoints + system notifications + retention purge), with the constants shared by two or more modules in `admin-shared.js` — and move `/notifications/*` to `server/src/routes/notifications.js`. Enforce a **300-line-per-file budget** (every resulting admin module is under ~350 lines).

The split is mechanical: **no behaviour change**. Every route keeps its path, method, guard and response; `app.js` mounts the parent router or the new siblings unchanged. `runRetentionPurge()` and its `setInterval` arming move with the domain that owns them.

Done 2026-11-09 (code-health plan Phase B Steps 2-4): the split landed as sibling modules, not the `admin/` subdirectory named above. `findUserTable` and the users surface (list / patch / invite / custom-role / role-move) live in `admin-users.js`; job list + patch + publish/unpublish in `admin-jobs.js`; reference data, custom roles, and permissions in `admin-reference.js`; stats, the read endpoints, `runRetentionPurge()` + its interval, and system notifications stay in `admin.js`; constants shared by two or more modules are in `admin-shared.js`; `/notifications/*` moved to `notifications.js` in B1. Route-path parity verified (the same 28 routes, list identical), `npx vitest run --root server` 495 green and `npm test` 1009 green in the landing commit.

## Consequences

- Nine domains become independently readable; the 300-line budget is the invariant that keeps them that way.
- Risk: the suite drives the real router, so a bad import path fails loudly — but it fails *everywhere at once*. Land it with `npx vitest run --root server` green in the same commit.
- Do not split before the D3–D8 duplication (ADR-025) is batched: moving near-identical code into three files first hides what should have been shared.
- `notifications.js` keeps `auth`, not `admin` — owner-scoped for every role.
