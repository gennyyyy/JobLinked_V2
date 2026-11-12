# Admin guard matrix — Phase 1 item 2 (deep pass), 2026-11-13

**Scope:** `server/src/routes/{admin,admin-users,admin-jobs,admin-reference,admin-shared}.js` plus the
one admin-prefixed route that lives outside the split (`routes/reports.js`), and the custom-role
placement seam in `routes/auth.js` / `auth.js` / `middleware/permissions.js`.
**Mode:** read-only static review. No product code, test, or `db/schema.sql` change. No live probes,
no server started, no remote database contacted. One existing mock-based unit test executed
(`permission-enforcement.test.js`, 7/7 passing) — it mounts the real routers with a mocked pool and a
mocked principal, so it proves wiring, not database behaviour.
**Plan:** `docs/plan/2026-11-13-security-delta-audit.md` §Phase 1 item 2 (unchanged by the Phase 5
insertion; report phase is now Phase 6). Prior baseline: `docs/arch/audit/phase5-security-audit.md`
§"Verified secure — Auth & authorization".
**Finding prefix:** `G-` (this file only; the architect merges).

## Verdict

**FAIL — blocking: G-01.**
One unmitigated High (G-01, privilege escalation: an invitee sets its own `custom_role_id` and can
take the break-glass path). No Critical. G-02 is a Medium design ceiling that needs an ADR amendment
or a "cannot grant what you lack" rule. Everything else is Low/Info (assurance and hygiene).

---

## 1. Guard matrix — all 30 admin routes

Chains are defined once per file and spread onto each route; the spread order is the execution order
(Express middleware arrays run left to right). Every route below was read, not sampled.

Legend: `auth` = `auth.js:104`; `role` = `requireRole('super-admin')` (`auth.js:139`);
`perm` = `requirePermission(...)` (`middleware/permissions.js:15`).
Ownership column: the admin surface is cross-tenant **by design** (a super-admin reads all tenants), so
"n/a" means "no owner/tenant guard is expected here"; the column records the guard that exists instead.
`company_id` is never accepted from a request body on any of these routes — see §3.

| # | Method | Route | auth | role | perm key(s) | Ownership / tenant / other guard | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/admin/stats` | ✓ | ✓ | `dashboard.view` (`admin.js:12`) | n/a — aggregate counts | PASS |
| 2 | GET | `/admin/companies` | ✓ | ✓ | `dashboard.view` | n/a; field narrowing: full row only for break-glass or `users.manage` (`admin.js:70-71`) | PASS |
| 3 | GET | `/admin/applications` | ✓ | ✓ | `dashboard.view` | n/a — cross-tenant listing | PASS (see G-06) |
| 4 | GET | `/admin/employees` | ✓ | ✓ | `dashboard.view` | n/a — cross-tenant listing | PASS (see G-06) |
| 5 | GET | `/admin/referrals` | ✓ | ✓ | `dashboard.view` | n/a — cross-tenant listing | PASS (see G-06) |
| 6 | GET | `/admin/accreditations` | ✓ | ✓ | `accreditation.manage` (`admin.js:13`) | n/a | PASS |
| 7 | GET | `/admin/audit-logs` | ✓ | ✓ | `logs.view` (`admin.js:14`) | n/a | PASS |
| 8 | GET | `/admin/seekers/:id/education` | ✓ | ✓ | `dashboard.view` | 404 on non-uuid (`admin.js:210`); no existence oracle (missing id → `[]`) | PASS |
| 9 | GET | `/admin/seekers/:id/experience` | ✓ | ✓ | `dashboard.view` | same helper (`admin.js:215`) | PASS |
| 10 | GET | `/admin/seekers/:id/employment` | ✓ | ✓ | `dashboard.view` | same helper (`admin.js:216`) | PASS |
| 11 | GET | `/admin/seekers/:id/resumes` | ✓ | ✓ | `dashboard.view` | same helper (`admin.js:220`) | PASS |
| 12 | POST | `/admin/system-notifications` | ✓ | ✓ | `notifications.send` (`admin.js:15`) | n/a; explicit field picking + length caps (`admin.js:228-232`) | PASS |
| 13 | GET | `/admin/users` | ✓ | ✓ | `users.manage` (`admin-users.js:10`) | n/a | PASS |
| 14 | PATCH | `/admin/users/:id` | ✓ | ✓ | `users.manage` | self-guard on `status`/`custom_role_id` (`:87`); `EDITABLE` allowlist (`:112-115`); 404 on unknown (`:98`) | PASS |
| 15 | POST | `/admin/users/invite` | ✓ | ✓ | `users.manage` | 409 on duplicate email (`:178`); role↔custom-role base-role agreement (`:163-165`) | PASS (see G-02) |
| 16 | POST | `/admin/users/:id/custom-role` | ✓ | ✓ | `users.manage` | self-guard (`:222`); 404 (`:224`); target role must exist in catalog (`:226-230`) | PASS |
| 17 | POST | `/admin/users/:id/role` | ✓ | ✓ | `users.manage` | self-guard (`:248`); 404 (`:252`); transactional move (`:255-261`) | PASS (see G-07) |
| 18 | GET | `/admin/jobs` | ✓ | ✓ | `jobs.manage` (`admin-jobs.js:9`) | n/a | PASS |
| 19 | PATCH | `/admin/jobs/:id` | ✓ | ✓ | `jobs.manage` | 404 non-uuid + 404 missing (`:47-49`); `ADMIN_JOB_COLS` allowlist, no `company_id` (`:31-32`) | PASS |
| 20 | POST | `/admin/jobs/:id/publish` | ✓ | ✓ | `jobs.manage` | 404s (`:103-105`); transactional status + history (`:107-114`) | PASS |
| 21 | POST | `/admin/jobs/:id/unpublish` | ✓ | ✓ | `jobs.manage` | same helper (`:122`) | PASS |
| 22 | GET | `/admin/reference/:category` | ✓ | ✓ | `settings.manage` (`admin-reference.js:14`) | n/a; parameterized category | PASS (see O-2) |
| 23 | POST | `/admin/reference/:category` | ✓ | ✓ | `settings.manage` | `custom_role` category refused (`:24`); only `value`/`sort_order` written (`:23-29`) | PASS |
| 24 | GET | `/admin/permissions` | ✓ | ✓ | `roles.manage` \| `users.manage` (`:12`) | n/a — static catalog | PASS (see O-1) |
| 25 | GET | `/admin/roles` | ✓ | ✓ | `roles.manage` \| `users.manage` | n/a | PASS |
| 26 | POST | `/admin/roles` | ✓ | ✓ | `roles.manage` (`:13`) | permission keys filtered to catalog (`:76`); name uniqueness (`:102`) | PASS |
| 27 | PATCH | `/admin/roles/:id` | ✓ | ✓ | `roles.manage` | numeric-id check (`:113`); 404 (`:116`); re-validated merge (`:117`) | PASS (see G-02) |
| 28 | DELETE | `/admin/roles/:id` | ✓ | ✓ | `roles.manage` | numeric-id check (`:129`); 404 (`:132`); nulls assignments first (`:133-136`) | PASS (see G-02) |
| 29 | DELETE | `/admin/reference/:id` | ✓ | ✓ | `settings.manage` | numeric-id check (`:142`); 404 (`:144`); inline `roles.manage` gate for `custom_role` rows (`:146-149`) | PASS (see G-05) |
| 30 | GET | `/admin/reports/:type/export` | ✓ | ✓ | `reports.view` (`reports.js:8`) | type allowlist (`:104,109`); format pinned to csv (`:110`) | PASS |

Checks applied to every row:

- **Ordering invariant.** Every chain is `[auth, requireRole('super-admin'), requirePermission(...)]`
  (`admin.js:10-15`, `admin-users.js:10`, `admin-jobs.js:9`, `admin-reference.js:9-14`,
  `reports.js:8`). `requirePermission` itself re-asserts both preconditions
  (`permissions.js:17-18`), so an ordering mistake in a future chain still fails closed for
  non-admins. **No route in this surface is missing a permission gate.**
- **Key→endpoint mapping matches ADR-042 §"Key → endpoint mapping" exactly**: 9 `dashboard.view`,
  1 `accreditation.manage`, 4 `jobs.manage`, 5 `users.manage`, 5 `roles.manage`(+`users.manage` on
  reads), 1 `reports.view`, 1 `logs.view`, 1 `notifications.send`, 3 `settings.manage` = 30 routes
  (`docs/arch/adr-042-custom-role-permission-enforcement.md:41-54`). No undocumented admin endpoint
  exists (`Select-String` for `'/admin` across `server/src` returns only these five files + tests).
- **Keys are never client-supplied.** All ten `requirePermission(...)` call sites pass string literals
  at module load (`admin-jobs.js:9`, `admin-reference.js:12-14`, `admin-users.js:10`, `admin.js:12-15`,
  `reports.js:8`); there is no `requirePermission(req...)` form. `req.user` is only ever assigned in
  `auth.js:96,124,134,151` from `principalOf()` (`auth.js:53-62`), never from a body.
- **Mass assignment.** `PATCH /admin/users/:id` iterates an explicit `EDITABLE` set (`admin-users.js:112-115`);
  `PATCH /admin/jobs/:id` iterates `ADMIN_JOB_COLS` (`admin-jobs.js:31-32,52`); invite builds its metadata
  object literally (`admin-users.js:181-187`); role writes re-validate `name/description/permissions/base_role`
  and persist only those four keys (`admin-reference.js:72-77,107,123`).

---

## 2. Fail-open branch review (`middleware/permissions.js:19`)

The plan asks four questions. Answers, each with evidence:

1. **Is "no custom role → full access" documented break-glass intent?** Yes. `permissions.js:3-14`
   states the rule and names it break-glass; ADR-042:19-23 ("A custom role is an allow-list … a
   super-admin **without** `custom_role_id` keeps full access … this is the break-glass path, so at
   least one such account must always exist") and ADR-042:34-36 repeat it. The UI and ops runbook
   consequence is recorded at ADR-042:60-62.
2. **Does production always resolve the field?** Yes, by construction on the authenticated path:
   `resolveRole` always returns `custom_role_id` (from the role-table row) and `permissions`
   (`auth.js:40-48`), and `principalOf` always sets both on `req.user`
   (`auth.js:59-60`). `tokenAuth` (`auth.js:151`) does not set them, but `tokenAuth` routes never use
   `requirePermission` (`routes/auth.js:18,148+`). A `resolveRole` failure is a 500 (`auth.js:111-114`),
   i.e. fail-closed, not fail-open. `resolveRole` is deliberately **not** cached (`tokenCache.js:11-13`,
   TTL cache holds only the Supabase JWT→user result), so a permission change takes effect on the next
   request.
3. **Are permission keys ever client-supplied?** No — see the matrix's third check.
4. **Is the branch pinned by a test that production resolves both fields?** **No.** The fail-open case
   is pinned only for a principal the test constructs by hand (`permission-enforcement.test.js:67-72`);
   no test asserts that `resolveRole` actually reads `reference_data.details->'permissions'`
   (`auth.js:42-47`). The mini-Postgres helper has no `reference_data` model, and no integration test
   covers custom roles. → **G-03**.

Residual robustness note: the guard is `!req.user.customRoleId`, which is also true for `0`.
`reference_data.id` is `bigint generated always as identity` (`db/schema.sql:123`), so 0 can never be
a real role id — the falsy check is safe as shipped (O-5).

---

## 3. `company_id` / ownership after the router split

- No admin handler reads `company_id`, `company`, or `role` from the body into a write.
  `ADMIN_JOB_COLS` (`admin-jobs.js:31-32`) omits `company_id`, so an admin edit cannot move a vacancy
  to another employer; `company_id` appears only in read joins (`admin-jobs.js:19`, `admin.js:93,115,129,138`,
  `reports.js:14,40,46`) and as the notification recipient derived from the loaded job (`admin-jobs.js:116`).
- `PATCH /admin/users/:id` strips `id`, `email`, `role`, `created_at`, `updated_at`
  (`admin-users.js:99-109`) before the `EDITABLE` filter, so a body cannot re-key or re-role an account.
- The only client-supplied identity that reaches an INSERT is `custom_role_id` at signup/provision
  (`routes/auth.js:69-77,129`) — see G-01. `company_id`/ownership for employers is always the caller's
  own id (`routes/auth.js:107-119` inserts `req.user.id`).
- The split did not drop an owner check: the pre-split `admin.js` handlers were cross-tenant reads by
  design, and the tenant-scoped employer/seeker endpoints that *do* carry ownership checks are
  untouched and still live in `jobs.js` / `applications.js` / `profiles.js` (out of this item's scope;
  spot-checked `applications.js:41,96`, `profiles.js:124,213,451,455`).

## 4. 404-not-403 non-disclosure

Preserved, with one new exception:

- Non-uuid and missing ids answer **404** before any write: `admin.js:210`, `admin-jobs.js:47-49,103-105`,
  `admin-users.js:98,224,252`, `admin-reference.js:113,116,129,132,142,144`.
- Seeker child reads answer 200 `[]` for a uuid that does not exist — no existence oracle
  (`admin.js:209-213`).
- Self-guards answer 403 *before* a lookup (`admin-users.js:87-89,222,248`), so they reveal nothing
  about the target row.
- **Exception:** `DELETE /admin/reference/:id` answers 403 (`admin-reference.js:146-149`) when the row
  *is* a `custom_role` and the caller lacks `roles.manage`, and 404 when it is not found (`:144`) — a
  category oracle for a caller who already holds `settings.manage`. → **G-05** (Low).

---

## 5. Findings

| ID | Severity | OWASP | File:line | Issue | Recommended fix | Disposition |
|---|---|---|---|---|---|---|
| **G-01** | **High** | API5:2023 BFLA / A01:2021 | `server/src/routes/auth.js:69-77`, `:127-130`; `server/src/middleware/permissions.js:19`; `server/src/routes/admin-users.js:182,213` | The invitee, not the inviter, decides the custom-role tag. `POST /auth/provision` takes `custom_role_id` from the **client body** and only checks that the id exists in the catalogue; the inviter writes the tag to `user_metadata` (`admin-users.js:182`), which the user can edit, and writes only `{ role }` to service-role `app_metadata` (`admin-users.js:213`). A super-admin invited with a narrow bundle can therefore call provision with `custom_role_id` omitted or `null`; the `super_admins` row is inserted with `NULL` (`:129`) and `permissions.js:19` then grants **full break-glass access** to every admin endpoint. The escalation is invisible in the audit log — `auth.register` records only `{ role }` (`routes/auth.js:144`). Requires holding a super-admin invite; no anonymous path. | Put `custom_role_id` in `app_metadata` at invite time (same service-role write as `role`, `admin-users.js:213`) and resolve the tag from `req.user.app_metadata` at provision, ignoring the body. Reject a body value that disagrees with `app_metadata`. Log the resolved `custom_role_id` in the `auth.register` audit details. | Open — blocking |
| **G-02** | Medium | API5:2023 BFLA | `server/src/routes/admin-reference.js:112-139`; `server/src/routes/admin-users.js:146,167,213`; `db/schema.sql:150` | The bundle is not a ceiling for the two "management" keys. (a) `roles.manage` can widen its **own** role by `PATCH /admin/roles/:id` with all nine keys (`:112-126` — no self-role guard, catalogue keys are accepted), or delete its own role (`:128-139`) which nulls its `custom_role_id` (`:133-135`, and the FK is `on delete set null`, `schema.sql:150`) → break-glass. (b) `users.manage` can `POST /admin/users/invite` with `role: 'super-admin'` and no custom role (`:146,167`) → a new full-access admin. ADR-042:60-62 claims widening requires a break-glass account; that is only true for holders of *other* keys. | Either (i) refuse grant/carry of any key the caller does not hold and refuse editing/deleting the caller's own role unless break-glass, and allow `role: 'super-admin'` invites only from break-glass callers; or (ii) amend ADR-042 to declare `users.manage`/`roles.manage` admin-equivalent and surface that in the Role Management copy. Wrap the delete loop + delete in one transaction (`admin-reference.js:133-136` runs four unwrapped statements — a failed DELETE leaves assignments already nulled). | Open — accepted ceiling only if ADR-042 is amended |
| **G-03** | Medium | — (assurance of an authz control) | `server/src/auth.js:40-48`; `server/src/__tests__/permission-enforcement.test.js:67-72` | Nothing pins the premise the fail-open branch rests on. No test executes `resolveRole`'s bundle query (`auth.js:42-47`); `auth.resolveRole.test.js` asserts role/profile only and the helper has no `reference_data` model, so a broken/mis-named column would silently give every custom-role admin full access while the suite stays green. This is the test the plan asked for. | Add a mock-based test that seeds a `custom_role` row with `details.permissions` and asserts `resolveRole` returns `permissions` and `custom_role_id`; assert a principal with a non-matching bundle is denied and one with a matching key allowed. | Open |
| **G-04** | Low | — (test coverage) | `server/src/__tests__/permission-enforcement.test.js:60-64,87-92` | The "one representative route per key" table mislabels `dashboard.view` onto `/admin/audit-logs` (a `logs.view` route), and its assertion (`status !== 403`) is trivially true for a system admin, so `dashboard.view` has no real pin. The empty-bundle denial covers 4 routes; `accreditation.manage`, `notifications.send`, `settings.manage` and `reports.view`-as-granted have no allow/deny case. | Replace the hand-written 4-route list with the 30-row table from §1 and assert one allow + one deny per key by mutating the mocked principal's bundle. | Open |
| **G-05** | Low | — (info disclosure) | `server/src/routes/admin-reference.js:141-149` | `DELETE /admin/reference/:id` answers 403 (not 404) when the row is a `custom_role` and the caller lacks `roles.manage`, distinguishing "custom role row" from "not found" for a `settings.manage` holder. | Return the same 404 body/status for both cases (check `roles.manage` first or after the delete's `rowCount`), or accept: the caller can already list categories via `GET /admin/reference/:category`. | Open — Low, accept or align |
| **G-06** | Low | API5:2023 BFLA (least privilege) | `server/src/routes/admin.js:12` (+ routes `:61,78,104,121,214-220`) | The key labelled "View Dashboard" (`admin-reference.js:47`) gates the full PII directory: applicant lists with seeker email/phone/barrio (`admin.js:16,96-99`), employee/referral lists with employment history, and resume metadata (`admin.js:220`). A bundle granted for "the dashboard" reads citizen PII. ADR-042:43 documents the endpoints but not the data class. | Either split the key (`dashboard.view` = aggregates `:21`; `directory.view` = the listing endpoints) or keep the mapping and make the reach explicit in the ADR row and in the Role Management label ("View Dashboard & Applicant Data"). | Open — accept with explicit label/ADR note |
| **G-07** | Info | A04:2021 Insecure Design | `server/src/routes/admin-users.js:82-141,247-270` | No guard against suspending/moving the last break-glass super-admin; a `users.manage` holder can remove the recovery path ADR-042:60-62 depends on (they cannot suspend themselves, `:87,248`, but can act on the other break-glass account). | Refuse when the target is the last active `super_admins` row with `custom_role_id is null`, or document the DB-recovery runbook step. | Accepted per ADR-042:60-62 |

### Observations (no action required)

- **O-1** `GET /admin/permissions` accepts `users.manage` (`admin-reference.js:12`) but ADR-042:47 lists
  only `roles.manage`. Harmless (static catalogue, needed by the Users page); update the ADR row.
- **O-2** `GET /admin/reference/custom_role` (`settings.manage`) returns the same bundle rows as
  `GET /admin/roles` without `roles.manage` — read-only, super-admin-only, no data of consequence.
- **O-3** `custom_role_id` can be written onto a non-super-admin row (`admin-users.js:123-126,221-236`
  validate existence but not `base_role`). No authz effect: `requireRole` gates on the role table
  (`auth.js:139-140`), so the tag is inert. Data-hygiene only.
- **O-4** ADR-042:66 says the principal cache serves `permissions`; in code only the JWT→user result is
  cached (`tokenCache.js:11-13,19`). The code is the safer behaviour (immediate permission revocation) —
  the ADR sentence should be corrected, not the code.
- **O-5** `!req.user.customRoleId` would also match id `0`; identity starts at 1 (`db/schema.sql:123`),
  so this is theoretical.

---

## 6. Verified secure (do not regress)

Admin-authorization surface:

1. All 30 admin routes carry `auth` + `requireRole('super-admin')` + a literal `requirePermission`
   chain, in that order, with no exception and no admin route reachable without a permission key
   (`admin.js:10-15`, `admin-users.js:10`, `admin-jobs.js:9`, `admin-reference.js:9-14`, `reports.js:8`).
2. `requirePermission` re-asserts 401/403 itself (`permissions.js:17-18`), so a future chain that drops
   `auth` still cannot be reached anonymously through it.
3. Key→endpoint mapping conforms to ADR-042:41-54 route-for-route (9/1/4/5/5/1/1/1/3 = 30).
4. The permission catalogue is the only writable source of bundle keys; `POST/PATCH /admin/roles`
   filters every submitted key through `ROLE_PERMISSION_KEYS` (`admin-reference.js:57,76`),
   and the generic reference writer refuses `category='custom_role'` and never writes `details`
   (`admin-reference.js:24,27-29`). `admin-reference.js` is the only writer of `reference_data`
   (grep: `admin-users.js`, `auth.js` and `routes/auth.js` only `select` from it).
5. `admin`/`role`/`email`/timestamps are stripped from the user PATCH body and the rest is an explicit
   allowlist (`admin-users.js:99-115`); job PATCH uses a fixed column list that excludes `company_id`
   (`admin-jobs.js:31-32`).
6. `company_id` never comes from a request body anywhere in the admin surface (§3).
7. 404-before-write on every admin single-resource handler; no existence oracle on seeker children
   (§4).
8. Self-lockout footguns are guarded: `PATCH /admin/users/:id` refuses self `status`/`custom_role_id`
   (`admin-users.js:87-89`), `/custom-role` and `/role` refuse self (`:222,248`) — each pinned by
   `admin.security.test.js:86-100`.
9. Role moves deactivate rather than delete the old row, and a suspended current row outranks a stale
   inactive higher-precedence row (`auth.js:23-31`), pinned by `auth.resolveRole.test.js:56-71,88-101`.
10. Super-admin privilege requires the service-role-only `app_metadata.role` in addition to the
    `super_admins` row (`auth.js:121-123`), so a role-table write alone cannot mint an admin.
11. `resolveRole` is uncached per request (`tokenCache.js:11-13`), so suspension and permission changes
    are effective on the next request — no 60 s window on authorization.
12. Guard behaviour is pinned end-to-end against the real middleware order: 401 anonymous, 403
    employer/seeker, 200 super-admin (`admin.guards.test.js:18-47`); custom-role allow-list semantics
    including an empty bundle and the users-vs-jobs separation (`permission-enforcement.test.js:66-115`,
    executed 2026-11-13: 7/7 passing).
13. The five split routers are mounted side by side with no path overlap
    (`app.js:120`); unmatched methods/paths fall to the 404 handler (`app.js:122`), so no verb-tampering
    route exists.

Fail-open branch:

14. Break-glass is documented in code and ADR (see §2.1) and consistent across both places that branch
    on it (`permissions.js:19`, `admin.js:70`, `admin-reference.js:146`).
15. Both principal fields are always produced server-side from the DB (`auth.js:40-60`); a resolution
    failure is a 500, not an open door (`auth.js:111-114`).

---

## 7. Gaps — checks not possible under the read-only rules

- **No live request/response evidence.** Phase 4 (local probes) owns the runtime proof of G-01 and
  G-02. Suggested minimal probes there: (a) provision an invited super-admin with `custom_role_id`
  omitted, then `GET /api/admin/users` → expect the fix to return 403 and today to return 200;
  (b) as a `roles.manage`-only admin, `PATCH /api/admin/roles/{own id}` with all nine keys, then call a
  denied endpoint → expect denial after the fix.
- **Database state not inspected** (no remote DB, no local server): I could not confirm that production
  rows have `custom_role_id` as expected, that `reference_data.details` is well-formed for every role,
  or that the seeded break-glass admin exists. The audit is code-level only.
- **No timing/edge probing** of `requirePermission` (e.g. concurrent role deletion while a request is
  in flight). `resolveRole` reads per request, so a delete mid-request can only change the *next*
  request's outcome; not probed.
- **Frontend enforcement** (nav hiding, 403 rendering) is ADR-042's follow-up and Phase 5's scope, not
  this item.

## 8. Evidence log

| Check | Command / method | Result |
|---|---|---|
| Route inventory | full read of `admin.js`, `admin-users.js`, `admin-jobs.js`, `admin-reference.js`, `admin-shared.js`, `reports.js` | 30 admin routes, table in §1 |
| Admin-prefixed routes outside the split | `Select-String -Path server\src\**\*.js -Pattern "/admin/"` | only the five files (+ tests) |
| Permission call sites are literal | `Select-String -Pattern "requirePermission\("` over `server\src\routes\*.js`, `server\src\middleware\*.js` | 10 literal call sites, 0 dynamic |
| Principal assignment sites | grep `req.user\s*=` | `auth.js:96,124,134,151` only (all server-side) |
| Mount order | read `app.js:101-122` | admin routers mounted together at `:120`; 404 fallback `:122` |
| Guard wiring test (mock-based) | `server\node_modules\.bin\vitest.cmd run src\__tests__\permission-enforcement.test.js` | 1 file, 7 tests passed |
| Custom-role test coverage | grep for `custom_role`/`customRoleId` in tests and integration config | unit mocks only; no `resolveRole` bundle test, no integration coverage (G-03) |
| Schema premise for the fail-open check | `db/schema.sql:122-152` (read-only) | `id` identity (≥1); three FKs `on delete set null` |
