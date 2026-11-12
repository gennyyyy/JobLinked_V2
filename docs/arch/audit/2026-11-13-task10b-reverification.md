# Task 10b - final live re-verification of R10-01 and R10-02 (G-02), 2026-11-13

**Project:** JobLinked / PESO Santa Maria - Express API + PostgreSQL (Supabase auth only)
**Plan:** `docs/plan/2026-11-13-security-fixes.md` - Task 1 amendment (2026-11-13, sentinel `custom_role_id: 0`)
and Task 10b closure of the two findings raised by Task 10
**Fix under test:** `c3de5b6` "Fail closed on unresolvable invite tag" (HEAD)
**Baseline evidence:** `2026-11-13-task10-reverification.md` (R10-01 = live escalation; R10-02 = GoTrue strips
`null`, full-admin grant unwritable), `2026-11-13-admin-guard-matrix.md`, `2026-11-13-phase4-probes.md`
**Agent:** penetration-tester
**Mode:** authorized active testing, **local instance only**. No product code, test, or `db/schema.sql`
change (`git status --porcelain server/src` empty, `git diff c3de5b6 -- server/src` empty). Production node,
production Supabase project, and any remote database were never contacted.
**Evidence:** `%TEMP%\t10b\evidence.json` (ephemeral, outside the repo); tokens were never written.

## Verdict

| Finding | Status after this run | Basis |
|---|---|---|
| **R10-01** (unresolvable invite tag became break-glass) | **CLOSED** | The exact escalation chain was replayed: `{users.manage, roles.manage}` admin created an empty-bundle role (201), invited a super-admin with it, deleted it before accept (200), then provisioned with `app_metadata.custom_role_id` = the deleted id -> **403 `INVITE_INCOMPLETE`**, no `super_admins` row, `GET /admin/users` **403**. Pre-fix this returned 201 + 200. |
| **R10-02** (full-admin grant unrepresentable) | **CLOSED** | The `0` sentinel survives both the platform write and provision: stored `app_metadata.custom_role_id: 0` (create and update), provision **201** with stored `custom_role_id NULL`, `GET /admin/users` **200**. The intended break-glass invitee is mintable again, and the sentinel is not a grant for seekers. |
| **P-06 regression** (G-01 invitee cannot choose its tag) | **PASS** | Key absent -> 403 (even with body `0`); narrow metadata tag stays narrow (200 own route, 403 `/admin/users`, 403 role create); body tag ignored in every case including the sentinel; resolved tag recorded in `auth.register`. |

**Gate consequence:** G-01 stays closed, and **G-02 is now evidenced closed**. Nothing in this report
re-opens a guard proven in Task 10 (P-07, P-08 unchanged, no code path to them was altered by `c3de5b6`).

---

## 1. Environment and method

| Item | Value |
|---|---|
| Target | `http://127.0.0.1:4000` - local API restarted for this task |
| Restart | Pre-fix child **PID 35248** (started 05:11:15) stopped; its `scripts/dev.mjs` watcher (PID 26688, the `dev:api` runner under `npm run dev`) respawned it. New API PID **31392**, started 05:15:02. `GET /api/health` -> **200** (`{"ok":true,"db":"ok"}`) before the run and after it |
| Code baseline | HEAD `c3de5b6`; `server/src` clean against it (no working-tree change, no later commit) |
| Database | `server/.env` `DATABASE_URL` -> `127.0.0.1:5433/myapp_db` (`sslmode=disable`); the harness refuses any non-loopback host |
| Sessions | Dev Supabase project (`omvn****.supabase.co`, masked) from `server/.env`; users minted with the service role (`generateLink` magiclink + `verifyOtp`, the `verify-live.mjs:76-80` technique). No production account was touched |
| Fixture addresses | all `t10b.*@joblinked-spike.test` |
| Invite state | The real `POST /admin/users/invite` answered **429 `RATE_LIMITED`** for both attempts (the dev-project email cap Phase 4/Task 10 recorded; no user created). The invite **state** was therefore written with the service-role admin API in the same shape the handler writes (`admin-users.js:263-264`). This is the Phase 4/Task 10 technique and does not weaken the probe: provision reads the state, not the mail |
| Conduct | 15 probes, ~28 HTTP requests; no limiter pushed past ~10% of a window; no destructive payload, no export, no volume test; no pre-existing account, role, or row modified |
| Secrets | evidence holds no bearer value and no key; only request/response status, error code, and fixture metadata |

Code read for the probe design (not modified): `routes/auth.js:84-97` (fail-closed tag resolution),
`routes/admin-users.js:263-264` (`customRoleId ?? 0`), `admin-reference.js:98-160` (role create/delete and
the assignment-count guard), `middleware/permissions.js:20-24` (`unheldKey`), `auth.js:104-126` (principal).

## 2. Fixtures

| Fixture | Shape (service-role write, then product API) |
|---|---|
| roles `t10b chain` = **51** `{users.manage, roles.manage}`, `t10b narrow` = **52** `{logs.view}`, `t10b empty` = **53** `[]` | created through `POST /admin/roles` |
| `t10b.full` | `app_metadata {role: super-admin, custom_role_id: 0}` -> provision 201, stored tag **NULL** (the sentinel is the break-glass grant) |
| `t10b.chain` | `app_metadata {custom_role_id: 51}` -> provision 201, tag 51 |
| `t10b.stale` | `app_metadata {role: super-admin, custom_role_id: 53}` written before role 53 was deleted |
| `t10b.sentinel` | `app_metadata {role: super-admin, custom_role_id: 0}` (handler-equivalent write of the full-admin invite) |
| `t10b.nokey` | `app_metadata {role: super-admin}` - no `custom_role_id` key |
| `t10b.narrow` | `app_metadata {custom_role_id: 52}`, provision body tries `custom_role_id: 51` |
| `t10b.unknown` / `t10b.nonnum` | `custom_role_id: 99999999` / `"stale"` |
| `t10b.seeker` | `custom_role_id: 0` on a job-seeker invite (what the new handler writes for every invite) |

## 3. R10-01 - the escalation chain, replayed

Actor: `t10b.chain`, super-admin tagged **51** (`users.manage` + `roles.manage`). Every row is a real HTTP
call; `Authorization: Bearer <token>` elided.

| # | Request (masked) | Observed | Expected | Verdict |
|---|---|---|---|---|
| P-01.1 | `POST /api/admin/roles` `{"name":"t10b empty","base_role":"super-admin","permissions":[]}` | **201** (role **53**) | 201 (empty bundle is a subset of anything) | **PASS** |
| P-01.2 | `POST /api/admin/users/invite` `{"role":"super-admin","email":"t10b.stale@...","custom_role_id":53}` | **429 `RATE_LIMITED`** (no user created). State written directly: `app_metadata {"role":"super-admin","custom_role_id":"53"}` | handler-equivalent invite state | **PASS** (state, upstream blocked - as in Task 10) |
| P-01.3 | `DELETE /api/admin/roles/53` (before accept) | **200**; role row gone. The pending invite is invisible to the assignment-count guard, so the delete still succeeds - by design, the fix is at provision | 200 | **PASS** (setup step) |
| P-01.4 | `POST /api/auth/provision` `{"role":"super-admin","first_name":"T10B","last_name":"Stale","custom_role_id":52}` with `app_metadata.custom_role_id = 53` | **403 `INVITE_INCOMPLETE`** "Invite is incomplete. Re-send the invite."; `super_admins` row for the id: **absent**; no `auth.register` audit row | 403, no row | **PASS** (pre-fix: **201** + break-glass) |
| P-01.5 | `GET /api/admin/users` as that invitee | **403 `FORBIDDEN`** ("Account not provisioned") | 403 | **PASS** (pre-fix: **200**) |

The escalating step is now the same fail-closed answer as a pre-fix invite with no key. The body tag
(`52`) could not rescue the stale grant, and nothing was inserted.

## 4. R10-02 - the sentinel grant

Actor: `t10b.full` (break-glass, no custom role).

| # | Request (masked) | Observed | Expected | Verdict |
|---|---|---|---|---|
| P-02a | `app_metadata {role:"super-admin", custom_role_id:0}` (create), then `POST /api/auth/provision {"role":"super-admin", ...}` | **201**, stored `custom_role_id` **null** | 201, null | **PASS** |
| P-02b | `GET /api/admin/users` as P-02a | **200** | 200 | **PASS** |
| P-02.1 | `POST /api/admin/users/invite` `{"role":"super-admin","email":"t10b.sentinel@..."}` (no tag = full admin) | **429 `RATE_LIMITED`** (upstream cap). Handler-equivalent write `updateUserById(id,{app_metadata:{role:"super-admin", custom_role_id:0}})`: no error, read-back `{"custom_role_id":0,...}` - **the platform keeps `0`** (it stripped `null` in Task 10) | key present with `0` | **PASS** (live handler path blocked upstream; the write it performs is proven) |
| P-02.2 | `POST /api/auth/provision` `{"role":"super-admin", ..., "custom_role_id":52}` with `app_metadata.custom_role_id = 0` | **201**, stored `custom_role_id` **NULL** (body decoy ignored) | 201, null | **PASS** |
| P-02.3 | `GET /api/admin/users` as P-02.2 | **200** | 200 | **PASS** |

R10-02 is a functional finding, not an escalation: pre-fix this invitee was permanently 403. The amended
Task 1 contract ("explicit `0` = the inviter's full-admin grant") is now deliverable end-to-end, except for
the mail send that the dev project refuses.

## 5. P-06 regression - the invitee still cannot choose its tag

| # | Request (masked) | Observed | Expected | Verdict |
|---|---|---|---|---|
| P-03a | `POST /api/auth/provision` `{"role":"super-admin", ..., "custom_role_id":0}` with `app_metadata {role:"super-admin"}` (no tag key) | **403 `INVITE_INCOMPLETE`**; no row; body `0` did not restore the grant | 403, no row | **PASS** |
| P-03b | `POST /api/auth/provision` `{"role":"super-admin", ..., "custom_role_id":51}` with `app_metadata.custom_role_id = 52` | **201**, stored tag **52** (metadata wins) | 201, stored = metadata | **PASS** |
| P-03c | as P-03b: `GET /api/admin/audit-logs?limit=1`, `GET /api/admin/users`, `POST /api/admin/roles` | **200**; **403**; **403** | 200; 403; 403 | **PASS** |
| P-03d | `app_metadata.custom_role_id = 99999999` (the Task 10 break-glass fixture), provision | **403 `INVITE_INCOMPLETE`**; no row; `/admin/users` **403** | 403, no row | **PASS** - the exact pre-fix fail-open is inverted |
| P-03e | `app_metadata.custom_role_id = "stale"` (non-numeric), provision | **403 `INVITE_INCOMPLETE`**; no row; `/admin/users` **403** | 403, no row | **PASS** |
| P-03f | audit row for P-03b | `auth.register` details `{"role":"super-admin","custom_role_id":"52"}` | tag recorded | **PASS** |

## 6. Regression - the sentinel on a non-admin invite

The handler now writes `custom_role_id: 0` for **every** invite, including seekers and employers, so `0`
must mean "no tag" outside the admin flow too.

| # | Request | Observed | Expected | Verdict |
|---|---|---|---|---|
| P-04 | `app_metadata {custom_role_id: 0}`; `POST /api/auth/provision {"role":"job-seeker", ...}` | **201**, stored `custom_role_id` **null** | 201, null | **PASS** |

No regression: a `0` tag on a non-admin invite is a plain untagged account, not a broken grant and not a
`403`.

## 7. Observations and residuals

| ID | Note |
|---|---|
| O-10b-1 | `DELETE /admin/roles/:id` still answers **200** for a role named only by a pending invite (P-01.3). Harmless now - the stale tag fails closed at provision - but the assignment-count guard cannot see pending invites. If the invariant "a role the platform may still resolve must exist until its invitee accepts" is wanted, it needs a sentinel column or an `app_metadata` scan; the plan deliberately chose the cheaper 403 (Task 10 recommendation). Record as a known ceiling, not a defect |
| O-10b-2 | The real invite mail path is unreachable in this dev project (**429**, project email cap), so the handler's `?? 0` write is covered by code read + the `c3de5b6` unit test + a live platform-level proof that `0` survives `updateUserById`; the provisioning half is live-proven. A production/preview invite smoke test remains the only unexercised step, and it is outside this ROE |
| O-10b-3 | Task 10's break-glass fixture (`custom_role_id: 99999999` -> null) no longer works. Any script or runbook that minted a full admin that way must use the `0` sentinel (`P-03d` is the evidence) |

## 8. Verdict table

| Probe | Finding | Verdict |
|---|---|---|
| P-01.1..P-01.5 - create empty role, invite, delete, stale tag | R10-01 / G-02 | **PASS** (403 `INVITE_INCOMPLETE`, no row, 403 on `/admin/users`) |
| P-02a/P-02b - sentinel fixture provisions and is full admin | R10-02 | **PASS** |
| P-02.1 - `0` survives the platform write | R10-02 | **PASS** (real invite route 429 upstream) |
| P-02.2/P-02.3 - sentinel provision + full admin | R10-02 | **PASS** |
| P-03a - key absent, body `0` | G-01 regression | **PASS** |
| P-03b/P-03c - narrow tag, wider body tag | G-01 regression | **PASS** |
| P-03d/P-03e - unresolvable numeric / non-numeric tag | R10-01 | **PASS** (fail closed) |
| P-03f - audit carries the tag | Task 1 audit | **PASS** |
| P-04 - sentinel on a seeker invite | R10-02 regression | **PASS** |

### G-02: **CLOSED**

Evidence, in one chain: a super-admin holding only `users.manage` + `roles.manage` created an empty-bundle
super-admin role (**201**), invited a super-admin tagged with it, deleted the role before accept
(**200** - nothing references it yet), and the invitee then provisioned with
`app_metadata.custom_role_id = 53` (the deleted id): **403 `INVITE_INCOMPLETE`**, **no** `super_admins` row,
`GET /admin/users` **403**. Under `aa48b74` those last three answers were 201, a row, and 200. The
fail-open branch (`auth.js:83-89` mapping an unresolvable numeric tag to `null`) is gone: `c3de5b6` returns
the same 403 for absent, unresolvable, and non-numeric tags, while `0` is the only value that encodes the
break-glass grant - live-proven to provision a full admin (201/null/200) so the legitimate recovery path is
intact. Task 10's P-07/P-08 refusals are untouched by the change and were not re-run.

**G-02 CLOSED**

## 9. Fixture cleanup

| Check | Baseline (before) | After | |
|---|---|---|---|
| `super_admins` | 5 | **5** | restored |
| `job_seekers` | 103 | **103** | restored |
| `employers` | 53 | **53** | restored |
| `resumes` | 2 | **2** | untouched |
| `job_vacancies` | 102 | **102** | untouched |
| `notifications` | 2726 | **2726** | untouched |
| `custom_role` rows | 1 | **1** | restored (`t10b chain` 51, `t10b narrow` 52, `t10b empty` 53 deleted) |
| `audit_logs` | 2919 | **2928** | **+9 retained on purpose** (append-only): `role.create` 3, `role.delete` 1, `auth.register` 5. Two earlier dry runs of the same harness added the other 16 since Task 10's 2903; audit is never trimmed |
| Rows with `t10b.*@joblinked-spike.test` | - | **0** across `super_admins`, `job_seekers`, `employers`; **0** roles named `t10b %` | verified by query |
| Dev-Supabase users `t10b.*` | - | **none** (`listUsers` scan) | verified |

Deleted: 7 dev-Supabase users, their role rows, and the 3 custom roles. No pre-existing account, role, or
row was touched. `audit_logs` were kept. The API is left running (PID **31392**, health 200) on port 4000.

## 10. Evidence log

| Item | Value |
|---|---|
| API restart | pre-fix child PID 35248 stopped; watcher PID 26688 respawned PID 31392 at 2026-11-13 05:15:02 (local) |
| Probe run (`evidence.json`) | 2026-11-13 05:19:50-05:20:08 (local), 15 probes, verdict PASS |
| Roles used | 51 `t10b chain`, 52 `t10b narrow`, 53 `t10b empty` (created + deleted in-run) |
| Audit rows produced | 3128-3136 (`auth.register` 3128/3131/3134/3135/3136, `role.create` 3129/3130/3132, `role.delete` 3133) |
| Raw evidence | `%TEMP%\t10b\evidence.json` (masked requests/responses; no tokens) |
| Cleanup verification | post-run counts + `t10b.%` row queries + `listUsers` scan |
| Code baseline | `c3de5b6`, `server/src` clean |

---

**G-02 CLOSED**
