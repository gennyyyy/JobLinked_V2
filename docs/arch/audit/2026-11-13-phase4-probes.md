# Phase 4 — Live probes (local only), 2026-11-13

**Project:** JobLinked / PESO Santa Maria — Express API + PostgreSQL (Supabase auth only)
**Plan:** `docs/plan/2026-11-13-security-delta-audit.md` §Phase 4, plus the runtime-proof gaps listed in
`docs/arch/audit/2026-11-13-admin-guard-matrix.md` §7
**Agent:** penetration-tester
**Mode:** Authorized active testing, **local instance only**. No product code, test, or `db/schema.sql`
change. Fixes are separate post-gate tasks.
**Finding prefix:** `P-` (this file only; the architect merges with the `F-`/`G-` series).

## Verdict

**FAIL — the blocking finding G-01 is now proven at runtime, and G-02 has two proven escalation paths.**

| ID | Severity | Source | One line |
|---|---|---|---|
| **P-06 / G-01** | **High** | `routes/auth.js:72-77,129`; `middleware/permissions.js:19`; `admin-users.js:182,213` | An invited super-admin chooses its own `custom_role_id` at provision (body, not metadata). Omitting it yields `NULL` → full break-glass admin. Proven: 201 with `custom_role_id: null`, then `GET /api/admin/users` **200** (25 rows). |
| **P-07 / G-02a** | **High** (matrix: Medium) | `admin-reference.js:112-139` | A `roles.manage`-only admin widened its **own** role to all nine keys (next request: 200 on a denied endpoint) and then deleted its own role → `NULL` tag → full break-glass. Both proven. |
| **P-08 / G-02b** | **High** (matrix: Medium) | `admin-users.js:146-169,221-236` | `users.manage` cleared another admin's role tag → that account became full break-glass (proven). The same key can invite `role: super-admin` with no bundle (code path clear; runtime blocked by Supabase's email rate limit, 429). |
| **P-04** | Low (assurance) | `adr-041-auth-captcha-turnstile.md` | CAPTCHA is entirely a Supabase dashboard toggle: zero `turnstile` references in `server/src`; the local project is disabled (garbage token accepted). No code defect, but no code-level second line and no test. |
| **P-01-O-1** | Info | `server/scripts/verify-live.mjs:258-259` | The sanctioned harness still expects `403` for "employer B reads A's jobs"; ADR-048/contract say `200` pinned to published. API is correct; the harness assertion is stale. |

No Critical. P-01, P-02, P-03, P-05, P-09 pass. The three escalations are all in the
custom-role seam the guard matrix flagged; Phase 4 upgrades them from static inference to live proof.

**Severity note for the architect:** the guard matrix rated G-02 **Medium** before runtime evidence
existed. Phase 4 scores each proven path by the plan rubric ("High = privilege escalation"): a bundle
labelled "Manage Roles" reaches full break-glass in two requests, and a "Manage Users" bundle grants
control of admin accounts. If G-02 stays Medium it must be an **accepted ceiling with an ADR-042
amendment** declaring `users.manage`/`roles.manage` admin-equivalent — not a silent shrug.

---

## Environment and rules of engagement

| Item | Value |
|---|---|
| Target | `http://127.0.0.1:4000` — the local API already listening when Phase 4 resumed (PID **8468**, health 200 before and after). Reused, never restarted, never killed. |
| App identity check | `GET /api/health` → `{"ok":true,"db":"ok"}`; `GET /api/nope` → the app's `{error:{code:"NOT_FOUND"}}` shape. Same application as `server/src`. |
| Database | `server/.env` `DATABASE_URL` → `127.0.0.1:5433/myapp_db` (`sslmode=disable`). Local dev DB only; no remote connection. |
| Sessions | Dev Supabase project from `server/.env` (`omvn…supabase.co`), service-role minting; all fixture addresses `@joblinked-spike.test`. No production Supabase account created. |
| Server config | `TRUST_PROXY` unset (default 0). `TURNSTILE_SECRET_KEY`, `OPENROUTER_API_KEY`, `METRICS_TOKEN` **unset**. |
| Conduct | No DoS/flood (≈100 requests total, no limiter was driven to 429), no exfiltration (25-row admin list read only, no export), no destructive payloads. Production node and remote DB never contacted. |
| Secrets | Raw tokens never recorded; evidence stores `eyJhbGci…(len=846)` prefixes only. |

Evidence files (ephemeral, outside the repo): `%TEMP%\p4b-evidence.json` (main run),
`%TEMP%\p4c-evidence.json` (G-01 follow-up). Key rows are inlined below.

---

## P-00 — Baseline and fixtures

Baseline captured before any fixture: `super_admins 5 · job_seekers 103 · employers 53 ·
custom_role 1 · resumes 3 · job_vacancies 102 · audit_logs 2843 · notifications 2726 ·
4 upload files` (all pre-existing dev data; the interrupted prior attempt left **no** `p4.*` rows or
files — verified by query and by file timestamps, so nothing was inherited).

Fixtures created through the product's own API (service-role only for Supabase users):

| Fixture | Shape |
|---|---|
| break-glass admin | `app_metadata.role=super-admin`, provisioned with no custom role |
| job-seeker, employer | normal provision |
| custom-role admin | `logs.view` bundle (role id 30) |
| invited-shape user | `app_metadata.role=super-admin` + `user_metadata.custom_role_id=30/33` |
| `roles.manage` admin | role id 32 |
| `users.manage` admin | role id 31 |
| picker (G-01 variant 2) | app metadata `super-admin`, user metadata tag 30, body tag 31 |

All fixtures deleted in `finally`; see §Fixture cleanup.

---

## P-01 — Authorization matrix spot-checks

Method: real HTTP with minted sessions; every row asserts the contract's 401/403/404/200. `PASS` =
observed equals the contract.

| # | Caller | Request | Observed | Expected | Verdict |
|---|---|---|---|---|---|
| 1 | anon | `GET /api/admin/stats` | 401 `UNAUTHORIZED` | 401 | PASS |
| 2 | anon | `GET /api/notifications/mine` | 401 `UNAUTHORIZED` | 401 | PASS |
| 3 | anon | `GET /api/auth/me` | 401 `UNAUTHORIZED` | 401 | PASS |
| 4 | seeker | `GET /api/admin/stats` | 403 `FORBIDDEN` | 403 | PASS |
| 5 | seeker | `GET /api/admin/users` | 403 `FORBIDDEN` | 403 | PASS |
| 6 | seeker | `POST /api/jobs` | 403 `FORBIDDEN` | 403 | PASS |
| 7 | seeker | `GET /api/employers/me` | 403 `FORBIDDEN` | 403 | PASS |
| 8 | seeker | `GET /api/seekers/me` | **200** (profile) | 200 | PASS |
| 9 | seeker | `GET /api/applications/mine` | 200 | 200 | PASS |
| 10 | employer | `GET /api/seekers/me` | 403 `FORBIDDEN` | 403 | PASS |
| 11 | employer | `GET /api/applications/mine` | 403 `FORBIDDEN` | 403 | PASS |
| 12 | employer | `GET /api/employers/me` | **200** | 200 | PASS |
| 13 | employer | `GET /api/admin/users` | 403 `FORBIDDEN` | 403 | PASS |
| 14 | admin | `GET /api/admin/users` | 200 (25 rows, `total` 166) | 200 | PASS |
| 15 | admin | `GET /api/admin/stats` | 200 | 200 | PASS |
| 16 | custom `logs.view` | `GET /api/admin/audit-logs` | 200 | 200 | PASS |
| 17 | custom `logs.view` | `GET /api/admin/stats` | 403, names `dashboard.view` | 403 | PASS |
| 18 | custom `logs.view` | `GET /api/admin/users` | 403, names `users.manage` | 403 | PASS |
| 19 | custom `logs.view` | `PATCH /api/admin/users/{self}` | 403 (permission gate before self-guard) | 403 | PASS |
| 20 | admin | `PATCH /api/admin/users/{random uuid}` | 404 `NOT_FOUND` | 404 | PASS |
| 21 | admin | `PATCH /api/admin/users/not-a-uuid` | 404 `NOT_FOUND` | 404 | PASS |
| 22 | admin | `GET /api/admin/seekers/not-a-uuid/education` | 404 | 404 | PASS |
| 23 | admin | `DELETE /api/admin/roles/99999999` | 404 | 404 | PASS |
| 24 | anon | `GET /api/jobs/{random uuid}` | 404 | 404 | PASS |
| 25 | seeker | `GET /api/jobs/{employer draft}` | 404 (not 403) | 404 | PASS |
| 26 | owner employer | `GET /api/jobs/{own draft}` | 200 | 200 | PASS |
| 27 | admin | `GET /api/jobs/{employer draft}` | 200 | 200 | PASS |
| 28 | unlinked employer | `GET /api/applications/seekers/{uuid}/education` | 403 | 403 (contract Addendum B) | PASS |
| 29 | employer | `GET /api/employers/{random uuid}/jobs` | 200, published-pinned | 200 (ADR-048) | PASS |

**Verdict: PASS.** Guard order (`auth` → `requireRole` → `requirePermission`) holds across all four
principal types; 404-not-403 non-disclosure holds on every admin single-resource path and on
non-published jobs; the one documented 403 (unlinked employer credential read) is intentional.
The custom-role 403 body names the missing key — an authorization message, not an existence oracle.

**P-01-O-1 (Info).** `server/scripts/verify-live.mjs:258-259` asserts `employer B reads A jobs → 403`.
The running API returns **200** with `status=published` only, exactly as `docs/arch/rework/02-api-contract.md:123`
(ADR-048) requires: "a caller-supplied status is ignored for them, never 403". The harness assertion
predates ADR-048; it is stale, not the API. Fix task (not done here): update the assertion to 200 +
published-only, or delete it.

---

## P-02 — Rate-limit bucket rotation (`TRUST_PROXY` unset)

Target: anonymous `apiLimiter` (300/15 min) and `authLimiter` (100/15 min), both keyed
`req.user?.id || ipKeyGenerator(req.ip)`. With `TRUST_PROXY` unset, `req.ip` must be the **socket**
address, so client-set forwarding headers must not mint fresh buckets.

| Request | Client header | HTTP | `RateLimit` remaining |
|---|---|---|---|
| `GET /api/jobs` | `X-Forwarded-For: 198.51.100.11` | 200 | **289** |
| `GET /api/jobs` | `X-Forwarded-For: 198.51.100.22` | 200 | **288** |
| `GET /api/jobs` | `X-Real-IP: 203.0.113.33` | 200 | **287** |
| `GET /api/jobs` | none | 200 | **286** |
| `GET /api/auth/me` (anon) | `X-Forwarded-For: 198.51.100.44` | 401 | **69** / 100 |
| `GET /api/auth/me` (anon) | `X-Forwarded-For: 198.51.100.55` | 401 | **68** |
| `GET /api/auth/me` (garbage bearer) | `X-Forwarded-For: 198.51.100.66` | 401 `Invalid or expired token` | **67** |

Strict decrement across three different client-supplied addresses proves one shared bucket keyed on
the socket (`127.0.0.1`), not on the header. A garbage token stays on the IP bucket and 401s at the
route — it cannot mint a fresh bucket.

**Verdict: PASS.** F-01/F-02 fix confirmed at runtime: header rotation does **not** rotate buckets.
No flood was needed; 7 requests total.

---

## P-03 — Upload abuse (resume bucket)

| Case | Request | HTTP / body | Files on disk | Verdict |
|---|---|---|---|---|
| Bad magic bytes (`MZ…` named `.pdf`) | `POST /api/files/resumes` | 400 `File content does not match its extension.` | 0 → 0 | PASS |
| Disallowed extension `.html` | same | 400 `Only PDF, DOC, DOCX, PNG, or JPG files are allowed.` | 0 → 0 | PASS |
| Oversized 6 MB `.pdf` (5 MB multer cap) | same | 400 `File too large` | 0 → 0 | PASS |
| Valid `%PDF-`, 3 MB (PDF 2 MB cap) | same | 400 `PDF files must be 2 MB or smaller.` | 0 → 0 | PASS |
| Traversal filename `..\..\..\p4b-trav.pdf` | same | 201; stored `resumes/{seekerId}/{uuid}-p4b-trav.pdf` | 0 → 1 | PASS |
| Traversal filename `../../p4b-trav2.pdf` | same | 201; stored `resumes/{seekerId}/{uuid}-p4b-trav2.pdf` | in-bucket | PASS |
| Content-type confusion: declared `text/html`, PNG bytes, `.png` name | same | 201; served `Content-Type: image/png` | in-bucket | PASS |

Notes: `path.basename()` + per-character sanitization strips both separator styles before the UUID
prefix; no `..` segment reaches the stored path. Serving derives the type from the stored extension
(`resumes/…png` → `image/png`), never from the upload's declared type. ADR-049 replace-in-place means
each accepted upload deletes the previous file, so the count stays at 1 — the API's own
`DELETE /api/files/resumes/{id}` then removed it, and `resumes` rows for the fixture returned to 0.

**Verdict: PASS.** Magic-byte check (F-06), extension allowlist, 5 MB/2 MB caps, sanitized filename,
extension-derived response type, and no orphan file on any rejected path.

---

## P-04 — Captcha (Turnstile)

| Probe | Observed | Expected | Verdict |
|---|---|---|---|
| `POST /api/auth/provision` no token | 401 `UNAUTHORIZED` | 401 (bearer required) | PASS |
| `POST /api/auth/provision` garbage bearer | 401 `Invalid or expired token` | 401 | PASS |
| Supabase password grant, **no** `captchaToken` (dev project) | **session issued** | depends on project toggle | observed: disabled |
| Supabase password grant, **garbage** `captchaToken` (dev project) | **session issued** | reject if enforcement on | observed: disabled |
| Repo evidence | 0 `turnstile` references in `server/src`; no TURNSTILE key in `server/.env` | — | INFO |

The disabled path is **not fail-open Express middleware**: there is no Express captcha at all. ADR-041
puts enforcement project-wide in Supabase, and the dev project has it off (as the ADR intends for local
dev/CI). Risk is assurance-level: production bot protection depends on a dashboard toggle with no code
or test in this repo; a mistaken toggle silently removes it. The API's own credential surface is only
bearer-authenticated routes, which were correctly 401.

**Verdict: design as documented; enforcement cannot be verified from the repo or locally.** Cannot
probe production (ROE). See §Cannot probe.

---

## P-05 — Prototype-pollution keys

Payloads used a **raw JSON string** (a JS object literal with `__proto__:` sets the prototype and never
serializes — a known harness trap avoided here).

| Request | Observed | Expected | Verdict |
|---|---|---|---|
| `POST /api/ai/help` with `__proto__` + `constructor` keys | 503 `AI_NOT_CONFIGURED` | 503 locally (key unset) — no 500, no pollution | PASS (see note) |
| `POST /api/ai/help` clean control | 503 `AI_NOT_CONFIGURED` | 503 | PASS |
| `PATCH /api/seekers/me` only `__proto__`/`constructor` | 400 `Nothing to update` | 400 | PASS |
| `PATCH /api/seekers/me` proto keys + `headline` | 200; `headline` = `p4b proto headline` | 200, only allowlisted field written | PASS |
| `GET /api/auth/me` after the patch | role `job-seeker`, `custom_role_id: null`, no `polluted` key | unchanged | PASS |
| `POST /api/jobs` `status:'draft'` + `__proto__:{status:'published'}` | 201, stored status **`draft`** | draft | PASS |

`/api/ai/help` checks configuration **before** body validation (`routes/ai.js:34-38`), so the 400 branch
was unreachable locally; what the probe does prove is that the polluted keys cause neither a 500 nor a
merged property. The PATCH/POST allowlists iterate fixed column lists (`profiles.js:52-59`,
`jobs.js:196-198`), and `JSON.parse` with no reviver creates an own `__proto__` property, never a
prototype mutation.

**Verdict: PASS.** No pollution, no mass assignment through proto keys.

---

## P-06 — G-01: invited super-admin chooses its own role tag (High, proven)

### Request sequence (invite-shaped principal)

1. Break-glass admin creates a narrow custom role `logs.view` (id 30, base_role `super-admin`).
2. Intended invite: `POST /api/admin/users/invite` with `role: super-admin, custom_role_id: 30`.
   **Observed: 429 `RATE_LIMITED`** ("Invite email rate limit reached") — the dev project's email cap
   was already exhausted. **No invitee user was created**; the endpoint's email path could not be
   exercised (see §Cannot probe).
3. Because `admin-users.js:213` writes **only** `{ role }` to service-role `app_metadata` and
   `admin-users.js:182` puts `custom_role_id` in client-writable `user_metadata`, the invite's exact
   metadata state was recreated with the service-role admin API for the follow-up probe:
   `app_metadata {role:'super-admin'}`, `user_metadata {custom_role_id:33}` — verified by reading the
   user back. This is the state every real invitee has.
4. Invitee calls `POST /api/auth/provision` with `{ role:'super-admin', first_name, last_name }` —
   **`custom_role_id` omitted**, exactly what the Accept-Invite screen sends when the user clears or
   ever omits the tag.

### Observed

```
POST /api/auth/provision        → 201
  { role: "super-admin", custom_role_id: null, status: "active", … }
  (user_metadata.custom_role_id was 33; the route never reads it)

GET /api/admin/users            → 200  { data: 25 rows, total: 163 }
GET /api/admin/stats            → 200  { seekers, employers, companies, jobs, applications, … }
GET /api/admin/audit-logs       → 200  (500 rows)
GET /api/admin/system-notifications (not sent) — same full-access branch
```

`super_admins.custom_role_id` for the principal is `NULL` in the database. `permissions.js:19`
(`if (!req.user.customRoleId) return next();`) therefore grants every key.

The audit row is `auth.register` with `details = {"role":"super-admin"}` — the resolved tag is not
recorded, so the escalation is invisible in the Admin → Audit Logs view.

### Variant 2 — different catalogue id in the body

A second principal carried `user_metadata.custom_role_id = 30` (narrow) and provisioned with
`custom_role_id: 31` (broad, `users.manage`) in the body:

```
POST /api/auth/provision → 201, custom_role_id: "31"   (body value, not metadata 30)
GET  /api/admin/users    → 200  (users.manage is in 31)
GET  /api/admin/audit-logs → 403 "Your assigned role does not include \"logs.view\""
```

The last two lines prove the *bundle machinery works*; the defect is only **who chooses the tag**.

### Expected vs actual

| Expected after fix | Actual today |
|---|---|
| Tag resolved from `app_metadata` written at invite; body ignored | Body is the only source (`routes/auth.js:72-77`) |
| A `logs.view` invitee gets 403 on `/admin/users` | **200**, 25 rows of applicant/employee PII |
| Audit records the effective tag | `{role}` only |

**Verdict: VULNERABLE (High).** Compromise requires a super-admin invite, which is why this is High and
not Critical; the impact is full break-glass admin over all 30 admin routes, including the PII
directory (`/admin/users`, `/admin/applications`, seeker child reads). This is the runtime proof the
guard matrix asked for and the gate is blocking on.

---

## P-07 — G-02(a): `roles.manage` widens/deletes its own role (High, proven)

| Step | Request | Observed | Expected after fix | Verdict |
|---|---|---|---|---|
| 1 | provision admin with bundle `['roles.manage']` (id 32) | 201 | — | setup |
| 2 | `GET /api/admin/users` (control) | 403, names `users.manage` | 403 | PASS |
| 3 | `PATCH /api/admin/roles/32` `{permissions: all nine keys}` | **200**, bundle persisted with 9 keys | 403 (cannot grant what you lack) | VULNERABLE |
| 4 | `GET /api/admin/users` | **200**, 25 rows | 403 | VULNERABLE |
| 5 | `PATCH /api/admin/roles/32` `{permissions:['roles.manage']}` | 200 | — | restore |
| 6 | `GET /api/admin/users` | 403 (proves the change is live per request, no cache) | 403 | PASS |
| 7 | `DELETE /api/admin/roles/32` (own role) | **200** | 403 (self-delete guard) | VULNERABLE |
| 8 | `GET /api/admin/users` | **200** — `NULL` tag → break-glass | 403 | VULNERABLE |

Root cause: `admin-reference.js:112-126` validates only that submitted keys are in the catalogue, never
that the caller holds them; `:128-139` deletes the role and nulls assignments (FK `on delete set null`),
with no self guard. `resolveRole` is uncached per request, so step 4 is the very next request — the
window is immediate. ADR-042:60-62 assumes a narrow-bundle admin "removes your own access"; in fact a
`roles.manage` holder converts itself to full break-glass in two calls. The delete loop
(`:133-136`) is also four unwrapped statements (the matrix's transaction note stands).

**Verdict: VULNERABLE (High by the plan rubric; matrix Medium pre-runtime).**

---

## P-08 — G-02(b): `users.manage` takes over admin accounts (High, proven in part)

| Step | Request | Observed | Expected after fix | Verdict |
|---|---|---|---|---|
| 1 | provision admin with bundle `['users.manage']` (id 31) | 201 | — | setup |
| 2 | `POST /api/admin/roles` (control) | 403, names `roles.manage` | 403 | PASS |
| 3 | narrow admin (`logs.view`) `GET /api/admin/users` (control) | 403 | 403 | PASS |
| 4 | `POST /api/admin/users/{narrow id}/custom-role` `{custom_role_id:null}` | **200**, tag cleared | 403 (cannot clear another admin's tag) | VULNERABLE |
| 5 | narrow admin `GET /api/admin/users` | **200**, 25 rows — now full break-glass | 403 | VULNERABLE |
| 6 | narrow admin `GET /api/admin/audit-logs` | 200 | 200 | (consistent) |
| 7 | `POST /api/admin/users/invite` `{role:'super-admin'}` (no bundle) | **429 `RATE_LIMITED`** | 201 today; 403 after fix unless caller is break-glass | BLOCKED at runtime |

The targeted account is a *different* admin (self-guard `admin-users.js:222` correctly blocks self), so
the caller cannot withdraw their own tag — but they can strip any other admin's, silently promoting that
account to break-glass. The invite branch (`:146-169`) accepts `role: super-admin` with no custom role
and writes the unforgeable `app_metadata.role` at `:213`; with a working email path a `users.manage`
holder can therefore mint a full admin they control. Runtime was blocked only by the dev project's
email cap, not by an authorization check; the code path is unambiguous.

A related deterministic route exists at the same trust level: `users.manage` also holds read access to
the role catalogue (`GET /admin/roles` accepts `users.manage`, by design for the Users page), so the
attacker can enumerate roles before assigning or clearing one.

**Verdict: VULNERABLE (High; matrix Medium pre-runtime).** Step 4→5 is the runtime proof; step 7 is
code-confirmed but rate-limit-blocked.

---

## P-09 — JWT abuse (defensive)

Control: a real minted token returns 200 (`/api/auth/me`, role `super-admin`).

| Forged token | Observed | Expected | Verdict |
|---|---|---|---|
| `alg:none`, empty signature | 401 `Invalid or expired token` | 401 | PASS |
| `alg:none`, fake signature | 401 | 401 | PASS |
| `alg:None` case variant | 401 | 401 | PASS |
| `HS256` signed with attacker random secret | 401 | 401 | PASS |
| `kid: ../../../../dev/null` + attacker `jku` + inline `jwk` | 401 | 401 | PASS |
| Real token, payload `sub` swapped, original signature kept | 401 | 401 | PASS |
| Garbage bearer / empty bearer | 401 | 401 | PASS |

Supabase `auth.getUser` verifies the signature and claims server-side (`auth.js:78-84`); no local JWT
secret exists in `server/.env`, so the API cannot be tricked into verifying with an attacker key. No
`kid`/`jku`/`jwk` handling exists in this codebase to exploit.

**Verdict: PASS.**

---

## Cannot probe (and why)

1. **Turnstile enforcement on the production Supabase project.** Enforcement is a dashboard toggle
   (ADR-041:54-56, 84-100); ROE forbids the production project. Locally it is off and a garbage token
   is accepted, which is expected for dev/CI. The production posture is unverified by this phase.
2. **The real invite email path.** Two `POST /admin/users/invite` attempts (G-01 and G-02b) returned
   `429 RATE_LIMITED` from Supabase's email cap before any user was created. G-01 was proven with the
   identical metadata state written by `admin-users.js:182,213`; the G-02b invite remains
   code-confirmed only. No retry loop was attempted (no flood).
3. **OpenRouter AI request/response and the 400 validation branch.** No `OPENROUTER_API_KEY`;
   `routes/ai.js:34-38` returns `503 AI_NOT_CONFIGURED` before `validate()`. The 503 path and the
   absence of pollution were observed; prompt handling, model output, and the 400 shape were not.
4. **A validly-signed expired token, and a token from another Supabase project/audience.** No JWT
   secret is available locally, and the API delegates verification to Supabase. Tampered-signature
   variants were rejected; genuine expiry/audience rejection is Supabase's, not observable here.
5. **G-05 category oracle** (`settings.manage` holder distinguishing a `custom_role` row on
   `DELETE /admin/reference/:id`). Not in the Phase 4 probe list and would need another fixture; the
   guard matrix's static verdict stands.
6. **Race/concurrency** (one-resume-per-account, role deletion mid-request, parallel tag changes).
   Out of the no-flood ROE and not requested for Phase 4.
7. **Frontend enforcement** (nav hiding, 403 rendering). Phase 5 scope.
8. **Production API origin and remote database.** Explicitly out of scope; never contacted.

---

## Fixture cleanup evidence

| Check | Baseline | After both runs |
|---|---|---|
| `super_admins` | 5 | **5** |
| `job_seekers` | 103 | **103** |
| `employers` | 53 | **53** |
| `custom_role` rows | 1 | **1** |
| `resumes` | 3 | **3** |
| `job_vacancies` | 102 | **102** |
| `notifications` | 2726 | **2726** |
| Upload files | 4 (pre-existing dev fixtures) | **4**, byte-for-byte the same paths |
| Dev-Supabase users matching `p4b.*` / `p4c.*` | — | **none** (listUsers scan) |
| `audit_logs` | 2843 | **2869** (+26, **intentionally retained**) |

Deleted: 8 Supabase users (all `p4b.*`/`p4c.*@joblinked-spike.test`), 4 custom roles (ids 30–33),
their `super_admins`/`job_seekers`/`employers` rows, accreditations, the probe draft vacancy, resume
rows, notifications, and the per-fixture upload directory.

`audit_logs` rows were **not** deleted: they are the system's append-only audit trail, not fixtures;
deleting them would falsify the record of an authorized test. The +26 rows are the probes' own
`auth.register` / `role.create` / `role.update` / `role.delete` / `user.custom-role.assign` /
`user.update` / `job.create` / `job.delete` / `resume.*` entries.

---

## Verified secure (do not regress)

1. Guard order and 401/403/404 semantics across seeker, employer, break-glass admin and custom-role
   admin (P-01, 29 rows).
2. 404-not-403 non-disclosure on missing/non-uuid admin resources and non-published jobs; the
   documented unlinked-employer 403 remains the only intentional exception.
3. Custom-role allow-list mechanics: a `logs.view` principal is denied `users.manage` routes with a
   key-naming 403, and a `users.manage` principal is denied `roles.manage` routes.
4. Rate-limit keying on the socket address with `TRUST_PROXY` unset; forwarding headers and garbage
   bearer tokens cannot rotate buckets (F-01/F-02).
5. Upload defense chain: extension allowlist, magic bytes, size caps, basename sanitization, no
   orphan file on rejection, extension-derived serving type, owner-scoped download.
6. Prototype keys inert in JSON bodies; allowlists ignore them; no 500s.
7. JWT forgery rejected (`none`, case variants, HS256 with attacker key, `kid`/`jku`/`jwk`, tampered
   payload); no secret material in evidence.
8. `PATCH /api/admin/users/{self}` and `POST /api/admin/users/{self}/custom-role` self-guards hold
   (the latter was not probed directly but the permission gate denied first in P-01 #19).

---

## Fix guidance for the post-gate tasks (not applied)

- **G-01 (High):** write `custom_role_id` into service-role `app_metadata` at invite time (same
  `updateUserById` call as `role`, `admin-users.js:213`); read the tag from `req.user.app_metadata`
  at `routes/auth.js:72` and ignore the body; reject a body value that disagrees; include the resolved
  tag in the `auth.register` audit details.
- **G-02a (High):** refuse a role PATCH that adds a key the caller does not hold; refuse
  `PATCH`/`DELETE` of the caller's own role unless the caller is break-glass; wrap the four untag
  statements and the delete in one transaction. If the product intends `roles.manage` to be
  admin-equivalent, amend ADR-042 (and the Role Management copy) **and** record the ceiling.
- **G-02b (High):** allow `role: super-admin` invites only from a break-glass caller (or require both
  `users.manage` and `roles.manage`); refuse clearing/replacing another admin's `custom_role_id`
  unless the caller is break-glass.
- **P-04 (Low):** keep the dashboard checklist, but add an operational check (e.g. a runbook step or a
  synthetic signup attempt that must be rejected) because no code or test pins the toggle.
- **P-01-O-1 (Info):** update `verify-live.mjs:258-259` to expect 200 + published-only per ADR-048
  (separate task; not modified during the audit).

---

## Retest plan

| Finding | Retest |
|---|---|
| G-01 | Invite a super-admin with a `logs.view` bundle; provision with the tag omitted and with a different id. Expect 201 with the invited tag, 200 on `/admin/audit-logs`, 403 on `/admin/users` and `/admin/stats`. |
| G-02a | As `roles.manage` only: PATCH own role with `users.manage` → expect 403; DELETE own role → expect 403; `GET /admin/users` stays 403. |
| G-02b | As `users.manage` only: clear another admin's tag → expect 403; invite `role: super-admin` → expect 403. |
| P-01-O-1 | Run `node scripts/verify-live.mjs --only jobs` and confirm the updated employer-jobs assertion passes. |
| P-02/P-03/P-05/P-09 | Re-run the same probes (or promote them into the existing test suite) and keep the 401/400/PASS outcomes pinned. |

---

## Evidence log

| Probe | Timestamp (UTC) | Artifact |
|---|---|---|
| P-00–P-09 main run | 2026-11-12 20:14:06–20:14:29 | `%TEMP%\p4b-evidence.json` |
| P-06b G-01 omission follow-up | 2026-11-12 20:16:03–20:16:10 | `%TEMP%\p4c-evidence.json` |
| Cleanup verification | 2026-11-12 20:16:10 + post-run scan | DB counts, `listUsers` scan, upload listing above |
| Target availability | health 200 before and after; PID 8468 | `curl /api/health` |

Local time for all rows is 2026-11-13 04:14–04:16 (UTC+8). Raw bearer values were never stored; the
only token material in evidence is a masked prefix and length.
