# Role change reason — persist and surface in access history

Status: approved by architect, ready for implementation
Date: 2026-11-26

## Confirmed brief

When a PESO admin changes a user's system role or custom role and types a
reason, that reason must be stored on the audit row and shown in the
**Role and access change history** table. Today it is collected, validated, and
then silently dropped.

No database schema change. Two API contracts gain a required `reason` field.
`audit_logs.details` (jsonb) already stores arbitrary audit metadata.

## Root cause (verified)

1. `UserManagement.jsx:264` blocks the confirm unless the reason is 10+ chars.
2. `confirmAccess` (`UserManagement.jsx:271-281`) never sends it:
   `assignRole(accessTarget.id, role)` / `assignCustomRole(accessTarget.id, role.id)`.
3. The services accept no reason (`src/shared/services/admin.js:76-78, 104-106`).
4. The server audits without it:
   - `admin-users.js:427` → `{ from, to }`
   - `admin-users.js:389` → `{ custom_role_id }`
5. The history table reads `log.details?.reason`
   (`UserManagement.jsx:637`) and fetches only `user.role.change`
   (`UserManagement.jsx:194`), so the cell is always `—`, and custom-role
   changes never appear at all.

## API contract changes

Base path `/api`; admin auth and existing permission gates unchanged.

### `POST /admin/users/:id/role`

Request:

```json
{ "role": "employer", "reason": "Promoted after PESO review." }
```

- `reason`: string, trimmed length 10–500. Required only when the role actually
  changes.
- Validation order: existing self/role/target checks → same-role no-op (200,
  no audit) → last-admin 409 → reason 400 → transaction.
- 400 `BAD_REQUEST`: `reason must be 10-500 characters`.
- Success response unchanged: `{ id, role }`.
- Audit on change: action `user.role.change`, details
  `{ from, to, reason }`.

### `POST /admin/users/:id/custom-role`

Request:

```json
{ "custom_role_id": 12, "reason": "Needs job-posting access." }
```

- `custom_role_id`: number or `null` (clears the tag), as today.
- `reason`: trimmed 10–500, required only when the tag actually changes.
- Same-value call: 200 no-op, no audit.
- Validation order: existing grant/last-admin checks → same-value no-op →
  reason 400 → update.
- Success response unchanged.
- Audit on change: action `user.custom-role.assign`, details
  `{ from_custom_role_id: number|null, to_custom_role_id: number|null, reason }`.

### Client services

- `assignRole(id, role, reason)` → POST `{ role, reason }`
- `assignCustomRole(id, customRoleId, reason)` → POST
  `{ custom_role_id, reason }`

Update every caller (only `UserManagement.confirmAccess`).

## Frontend behavior

`src/features/super-admin/UserManagement.jsx`

- Pass `accessReason.trim()` to both service calls.
- Add `maxLength={500}` to the reason `<Textarea>` for parity with the server.
- History load: fetch both actions and merge:
  - `listAuditLogs({ action: 'user.role.change', limit: 50 })`
  - `listAuditLogs({ action: 'user.custom-role.assign', limit: 50 })`
  - merge, sort `created_at` descending, keep 50.
  - Both calls only when `canRoles && canHistory`.
- Render the **Access** column instead of the hardcoded `—`:
  - custom-role log → the assigned role name from `customRoles` by
    `details.to_custom_role_id`; `No custom role` when null; fall back to
    `Custom role #<id>` if it was deleted.
  - role change → `—` (the Previous/New role columns already carry it).
- Previous/New role cells keep reading `details.from` / `details.to`.
- Reason cell already reads `details.reason`; no change needed once it is stored.

## Tests

### Server

- Update `server/src/__tests__/admin-delegation.test.js`:
  - successful role move / custom-role assign send a reason;
  - missing or 9-character reason → 400 and no audit insert;
  - successful change writes `audit_logs` with `details.reason` (assert the
    captured insert params).
- Update `server/src/__tests__/b2-role-move.test.js` helper to send a reason for
  real moves; keep the 403 self-move, 409 last-admin, and 200 no-op cases
  reason-free (they short-circuit before reason validation).
- Add a route test for the custom-role reason path if the existing harness does
  not cover a successful assign.

### Frontend

- New `UserManagement.history.test.jsx` (or extend `tabs.test.jsx`):
  - `listAuditLogs` returns a role log with `details.reason` and a custom-role
    log with `details.reason` + `to_custom_role_id`; both reasons render, and
    the Access column shows the custom role name.
- Extend `UserManagement.accountActions.test.jsx`:
  - changing the system role and confirming passes the typed reason as the
    third `assignRole` argument;
  - assigning a custom role passes the reason to `assignCustomRole`.
- Existing `listAuditLogs` mocks that return `[]` keep working; two calls are
  merged.

## Acceptance

- A confirmed role change stores the typed reason on its audit row and shows it
  in the history table.
- A confirmed custom-role change appears in the same history with its reason
  and access label.
- Missing/short reasons are rejected by the server, not just the UI.
- `npm test` and `npm run lint` pass (plus the server test command used by the
  repo).

## Out of scope

- Status-only changes: their reason is still only client-side and they are not
  shown in this history. Separate follow-up if wanted.
- Schema changes, audit-log pagination, or backfilling old rows (they have no
  reason to recover).
- Changes to the generic `PATCH /admin/users/:id` contract.

## Risk

The two role endpoints now reject changes without a reason. The only caller is
the SPA dialog, which always supplies one. Non-UI callers must adopt `reason`.

## Handoff

Dispatch to `fullstack-developer`: `server/src/routes/admin-users.js`,
`src/shared/services/admin.js`, `src/features/super-admin/UserManagement.jsx`,
and the listed tests.
