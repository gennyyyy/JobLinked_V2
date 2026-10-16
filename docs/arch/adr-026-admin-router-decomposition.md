# ADR-026 — Admin router decomposition [RATIFIED 2026-10-15, NOT YET DONE]

## Context

`server/src/routes/admin.js` is the biggest maintainability drag in the backend: **697 lines** across nine unrelated domains — stats, users (list/patch/invite/role/custom-role), companies, jobs (list + PATCH + publish/unpublish), applications, employees, referrals, accreditations, audit logs, reference data, custom roles, permissions, system notifications, retention purge, and `/notifications/*` — owner-scoped routes that belong to every role, not just admins. Phase 1 flagged it as a god router.

## Decision

Split into `server/src/routes/admin/` sub-routers — `users.js`, `moderation.js` (jobs + applications + accreditations), `reference.js` (reference data + custom roles + permissions) — and move `/notifications/*` to `server/src/routes/notifications.js`. Enforce a **300-line-per-file budget**.

The split is mechanical: **no behaviour change**. Every route keeps its path, method, guard and response; `app.js` mounts the parent router or the new siblings unchanged. `runRetentionPurge()` and its `setInterval` arming move with the domain that owns them.

Not done at time of writing: `admin.js` is still one 697-line file and `/notifications/*` still lives in it (`admin.js:536-567`). Blocker is cost, not disagreement — the split touches every `admin.*` test import and ~15 `vi.mock` paths, so it must land as one reviewed batch, never mid-session.

## Consequences

- Nine domains become independently readable; the 300-line budget is the invariant that keeps them that way.
- Risk: the suite drives the real router, so a bad import path fails loudly — but it fails *everywhere at once*. Land it with `npx vitest run --root server` green in the same commit.
- Do not split before the D3–D8 duplication (ADR-025) is batched: moving near-identical code into three files first hides what should have been shared.
- `notifications.js` keeps `auth`, not `admin` — owner-scoped for every role.
