# Task 10 - local re-verification of G-01 and G-02, 2026-11-13

**Project:** JobLinked / PESO Santa Maria - Express API + PostgreSQL (Supabase auth only)
**Plan:** `docs/plan/2026-11-13-security-fixes.md` - Task 10 (local half only; the production
`curl -sI` and external-scanner half is not this report)
**Fixes under test:** `20587f2` (G-01) and `aa48b74` (G-02 enforcement, G-07 lockout guard)
**Baseline audited:** `2026-11-13-admin-guard-matrix.md` (G-01/G-02/G-07) and
`2026-11-13-phase4-probes.md` (P-06/P-07/P-08 live proof)
**Agent:** penetration-tester
**Mode:** authorized active testing, **local instance only**. No product code, test, or `db/schema.sql`
change. Production node, production Supabase project, and any remote database were never contacted.
**Evidence:** `%TEMP%\t10\evidence.json` (ephemeral, outside the repo); tokens were never written.

## Verdict

| Finding | Status after this run | Basis |
|---|---|---|
| **G-01** (invitee chooses its own custom role) | **CLOSED** | The invitee's tag is resolved only from service-role `app_metadata`; body variants (narrow id, omitted, explicit null) all 403 `INVITE_INCOMPLETE` with **no** `super_admins` row. A narrow metadata tag stays narrow; the body cannot widen it. Regression: the explicit-null full-admin grant itself cannot be persisted by Supabase GoTrue (see R10-02) - fail-closed, no escalation. |
| **G-02** (delegation may not exceed the delegator) | **NOT CLOSED** | P-07 and P-08 are closed (every grant attempt refused 403/409, ceiling and self-guards hold). **P-08b proves a live escalation**: a bundle of `users.manage` + `roles.manage` creates an empty-bundle role, invites a super-admin with it, deletes the role before accept, and the invitee provisions as a **full break-glass admin** (`custom_role_id NULL`, `GET /admin/users` **200**). See R10-01. |
| **G-07** (last break-glass lockout guard) | Guard present, **not reachable in this DB** | `removesLastBreakGlass` requires zero *other* active break-glass admins; the dev DB has 5-6. Reaching 409 needs pre-existing accounts to be suspended/demoted, outside the read-only ROE. Code + unit test only; see A6. |

**Gate consequence:** G-01 is evidenced closed; **G-02 is not**, so the gate cannot flip to PASS on the
G-01/G-02 pair. One code change (R10-01) plus a retest of P-08b closes it.

---

## 1. Environment and method

| Item | Value |
|---|---|
| Target | `http://127.0.0.1:4000` - local API restarted for this task |
| Restart | Old child (PID 35148, started 04:48:09) stopped; the `scripts/dev.mjs` watcher (PID 26688) respawned it. New PID **28620**, started 04:56:43. `GET /api/health` -> `200` (`{"ok":true,"db":"ok"}`) before and after every probe |
| Code baseline | `aa48b74` (HEAD at probe time); `git diff aa48b74 HEAD -- server/src` is empty (the only later commit, `3e0e72e`, touches the plan document). All `server/src` mtimes precede the restart |
| Database | `server/.env` `DATABASE_URL` -> `127.0.0.1:5433/myapp_db` (`sslmode=disable`). Local dev DB only |
| Sessions | Dev Supabase project (`omvn****.supabase.co`) from `server/.env`; users minted with the service role (`generateLink` magiclink + `verifyOtp`), the same technique as `server/scripts/verify-live.mjs:76-80` and Phase 4. No account created on production Supabase |
| Fixture addresses | all `t10.*@joblinked-spike.test` |
| Configured server state | `TRUST_PROXY` unset, `TURNSTILE_SECRET_KEY`/`OPENROUTER_API_KEY`/`METRICS_TOKEN` unset |
| Conduct | ~35 requests total (no limiter was driven above ~10% of its window), no destructive payload, no export, no volume test. No pre-existing account or role was modified |
| Secrets | evidence holds no bearer value and no key; only `prefix(len)`-free request/response metadata |

Code read for the probe design (not modified): `routes/auth.js` (provision tag resolution at `:83-89`,
`INVITE_INCOMPLETE` at `:35-36`, audit at `:154`), `routes/admin-users.js` (`grantError` `:94-112`,
invite `:182-267`, custom-role `:271-286`, PATCH `:113-177`, role move `:296+`,
`removesLastBreakGlass` `:87-92`), `routes/admin-reference.js` (`unheldKey` grants `:101-103`,
`editsOwnRole` `:114-123,143`, assignment guard `:145-151`), `middleware/permissions.js`
(`unheldKey` `:27-36`, fail-open branch `:19`).

## 2. Fixtures

| Fixture | Shape (service-role write, then product API) |
|---|---|
| `t10.full` | `app_metadata {role: super-admin, custom_role_id: 99999999}` -> provision 201, stored tag **NULL** (a numeric id that is not a catalogue role resolves to null - the documented defence). Used as the break-glass positive control |
| `t10.target` | `app_metadata {custom_role_id: R1=logs.view}` -> provision 201 |
| `t10.rolesadmin` | `app_metadata {custom_role_id: R2=roles.manage}` -> provision 201 |
| `t10.usersadmin` | `app_metadata {custom_role_id: R3=users.manage}` -> provision 201 |
| `t10.invNoKey` | `app_metadata {role: super-admin}` - **no** `custom_role_id` key (the state every pre-fix invite has), `user_metadata {custom_role_id: R1}` |
| `t10.invNull` | `app_metadata {role: super-admin}` after the invite handler's exact write `{custom_role_id: null}` (GoTrue dropped the null; see P-06d) |
| `t10.invNarrow` | `app_metadata {custom_role_id: R1}`, `user_metadata {custom_role_id: R2}` |
| `t10.chain` | `app_metadata {custom_role_id: R4={users.manage, roles.manage}}` -> provision 201 |
| `t10.chainInvitee` | invite state for the escalation chain: `app_metadata {custom_role_id: R5=empty bundle}` |
| roles R1-R5 | created through `POST /admin/roles` by the break-glass admin: R1 `logs.view`, R2 `roles.manage`, R3 `users.manage`, R4 `users.manage+roles.manage`, R5 `[]` |

The real `POST /admin/users/invite` email path was attempted twice; the dev project answered
`429 RATE_LIMITED` (P-06f) - the upstream cap Phase 4 recorded. The invite **state** was therefore
recreated with the service-role admin API exactly as `admin-users.js:263` writes it, which is the
Phase 4 technique and does not weaken the probe: the state, not the mail, is what provision reads.

---

## 3. G-01 / P-06 - invitee cannot choose its tag

### 3.1 Key absent: three body variants, all refused before any write

| # | Request (masked) | Observed | Expected | Verdict |
|---|---|---|---|---|
| P-06a | `POST /api/auth/provision` `{role:"super-admin", first_name:"T10", last_name:"NoKey", custom_role_id:R1}` with `app_metadata {provider,providers,role}` | **403** `INVITE_INCOMPLETE` "Invite is incomplete. Re-send the invite."; `super_admins` row for the id: **absent** | 403, no row | **PASS** |
| P-06b | same, `custom_role_id` omitted (`user_metadata.custom_role_id` was R1) | **403** `INVITE_INCOMPLETE`; row absent | 403, no row | **PASS** |
| P-06c | same, `custom_role_id:null` in the body | **403** `INVITE_INCOMPLETE`; row absent | 403, no row | **PASS** |

The body value never changes the outcome (three different body shapes, identical response), and
`user_metadata.custom_role_id` (client-writable) is never read.

### 3.2 Narrow metadata tag: body cannot widen it

| # | Request | Observed | Expected | Verdict |
|---|---|---|---|---|
| P-06e | `POST /api/auth/provision` `{role:"super-admin", ..., custom_role_id:R3}` with `app_metadata {role:"super-admin", custom_role_id:R1}` | **201**, response and DB `custom_role_id` = **R1** (`"40"` in this run) - the body's R3 ignored | 201, stored = metadata | **PASS** |
| | `GET /api/admin/audit-logs?limit=1` (the R1 key) | **200** | 200 | **PASS** |
| | `GET /api/admin/users` (not in R1's bundle) | **403** `Your assigned role does not include "users.manage"` | 403 | **PASS** |
| | `GET /api/admin/stats` (not in bundle) | **403**, names `dashboard.view` | 403 | **PASS** |
| | `POST /api/admin/roles` (not in bundle) | **403**, names `roles.manage` | 403 | **PASS** |
| | audit row | `auth.register` details `{"role":"super-admin","custom_role_id":"40"}` | tag recorded | **PASS** |

Task 1's audit requirement is met at runtime: the resolved tag is in the register row.

### 3.3 Explicit `null`: the *state* grants full admin, but the state cannot be produced

| # | Request | Observed | Expected (Task 1 contract) | Verdict |
|---|---|---|---|---|
| - | break-glass fixture: `app_metadata {custom_role_id: 99999999}` (unknown id -> null), provision | **201**, `custom_role_id:null`, then `GET /api/admin/users` **200** | null tag = full admin | **PASS** (null tag does grant full admin) |
| P-06d | `admin.updateUserById(id, {app_metadata:{role:"super-admin", custom_role_id:null}})` - the exact call `admin-users.js:263` makes - then read back, then provision | write error `null`; read-back `app_metadata {provider,providers,role}` - **key absent**; provision **403** `INVITE_INCOMPLETE`; no row | key present with null -> 201 + full admin | **FAIL** (R10-02) |
| P-06f | live `POST /admin/users/invite` `{role:"super-admin", email:t10.real.*, ...}` as the break-glass admin | **429** `RATE_LIMITED` (dev-project email cap; no user created) | 201 and `custom_role_id` present in the invited user's metadata | **BLOCKED** |

Reproduced deterministically with three writes: `createUser({custom_role_id:null})` -> key dropped;
`updateUserById({custom_role_id:null})` -> key dropped; `updateUserById({custom_role_id:99123})` ->
persisted, then `updateUserById({custom_role_id:null})` -> dropped. Supabase GoTrue strips JSON `null`
from `app_metadata`; it never stores a present-null key. **Consequence:** every full-admin invite ends
in the pre-fix shape and its invitee is permanently refused with `INVITE_INCOMPLETE`. That is
fail-closed and does **not** reopen G-01, but the "explicit null = the inviter's full-admin grant" half
of Task 1 is not deliverable, and the unit test that mocks `app_metadata {custom_role_id:null}` pins a
state production cannot reach.

---

## 4. G-02 / P-07 - `roles.manage` cannot widen or delete its own role

Actor: super-admin tagged R2 (`roles.manage` only). Every row is the real HTTP call.

| # | Request | Observed | Expected | Verdict |
|---|---|---|---|---|
| 1 | `GET /api/admin/users` (control) | **403** `does not include "users.manage"` | 403 | **PASS** |
| 2 | `PATCH /api/admin/roles/R2` `{permissions: all nine keys}` | **403** `You cannot edit the role assigned to you` | 403 | **PASS** |
| 3 | `GET /api/admin/users` again | **403** (unchanged) | 403 | **PASS** |
| 4 | `DELETE /api/admin/roles/R2` | **403** `You cannot delete the role assigned to you` | 403 | **PASS** |
| 5 | `GET /api/admin/users` again | **403** - no silent break-glass promotion | 403 | **PASS** |
| 6 | `PATCH /api/admin/roles/R1` `{permissions:["logs.view","users.manage"]}` (another role) | **403** `Your assigned role does not include "logs.view"` (the merged bundle is checked, not the delta) | 403 | **PASS** |
| 7 | `DELETE /api/admin/roles/R1` (another role, still assigned) | **409** `Role is still assigned to 2 account(s); unassign it first` | refuse | **PASS** (409 is the assignment guard; see O-1) |

DB after the run: R2's stored bundle is still `["roles.manage"]` and the caller's tag is still R2.
**Verdict: PASS.** Both Phase 4 vectors (self-widen to nine keys, self-delete -> null tag -> break-glass)
are closed at the guard, before any write.

## 5. G-02 / P-08 - `users.manage` cannot grant full admin

Actor: super-admin tagged R3 (`users.manage` only). Target: another admin tagged R1 (R1 = `logs.view`).

| # | Request | Observed | Expected | Verdict |
|---|---|---|---|---|
| 1 | `GET /api/admin/roles` (control; catalogue read is intentional for the Users page) | **200** | 200 | **PASS** |
| 2 | `GET /api/admin/users` (control; `users.manage` owns this route) | **200** | 200 | **PASS** |
| 3 | `POST /api/admin/roles` (control) | **403** `does not include "roles.manage"` | 403 | **PASS** |
| 4 | `POST /api/admin/users/{target}/custom-role` `{custom_role_id:null}` | **403** `Only a full admin can grant full admin access` | 403 | **PASS** |
| 5 | `PATCH /api/admin/users/{target}` `{custom_role_id:null}` | **403** `Only a full admin can grant full admin access` | 403 | **PASS** |
| 6 | `POST /api/admin/users/{target}/custom-role` `{custom_role_id:R2}` (unheld key) | **403** `does not include "roles.manage"` | 403 | **PASS** |
| 7 | `POST /api/admin/users/invite` `{role:"super-admin", email:t10.nope.*, ...}` (no tag = full admin) | **403** `Only a full admin can invite an admin without a custom role` | 403 | **PASS** |
| 8 | `POST /api/admin/users/invite` `{role:"super-admin", custom_role_id:R2, ...}` | **403** `does not include "roles.manage"` | 403 | **PASS** |

DB after the run: the target's tag is still R1 and the target still gets **403** on
`GET /api/admin/users`. Both Phase 4 P-08 vectors are closed at the guard.
**Verdict: PASS.**

## 6. P-08b - G-02 residual: two delegated keys mint a break-glass admin (FAIL)

Actor: super-admin tagged R4 = `{users.manage, roles.manage}` - a plausible "User & Role Admin" bundle.
No key in that bundle is a full-admin grant, and both were closed individually above.

| # | Request | Observed | Expected | Verdict |
|---|---|---|---|---|
| 1 | `POST /api/admin/roles` `{name:"t10 empty", base_role:"super-admin", permissions:[]}` | **201** - an empty bundle is a subset of anything, so `unheldKey` passes | 201 (allowed) | (setup) |
| 2 | `POST /api/admin/users/invite` `{role:"super-admin", custom_role_id:R5, email:t10.chaininvitee.*}` | **429 `RATE_LIMITED`** (dev-project email cap). With a working mailer this is 201: every authorization guard passes (`customRoleId` is non-null, bundle empty) | 201 | **BLOCKED** (upstream) |
| - | invite state recreated exactly as the handler writes it (`admin-users.js:263`): `app_metadata {role:"super-admin", custom_role_id:R5}` | key present (`"44"`) | - | (setup) |
| 3 | `DELETE /api/admin/roles/R5` (invited role, no account rows yet) | **200** - the assignment guard sees 0 references | refuse before accept | **FAIL** |
| 4 | invitee `POST /api/auth/provision` `{role:"super-admin", ...}` | **201**, `custom_role_id:null` (`auth.js:83-89`: a numeric tag that no longer resolves leaves `customRoleId = null`) | 403 (a stale grant is not a full-admin grant) | **FAIL** |
| 5 | invitee `GET /api/admin/users` | **200** - full break-glass admin | 403 | **FAIL** |

**Root cause (one line):** `server/src/routes/auth.js:83-89` maps "key present and numeric but not in
`reference_data`" to `null`, and `null` is break-glass. The absent-key case fails closed (`:35-36`); the
unresolvable-key case fails **open**. The delete-time guard (`admin-roles` `:145-151`) only counts rows
that exist, so a role named by a pending invite is invisible to it.

The chain needs either one bundle holding both management keys or two cooperating tagged admins
(`users.manage` invites, `roles.manage` deletes). Neither key may grant full admin under the Task 3
decision, so the outcome violates G-02's ceiling. It is not an invitee-side choice - the invitee stays
passive - which is why this does not reopen G-01.

**Verdict: VULNERABLE (High).** Recommend `403 INVITE_INCOMPLETE` when `custom_role_id` is present,
non-null, and does not resolve to a `custom_role` row (treat it exactly like the absent key), and/or
refuse deleting a role referenced by a pending invite (no row exists to count - a sentinel column or an
`app_metadata` scan would be needed; the 403 is the cheaper fix). Retest this probe after.

## 7. G-07 - last break-glass lockout guard

| Check | Result |
|---|---|
| Guard present | `admin-users.js:87-92` (`removesLastBreakGlass`), called from PATCH `:159-163`, custom-role `:277-280`, role move `:304-307`. Message: "This would remove the last full admin. Assign another full admin first." |
| Live reachability | **BLOCKED**: the guard fires only when the target is the last **active** super-admin with `custom_role_id IS NULL`. This dev DB holds 5 pre-existing active break-glass admins (plus the fixture during the run), so `count(*) where id <> target` is never 0. Reaching 409 would require suspending/demoting pre-existing accounts, which the ROE forbids |
| Evidence available instead | `aa48b74` ships `server/src/__tests__/admin-delegation.test.js` covering the guard; this run did not execute it (test suite ownership is Task 4/10's `npm test` item) |

**Verdict: present, not live-proven.** Does not affect the G-01/G-02 closure statements.

## 8. Positive path - a full break-glass admin still works

Actor: `t10.full` (tag NULL).

| Request | Observed | Expected | Verdict |
|---|---|---|---|
| `GET /api/admin/users` | **200** | 200 | **PASS** |
| `PATCH /api/admin/roles/R1` `{permissions:["logs.view","reports.view"]}` | **200** | 200 | **PASS** |
| `POST /api/admin/users/{target}/custom-role` `{custom_role_id:R2}` | **200** | 200 | **PASS** |
| `PATCH /api/admin/users/{target}` `{custom_role_id:R1}` (restore) | **200**, tag back to R1 | 200 | **PASS** |

The ceiling rules do not block the intended break-glass behaviour.

---

## 9. Findings raised by this run

| ID | Severity | Where | Issue | Fix |
|---|---|---|---|---|
| **R10-01** | **High** (G-02) | `routes/auth.js:83-89`; `routes/admin-reference.js:145-151` | An `app_metadata.custom_role_id` that is present and numeric but no longer resolves becomes `NULL`, i.e. break-glass. A `{users.manage, roles.manage}` admin can create an empty-bundle role, invite a super-admin with it, delete the role (0 rows reference it yet), and the invitee provisions as a full admin. Proven live (P-08b steps 3-5) | Fail closed on an unresolvable non-null tag: `403 INVITE_INCOMPLETE` (same as the absent key). Optionally refuse deleting a role named by a pending invite |
| **R10-02** | Medium (functional, fail-closed) | `admin-users.js:263`; contract in Task 1 | Supabase GoTrue strips JSON `null` from `app_metadata`, so the explicit-null full-admin grant cannot be written. Every full-admin invite ends with no key and its invitee is permanently `403 INVITE_INCOMPLETE`; new break-glass admins cannot be minted through the invite flow. The Task 1 unit test mocks a state the platform cannot produce | Encode the full-admin grant with a sentinel the platform keeps (e.g. `custom_role_id: 0`, or a separate `admin_grant: "full"` key), keep "key absent" = `INVITE_INCOMPLETE`, and make the test go through the same encoder |
| O-1 | Info | `admin-reference.js:150-152` | `DELETE /admin/roles/:id` answers `409 Role is still assigned to N account(s)` to a `roles.manage`-only holder, who cannot list users - a small assignment-count disclosure. Harmless; the delete is refused, which is the control that matters | Accept, or return the generic 403 message |

## 10. Verdict table and closure

| Probe | Finding | Verdict |
|---|---|---|
| P-06a/b/c - key absent, 3 body shapes | G-01 | **PASS** (403 `INVITE_INCOMPLETE`, no row) |
| P-06e - narrow tag, body tries to widen | G-01 | **PASS** (stored tag = metadata, 403 on two unheld routes, tag in audit) |
| P-06 break-glass fixture - null tag -> full admin | G-01 | **PASS** (201 null, `GET /admin/users` 200) |
| P-06d - explicit null written as the handler does | G-01 | **FAIL** -> R10-02 (fail-closed; no escalation) |
| P-06f - live invite | - | **BLOCKED** (429, upstream email cap) |
| P-07 - self-widen, self-delete, superset | G-02 | **PASS** (7/7 refused, bundle and tag unchanged) |
| P-08 - clear another admin's tag, full-admin invite | G-02 | **PASS** (8/8 403, target unchanged) |
| P-08b - empty-bundle invite + delete + stale tag | G-02 | **FAIL** -> R10-01 (break-glass minted, 200 on `/admin/users`) |
| G-07 - last break-glass | G-07 | **BLOCKED** (not reachable in this DB) |
| Sanity - full admin | - | **PASS** (4/4 200) |

### G-01: **CLOSED**

Evidence: P-06a/P-06b/P-06c returned `403 INVITE_INCOMPLETE` with no `super_admins` row for three
different body shapes while `user_metadata.custom_role_id` was set; P-06e provisioned with the
`app_metadata` tag (`R1`) and not the body tag (`R3`), then got `200` on its own route and `403` on
`/admin/users`, `/admin/stats`, and role creation, with the resolved tag recorded in `auth.register`.
The invitee can no longer choose, widen, or clear its tag. R10-02 is an availability defect on the
full-admin grant, not an escalation: it fails to 403.

### G-02: **NOT CLOSED**

Evidence: P-07 (7/7 refusals) and P-08 (every grant attempt refused) are closed - self-widen,
self-delete, tag-clearing, and both full-admin invite forms all return 403 with the audit responses
shown above. But **P-08b** proves a live escalation the ceiling does not cover: an admin holding
`users.manage` + `roles.manage` created an
empty-bundle role (201), invited a super-admin with it, deleted the role before accept (200), and the
invitee provisioned with `custom_role_id NULL` (201) and read `GET /admin/users` (**200**). The only
step not exercised end-to-end is the invite email itself (dev-project `429`); the metadata state was
reproduced exactly as `admin-users.js:263` writes it. R10-01 (treat an unresolvable non-null tag as
`INVITE_INCOMPLETE`) closes it; retest P-08b after the change.

## 11. Fixture cleanup

| Check | Baseline (before) | After | |
|---|---|---|---|
| `super_admins` | 5 | **5** | restored |
| `job_seekers` | 103 | **103** | untouched |
| `employers` | 53 | **53** | untouched |
| `custom_role` rows | 1 | **1** | restored |
| `resumes` | 2 | **2** | untouched |
| `job_vacancies` | 102 | **102** | untouched |
| `notifications` | 2726 | **2726** | untouched |
| `audit_logs` | 2869 | **2903** | **+34 retained on purpose** (append-only audit trail: `auth.register` 16, `role.create` 11, `role.update` 2, `role.delete` 1, `user.custom-role.assign` 2, `user.update` 2) |
| Rows with `t10.*@joblinked-spike.test` | - | **0** in `super_admins`, `job_seekers`, `employers` | verified by query |
| Roles named `t10 %` | - | **0** | verified by query |
| Dev-Supabase users `t10.*` | - | **none** (6-page `listUsers` scan) | verified |

Deleted: 9 Supabase users and their `super_admins` rows, 5 custom roles (`40-44`), the per-run fixtures.
`audit_logs` rows were kept - they are the system's record of an authorized test, not fixtures.
The API is left running (PID **28620**, health 200) on port 4000.

## 12. Evidence log

| Item | Value |
|---|---|
| API restart | old child PID 35148 stopped; watcher respawned PID 28620 at 2026-11-13 04:56:43 (local) |
| Probe run (`evidence.json`) | 2026-11-13 04:56-04:58 (local), 35 requests |
| Cleanup verification | post-run query + `listUsers` scan, table in A11 |
| Raw evidence | `%TEMP%\t10\evidence.json` (masked requests/responses; no tokens) |
| Code baseline | `aa48b74` + `3e0e72e` (docs only); no `server/src` change since `aa48b74` |
