# Access history consistency — one row per change, no ghosts

Status: approved by architect, ready for implementation
Date: 2026-11-26

## Confirmed brief

The history now shows the reasons, but one confirmed access change can produce
two rows (system role + custom role), and older audit rows render as ghosts
(wrong Access label, no user name, no reason). Make the table render **one row
per confirmed change**, resolve legacy rows correctly, and always show the
target user.

No schema change. One additive API field (`change_id`), one additive audit-log
response field (`target_name`), and a safer audit-log query.

## Evidence (local audit_logs)

- `3223` `user.role.change` (job-seeker → super-admin) and `3224`
  `user.custom-role.assign` (null → 14) were written 0.6 s apart by the same
  actor for the same target, with the identical reason. One confirm, two rows.
- `3212`/`3213` and `3220`/`3221` show the same pairs (the latter with no
  reason, pre-fix).
- Older `user.custom-role.assign` rows store `details.custom_role_id` (string
  `"41"`, number `29`, or `null`), not `to_custom_role_id`. The new Access
  column reads only `to_custom_role_id`, so these render "No custom role" —
  wrong.
- The table resolves the User cell from `users` (the current 25-row page), so
  any history row outside the page renders `—`.
- The audit-log query joins three actor tables by `l.user_id`. A moved actor
  keeps an inactive row in the old table, so those joins can multiply audit
  rows. The current data happens not to trigger it; fix it before it does.

## Contract changes

### Both access endpoints

`POST /admin/users/:id/role` and `POST /admin/users/:id/custom-role` accept an
optional `change_id` UUID alongside the existing fields.

- If present and not a UUID → 400 `BAD_REQUEST`, `change_id must be a UUID`.
- If present, store it in the audit details:
  - role: `{ from, to, reason, change_id? }`
  - custom: `{ from_custom_role_id, to_custom_role_id, reason, change_id? }`
- Existing no-op/validation order is unchanged.

Normalize `custom_role_id` before comparing/storing: `null` or
`Number(value)`; reject non-integers. This keeps a string `"14"` and number
`14` a no-op instead of a phantom audit row.

### `GET /admin/audit-logs`

Add `target_name` to each row: the full name of the user identified by
`entity` + `entity_id`, using a `CASE` with scalar subqueries (no joins, so no
row multiplication). For non-user entities it is `null`.

Also replace the three actor `LEFT JOIN`s with scalar subqueries
(`super_admins` → `employers` → `job_seekers`) for `actor_name` / `actor_email`.
Additive response change; other consumers keep working.

## Frontend behavior

`src/features/super-admin/UserManagement.jsx`

1. Generate one `change_id` per dialog session:
   - `openAccess` sets `accessChangeId = crypto.randomUUID()`.
   - Both service calls receive it; retries after a partial failure reuse it.
2. Services:
   - `assignRole(id, role, reason, changeId)`
   - `assignCustomRole(id, customRoleId, reason, changeId)`
   - send `change_id` in the body.
3. Extract `loadHistory()`; call it in the existing load effect and again after
   a successful access change so the table updates without a reload.
4. Build display entries from the merged logs:
   - Dedupe by `log.id` first.
   - Group rows that share `details.change_id`.
   - For legacy rows (no `change_id`), best-effort pair one
     `user.role.change` with one `user.custom-role.assign` when
     `entity_id`, `user_id`, and a ≤10 s timestamp window match. Mark this with
     a `ponytail:` comment; it is display-only and bounded.
   - Sort entries by time descending, keep 50.
5. Render one row per entry:
   - User: `target_name` (title-cased), fall back to the loaded user list, then
     `—`.
   - Previous/New role: from the role log; `—` when the entry has no role log.
   - Access: from the custom-role log. Resolve
     `details.to_custom_role_id ?? details.custom_role_id`:
       - absent key → `—`
       - `null` → `No custom role`
       - id → role name from `customRoles`, fallback `Custom role #<id>`
   - Administrator/Timestamp: from either log (prefer the role log).
   - Reason: first non-empty, else `Not recorded`.
6. Keep the raw `history` state as merged logs; grouping is a render-time view.

## Tests

### Server

- `admin-delegation.test.js`:
  - role and custom-role audits persist `change_id` when provided;
  - malformed `change_id` → 400, no write/audit;
  - custom role same value with `"14"` vs `14` → 200 no-op, no audit.
- Audit-logs route: assert the query selects `target_name` and does not use
  the three actor `LEFT JOIN`s (stub inspection or an integration test if the
  harness supports it). At minimum, a mocked response with `target_name` must
  pass through.

### Frontend

- Rewrite/extend `UserManagement.history.test.jsx`:
  1. role + custom logs sharing `change_id` render as **one** row showing
     Previous/New role, Access, and one reason;
  2. legacy pair (no `change_id`, ≤10 s apart) renders as one row;
  3. legacy custom log with `custom_role_id` shows the correct Access name;
  4. duplicate `log.id` values in the merged response render once;
  5. `target_name` renders for a user who is not in the loaded page;
  6. a legacy row without a reason shows `Not recorded`.
- `UserManagement.accountActions.test.jsx`: both service calls receive the same
  `change_id` (UUID) and the trimmed reason; the history reloads after a
  successful confirm.

## Acceptance

- One confirmed change appears once, with both role and access details.
- No row shows "No custom role" unless the custom role was actually cleared.
- User names appear even when the target is not on the current users page.
- Duplicate API rows cannot duplicate table rows.
- New changes appear in the history immediately after confirming.
- `npm test`, the server suite, and `npm run lint` pass.

## Out of scope

- Backfilling or mutating existing audit rows.
- Status-only changes (still not in this history).
- A combined access endpoint; the two audit rows remain the source records and
  are grouped only for display.

## Handoff

Dispatch to `fullstack-developer`: `server/src/routes/admin-users.js`,
`server/src/routes/admin.js` (audit-logs query),
`src/shared/services/admin.js`, `src/features/super-admin/UserManagement.jsx`,
and the listed tests.
