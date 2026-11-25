# Audit log filtering

- **Status:** Brief approved 2026-11-26. Ready for dispatch: `frontend`.
- **Owner of contract:** architect. No backend endpoint, service, or schema change.

## Confirmed brief

- **What:** Add filter controls to the super-admin Activity Log (`/super-admin/logs`): actor (dropdown), action (text, server-side partial match), and a from/to date range. Keep the existing search box, which filters the loaded rows client-side. Filters apply automatically and reset the pager to page 1.
- **How:** Frontend only. Reuse `GET /api/admin/audit-logs?userId=&action=&from=&to=` through the existing `listAuditLogs(...)`. Actor options come from `listUsers({ pageSize: 500 })`. Latest 500 matching rows, existing client-side pager.
- **Done when:** focused Logs tests and scoped ESLint pass; the existing search, export, and error behaviors still pass.
- **Out of scope:** server pagination, free-text server search (`q`), filtering inside `details`, selectable "System / legacy" (null actor), schema changes, CSV format changes.

## Existing contract (verified in code — do not change it)

`GET /api/admin/audit-logs?limit=&userId=&action=&from=&to=`

- Guard: `auth`, `super-admin`, `logs.view`.
- `userId` must be a UUID; malformed → `400 BAD_REQUEST`. Exact match on `audit_logs.user_id`.
- `action` is a case-insensitive partial match (`ilike '%…%'`).
- `from` / `to` must be `YYYY-MM-DD`; malformed → `400 BAD_REQUEST`. Bounds are naive PH-local (`T00:00:00`, `T23:59:59.999`).
- `limit` defaults to 500; clamped to 1–2000. No offset/page.
- Rows carry `id, user_id, action, entity, entity_id, details, created_at` plus `actor_name` / `actor_email` from the three role tables; both null for system rows.

Client service (already shipped): `listAuditLogs({ limit = 500, userId = '', action = '', from = '', to = '' })`. `api.get` omits empty-string params.

Actor list: `listUsers({ pageSize: 500 })` → `{ data, total, page, pageSize }`; each user has `id, full_name, email, role`.

No schema change, no ADR.

## Behavior to build

1. **Filter bar** above the table, below the existing search box: `Actor | Action | From | To` in a responsive grid (`grid gap-3 sm:grid-cols-2 xl:grid-cols-4`).
   - Actor: `SelectField id="logs-actor" label="Actor" placeholder="All actors"`, options = `{ value: user.id, label: user.full_name || user.email || 'Unnamed account' }`.
   - Action: `TextField id="logs-action" label="Action" placeholder="Any action (e.g. job.update)"`.
   - From / To: `TextField type="date" id="logs-from" / "logs-to"`, labels "From" / "To".
2. **Refetch** whenever `userId`, debounced action, `from`, or `to` changes. Debounce the action text 350 ms, mirroring `UserManagement.jsx:166-169`.
3. **Sequence guard:** an incrementing ref drops superseded responses (mirror `UserManagement.jsx:131-151`), so an older fetch can never overwrite a newer one.
4. **First load** still shows `PageSkeleton`. A filter refetch keeps the current table mounted until the new rows arrive (do not set `loading` back to true).
5. Actor list fetch failure is non-fatal: the table renders and the dropdown has only "All actors". `listAuditLogs` failure keeps the existing `InlineError` behavior.
6. Every filter change calls `setPage(1)`. Keep the existing client-side `records` memo, search box, CSV export, `Pager`, and table markup.
7. Empty copy: "No activity matches these filters." / "Clear the search and filters to see all activity."
8. Rows with a null actor appear only when no actor filter is selected — that is expected, not a bug.

## Files

- Modify: `src/features/super-admin/Logs.jsx`
- Modify: `src/features/super-admin/__tests__/Logs.test.jsx`
- No service file change: `listAuditLogs` already accepts `userId/action/from/to`.

## Tasks

### Task 1 — Actor filter

**Interfaces:**
- Consumes: `listUsers({ pageSize: 500 })`, `listAuditLogs({ userId, action, from, to })`, `SelectField`.
- Produces: `userId` state and the actor dropdown that feed Task 2's fetch effect.

- [ ] **Step 1: Write the failing tests** in `Logs.test.jsx`:
  - Mock module now exports both `listAuditLogs` and `listUsers`.
  - `it('loads the actor list and refetches server-side when an actor is chosen')`:
    - `listUsers` resolves `{ data: [{ id: 'u1', full_name: 'Jane' }], total: 1, page: 1, pageSize: 500 }`.
    - Render, await table, `fireEvent.change(screen.getByLabelText('Actor'), { target: { value: 'u1' } })`.
    - `await waitFor(() => expect(listAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'u1' })))`.
  - `it('keeps the table usable when the actor list fails')`: `listUsers.mockRejectedValue(...)`; table still renders; the Actor select has one option (`All actors`).
- [ ] **Step 2: Run it and see it fail.**
  Run: `npx vitest run src/features/super-admin/__tests__/Logs.test.jsx`
- [ ] **Step 3: Implement in `Logs.jsx`:**
  - Import `listUsers`; import `SelectField` from `@/shared/components/design`.
  - Add `actors`, `userId` state and `loadReqRef = useRef(0)`.
  - Mount effect: `listUsers({ pageSize: 500 }).then((res) => setActors(res.data || [])).catch(() => {})`.
  - Replace the current mount-only `listAuditLogs()` effect with one keyed on the filter values, calling `listAuditLogs({ userId, action: debouncedAction, from, to })` with the sequence guard; set `loading=false` in `finally` only after the latest request.
  - Add the Actor select; on change set `userId` and `setPage(1)`.
- [ ] **Step 4: Run the focused test file.** Expected: all green.
- [ ] **Step 5: Commit** `feat(admin): filter audit logs by actor`.

### Task 2 — Action and date filters

**Interfaces:**
- Consumes: Task 1's fetch effect and `userId` filter.
- Produces: `action` / `debouncedAction`, `from`, `to`, and the final query object passed to `listAuditLogs`.

- [ ] **Step 1: Write the failing tests**:
  - `it('sends the action filter after the debounce')`: type `job.` into the Action field; `await waitFor(() => expect(listAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'job.' })), { timeout: 1500 })`.
  - `it('sends the date range and clears it back to empty strings')`: set From `2026-01-01`, To `2026-01-31`; assert the last call contains both; then clear From and assert the last call has `from: ''`.
  - `it('resets the pager to page 1 when a filter changes')`: with 9 mocked rows, click `Next page` once, then change Actor; assert the footer text starts with `1–` (the `Pager` renders `1–8 of 9 records`).
- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Implement in `Logs.jsx`:**
  - Add `action` (raw input), `debouncedAction` (350 ms `setTimeout`, trimmed), `from`, `to`.
  - Add the three fields and their `setPage(1)` handlers.
  - Include all four filters in the fetch effect and the `listAuditLogs` call. Send no `limit` override; the service default (500) is the contract.
- [ ] **Step 4: Run the focused test file.** Expected: green.
- [ ] **Step 5: Commit** `feat(admin): filter audit logs by action and date range`.

### Task 3 — Verification

- [ ] **Step 1:** `npx vitest run src/features/super-admin/__tests__/Logs.test.jsx` — green.
- [ ] **Step 2:** `npx eslint src/features/super-admin/Logs.jsx src/features/super-admin/__tests__/Logs.test.jsx` — clean.
- [ ] **Step 3:** `npm test` — no regressions (report any pre-existing failures separately; do not "fix" unrelated tests).
- [ ] **Step 4:** `npm run lint` — report the result; unrelated warnings from another agent's in-flight work are not this task's to fix.

## Edge cases pinned by tests

- Actor list fetch rejection must not blank the page.
- Clearing a filter sends an empty string (service drops it) and refetches unfiltered.
- A superseded response must not overwrite newer rows (sequence guard).
- Action text is debounced: one request per typing pause, not per keystroke.
- Pager returns to page 1 on any filter change.

## Worktree note

The tree already contains another agent's uncommitted design-system edits, including `Logs.jsx` and `Logs.test.jsx`. Build on the current content; never revert, restash, or reformat unrelated lines.
