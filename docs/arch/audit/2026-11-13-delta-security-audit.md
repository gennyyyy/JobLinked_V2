# Security Delta Audit — 2026-11-13

**Scope:** JobLinked (PESO Santa Maria) delta audit per `docs/plan/2026-11-13-security-delta-audit.md`:
Phase 0, Phase 1 items 1 and 3–10, Phase 2, Phase 3, Phase 5. Phase 4 (live probes) and Phase 1
item 2 (admin guard matrix) are owned by other agents and are **incorporated by reference**, not
repeated.
**Mode:** read-only static review plus read-only git commands, `npm audit`, four mock-based unit test
files, and read-only HEAD/GET requests against the production site root
`https://www.joblinked.site/`. No product code, test, or `db/schema.sql` change. No API server
started, no integration/live harness run, no database contacted (local or remote).
**Baseline:** `docs/arch/audit/phase5-security-audit.md` (2026-10-15, findings F-01..F-07) and the
accepted ceilings in `docs/plan/done/2026-11-04-04-security-compliance-plan.md`.
**Companion:** `docs/arch/audit/2026-11-13-admin-guard-matrix.md` (findings G-01..G-07) — merged by
reference in §3.
**Finding prefix:** `F-` continues the prior series (new IDs start at **F-08**). G-IDs keep their
own prefix so both reports stay traceable.

---

## 0. Verdict and gate

**FAIL — blocking: G-01 (High, privilege escalation) and F-15 (High, A05:2021).**
No Critical. New findings this pass: 1 High, 9 Low, 2 Info (F-08..F-19). Every prior finding has a
disposition; every in-scope new surface has a verdict.

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 2 | **G-01** (by reference), **F-15** |
| Medium | 2 | G-02, G-03 (by reference) |
| Low | 9 | F-08, F-09, F-10, F-11, F-12, F-13, F-14, F-16, F-17 |
| Info | 2 | F-18, F-19 |

**Gate line.**

```
FAIL — blocking: G-01 (High: invitee selects its own custom_role_id -> break-glass admin),
               F-15 (High: five security headers absent on the production frontend origin).
```

Both are fix tasks, not audit re-runs: G-01 per §3, F-15 per §6.1. F-15's patch is drafted in this
report; G-01's fix is drafted in the guard-matrix report.

---

## 1. Phase 0 — disposition of F-01..F-07

| Prior ID | Prior severity | Current disposition | Evidence |
|---|---|---|---|
| F-01 — limiter keyed before `auth`, so always IP | Medium | **Fixed (verified)** | `server/src/app.js:101-113` mounts `attachPrincipal` for `/api` before every limiter; `server/src/middleware/rateLimit.js:16,44,58-66` key on `req.user?.id` with an IP fallback. Pinned by `server/src/__tests__/f01-f02-rate-limit-keying.test.js:29-70` (per-user buckets independent of one socket IP; anonymous still IP-keyed; invalid token falls back to the IP bucket). Executed 2026-11-13: 2 files / 10 tests pass alongside the upload-signature suite. |
| F-02 — hardcoded `trust proxy` | Low | **Fixed (verified)** | `server/src/app.js:45-46` — `Number(process.env.TRUST_PROXY ?? 0)`, non-finite → `false`; comment records the fail-safe rationale. Pinned by `f01-f02-rate-limit-keying.test.js:73-79` (`TRUST_PROXY=0` makes a client-set `X-Forwarded-For` rotate nothing). |
| F-03 — client-forgeable `/api/audit` actions | Low | **Fixed (verified)** | `server/src/routes/auth.js:155-167` allow-lists exactly `auth.login`, `auth.logout`, `auth.password.change`, `auth.password.reset.request`; anything else is 400. Residual `entity`/`entity_id`/`details` control → **F-08** (Low). |
| F-04 — free-text `doc_type` | Low | **Open** | `server/src/routes/profiles.js:237-238` (`POST /documents`) and `:317-324` (`POST /files/documents`) still only require presence. Unbounded value lands in `employer_documents.doc_type`, the notification message (`:230-232`) and the admin UI. No SQL risk (parameterized). Fix unchanged: allow-list or a `reference_data` document-type catalogue. |
| F-05 — no numeric/date validation on PATCH | Low | **Partially fixed** | Dates and vacancies are now validated (`server/src/routes/jobs.js:283-293` POST, `:352-364` PATCH; `server/src/routes/profiles.js:48-51, 373-378, 407-411` birthdate/years). **Residual:** `salary_min`/`salary_max` are only compared, never coerced (`jobs.js:287-290, 355-361`) → `"abc"` reaches a `numeric` column and 500s on 22P02. Carried as **F-11**. |
| F-06 — no magic-byte check on uploads | Info | **Fixed (verified)** | `server/src/upload.js:43-55` (`matchesSignature`), enforced at `:91-100` (disk) and `:114-117` (images); DOCX reads the whole 5 MB buffer to find `[Content_Types].xml`. Pinned by `server/src/upload.signatures.test.js` (executed 2026-11-13, passing). Orphans unlinked on mismatch. |
| F-07 — helmet defaults | Info | **Present (do not regress)** | `server/src/app.js:56` (`helmet({ crossOriginResourcePolicy: 'cross-origin' })`); CSP + nosniff + frameguard + HSTS pinned at `server/src/__tests__/middleware-hardening.test.js:18-42`. |

### 1.1 The three headline invariants

| Invariant | Verdict | Evidence |
|---|---|---|
| Every route carries `auth`/`tokenAuth`/`optionalAuth`; every `requireRole` rides behind `auth` | **PASS** | Route inventory re-run across `server/src/routes/*.js`. Deliberate anonymous routes are exactly: `GET /api/health` (`app.js:106`), `GET /api/public/stats` (`jobs.js:47`), `GET /api/jobs` + `GET /api/jobs/:id` (`optionalAuth`, `jobs.js:76,148`), `GET /api/employers/:id` and `/:id/logo` (`profiles.js:143,470`), and `GET /api/metrics` (`metrics.js:22`, token-gated, 404 when unset). Everything else is behind `auth`/`tokenAuth`. Every admin router chains `[auth, requireRole('super-admin'), requirePermission(...)]` (`admin.js:10-15`, `admin-users.js:10`, `admin-jobs.js:9`, `admin-reference.js:9-14`, `reports.js:8`); `requirePermission` re-asserts both itself (`middleware/permissions.js:17-18`). |
| All SQL parameterized, identifiers from allow-lists | **PASS** | Re-read every query in `jobs.js`, `applications.js`, `profiles.js`, `admin*.js`, `reports.js`, `notifications.js`. Values are always `$n`; interpolated identifiers come only from constants: `ORDER_COLS`/`JOB_COLS` (`jobs.js:20,196`), `USER_TABLES`/`ACCOUNT_STATUSES` (`admin-shared.js:6,9`), `EDITABLE`/`ADMIN_JOB_COLS`, fixed `(table, order)` pairs in `seekerChild`/`credByLink`, `ROLE_PERMISSION_KEYS` (`admin-reference.js:46-57,76`). No `Object.assign`/spread of a body into a query. LIKE metacharacters escaped (`util.js:20`; `jobs.js:128` uses the same escape inline). |
| No server secret referenced under `src/**` | **PASS** | `git grep -E "SUPABASE_SERVICE_ROLE|DATABASE_URL|OPENROUTER_API_KEY|TURNSTILE_SECRET|METRICS_TOKEN" -- src` → 0 hits. `src/shared/lib/supabase.js:3-12` reads only `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, `persistSession:false`, `autoRefreshToken:false`. Full Phase 2 detail in §7. |

Any regression to a "verified secure" item would be a new finding; none was found.

---

## 2. Phase 1 — new surface (items 1, 3–10)

| # | Item | Verdict | Evidence / finding |
|---|---|---|---|
| 1 | Custom-role enforcement (ADR-042) | **PARTIAL — blocked by G-01** | Enforcement is real and ordered: 30 admin routes each carry `auth` + `requireRole('super-admin')` + a literal `requirePermission(...)` (`admin.js:10-15`, `admin-users.js:10`, `admin-jobs.js:9`, `admin-reference.js:9-14`, `reports.js:8`); keys are never client-supplied (10 literal call sites, no `requirePermission(req…)` form). Bundle writes are super-admin-writable only: the only writer of `reference_data.details` is `admin-reference.js:99-107,112-126`, and the generic reference writer refuses `category='custom_role'` (`:24`) and never writes `details` (`:27-29`). Keys are filtered through `ROLE_PERMISSION_KEYS` on create and update (`:76`). The fail-open branch (`middleware/permissions.js:19`) is documented break-glass in code `:3-14` and ADR-042:19-23; production does always resolve both fields (`auth.js:40-60`), but **no test pins that premise** → G-03. **G-01 (High)**: the invitee, not the inviter, decides `custom_role_id` — `POST /auth/provision` trusts the client body (`routes/auth.js:69-77,127-130`), the invite writes the tag to client-editable `user_metadata` and only `{role}` to `app_metadata` (`admin-users.js:181-187,213`). **G-02 (Medium)**: the bundle is not a ceiling for `roles.manage`/`users.manage` (`admin-reference.js:112-139`, `admin-users.js:145-167`). Incorporated from §3; not re-derived here. |
| 3 | AI endpoints | **PASS** | `routes/ai.js:9-19` (1–10 messages, ≤1000 chars, last message must be `user`), role brief chosen server-side with `Object.hasOwn` (`:27-30`) and no client brief key; `auth` + `aiLimiter`; 503 fail-closed (`:34-35`); provider errors collapse to a detail-free 502 (`:45-48`). `routes/aiMatch.js:10-14,88-97` has its own bounds (prompt ≤500 chars, ≤200 UUID candidate ids, ≤30 ranked, ≤300-char description excerpt) and `auth` + `requireRole('job-seeker')` + `jobMatchLimiter` (`:154`). **No PII leaves the system:** the match prompt contains only public job fields (`aiMatch.js:34-43,127-131`) plus the seeker's own typed preference; seeker skills/barangay are used only in the deterministic local ranker (`:117`); the help prompt is a static role brief (`ai/briefs.js`) plus the user's messages. The documented `POST /ai/resume-extract` (ADR-045) **does not exist in code** (§4, F-18), so no resume text is sent anywhere. Provider layer logs only status class + latency, never prompts/replies (`aiProvider.js:50-58`). Output is rendered as JSX text only (`src/shared/components/HelpChat.jsx:106`, `src/shared/components/JobCard.jsx:65-66`) and never feeds SQL, a path, or a shell. |
| 4 | Turnstile captcha (ADR-041) | **PASS (by delegation) — config unverifiable statically** | The secret is not in this repo by design: verification is Supabase Auth CAPTCHA protection (`docs/arch/adr-041-auth-captcha-turnstile.md:28-33,53`). Every credential call site forwards `captchaToken`: `src/shared/services/auth.js:98-104,121-164,189-198,209-212`; widget rendered on all five flows (`src/shared/components/Turnstile.jsx`, `ChangePassword.jsx:81`, `ForgotPassword.jsx:70`, `EmployerRegister.jsx:175`, `JobSeekerRegister.jsx`). The API has no credential endpoint — `/api/auth/provision` requires an already-issued JWT (`routes/auth.js:18`), so "skip captcha by calling the API directly" has no target. Tokens are single-use/5-minute (ADR-041:57-58) and failures reset the widget. **Gap:** the Supabase dashboard toggle and a live replay/omission probe cannot be verified read-only; Phase 4 owns the runtime proof. |
| 5 | Remote database (ADR-044) | **PARTIAL → F-10 (Low)** | The connection string never appears in a log: the error middleware logs `code/sqlState/message` + method/path/request-id only (`app.js:147-155`), and `logger` never receives the URL. **But TLS is not enforced in code:** `server/src/db.js:14-21` passes `connectionString` with no `ssl`/`sslmode` assertion, and node-postgres defaults to plaintext when the URL omits `sslmode`. Current production is loopback (`docs/plan/done/2026-11-12-api-vps-cutover.md:81,93` — `127.0.0.1` + `sslmode=disable`), so there is no network exposure today; the control the plan asked to verify does not exist. See F-10. |
| 6 | Metrics endpoint (ADR-043) | **PASS** | Constant-time compare with a length check (`routes/metrics.js:14-20`); unset token → 404, not 401 (`:22-25`); payload is counts/latency/last-error only (`middleware/metrics.js:64-83`). `METRICS_TOKEN` has zero hits under `src/**` (not bundled) and is read only in `routes/metrics.js:15` (never logged). |
| 7 | Profile images (ADR-040) | **PASS** | Same magic-byte gate as resumes (`upload.js:107-121` → `matchesSignature` at `:47-52`), extension allow-list `png/jpg/jpeg/webp` (`:10`), 2 MB cap (`:13,108`). Bytes go to Postgres in memory; serving is by dedicated routes with an ownership check (`profiles.js:117-130`) or public-logo-only (`:143-148`), MIME from the stored extension (`:95`), `Cache-Control: private` for avatars (`:93-94`). No unbounded image size and no path input. |
| 8 | One resume per account (ADR-049) | **PASS — deployment order matters (F-17)** | Replace is in place under a per-seeker advisory lock (`profiles.js:286-300`), so no two-row state and `job_applications.resume_id` keeps resolving; delete re-checks ownership (`:332-338`) and takes the same lock (`:340-345`); a failed write unlinks the just-written file (`:301-306`); the replaced file is unlinked after commit (`:307-310`). Uniqueness is enforced twice: `db/migrations/014_one_resume_per_seeker.sql:43-44` and `db/schema.sql:445` (`resumes_one_per_seeker_uidx`). The migration repoints applications before deleting non-keeper rows (`014:11-40`). See F-17 for the code-before-migration hazard. |
| 9 | Token cache (ADR-028) | **PASS** | Keyed on the exact token string, per-process, TTL 60 s, FIFO cap 5 000 (`tokenCache.js:19-50`); only definite verdicts memoized — transport/429/5xx never (`:27-42`). Never logs the token or principal. Authorization is **not** cached: `resolveRole` re-reads Postgres every request (`auth.js:23-49`, `tokenCache.js:9-13`), so suspension and permission changes are immediate; the 60 s window is the accepted ceiling (ADR-028:21). |
| 10 | Request log / metrics PII | **PARTIAL → F-09 (Low)** | `requestLog` logs method + `req.path` (no query string) + status + ms + correlation id, and skips healthy health probes (`middleware/requestLog.js:8-26`); bodies and headers never reach it. `metrics` aggregates `METHOD class` counts and latency buckets (`middleware/metrics.js:40-62`). **Exception:** a 5xx records `req.originalUrl` — query string included — into `lastError` and posts it to `ALERT_WEBHOOK_URL` (`metrics.js:55-58`, `:29-38`). See F-09. |

---

## 3. G-series incorporated by reference (do not re-audit)

Source: `docs/arch/audit/2026-11-13-admin-guard-matrix.md` (all 30 admin routes read, one mock-based
suite executed 7/7). Statuses below are as delivered; they are not re-derived here.

| ID | Severity | One-line | Status |
|---|---|---|---|
| **G-01** | **High** | Invitee controls `custom_role_id` at provision → can take the break-glass (no custom role) path and obtain every admin permission. | **Open — blocking** |
| G-02 | Medium | `roles.manage`/`users.manage` are admin-equivalent: a tagged admin can widen its own bundle, delete its own role (→ break-glass), or invite a full super-admin. | Open — needs ADR-042 amendment or "cannot grant what you lack" |
| G-03 | Medium | No test pins that `resolveRole` actually reads `reference_data.details->'permissions'`; the fail-open branch rests on it. | Open |
| G-04 | Low | Permission-enforcement test table mislabels a route and has no allow/deny per key (assurance gap). | Open |
| G-05 | Low | `DELETE /admin/reference/:id` answers 403 for custom-role rows vs 404 otherwise → category oracle for `settings.manage`. | Open — accept or align to 404 |
| G-06 | Low | `dashboard.view` gates the full PII directory (applicant/employee/referral lists with email/phone/barrio). | Open — split key or relabel |
| G-07 | Info | No guard against removing the last break-glass super-admin. | Accepted (ADR-042:60-62) |

The guard-matrix verdict is **FAIL — blocking G-01**; this delta audit adopts it. G-01 is one of the
two gate blockers.

---

## 4. New findings (F-08 .. F-19)

| ID | Severity | OWASP | file:line | Issue | Recommended fix |
|---|---|---|---|---|---|
| **F-08** | Low | A09:2021 Logging / integrity | `server/src/routes/auth.js:161-169` | `/api/audit` allow-lists `action` (F-03 fix) but still accepts client-controlled `entity`, `entity_id` and `details`, so a user can label their own `auth.login` row with any entity/id/detail. The SPA no longer calls this endpoint at all (`grep -r "audit" src/shared/services` → 0 callers), so it is unused write surface with an unbounded `details` JSON blob (1 MB body cap). | Drop `entity`/`entity_id`/`details` from the accepted body (derive nothing — write `null`), or delete the route if the SPA genuinely no longer uses it. |
| **F-09** | Low | A09:2021 / PII in logs | `server/src/middleware/metrics.js:55-58` | A 5xx stores `req.originalUrl` — **including the query string** — in `lastError`, which is exposed by token-gated `GET /api/metrics` and posted to `ALERT_WEBHOOK_URL` (Slack/Discord). Admin search terms (`/api/admin/users?search=<name>`, `admin-users.js:20-33`) and audit-log filters (`?userId=<uuid>`, `admin.js:181-190`) can carry personal identifiers into a third-party webhook. | Use `req.path` (as `requestLog.js:13` already does) or truncate at `?`. No other change. |
| **F-10** | Low | A05:2021 Security Misconfiguration | `server/src/db.js:14-21`; topology at `docs/plan/done/2026-11-12-api-vps-cutover.md:81,93` | `DATABASE_URL` may be plaintext: `pg.Pool({ connectionString })` has no `ssl` option and no `sslmode` assertion, and node-postgres does not default to TLS. Production is same-host loopback (`sslmode=disable`) so nothing is exposed today, but the "requires TLS" control the audit expected does not exist — a future re-point to a remote host would silently run plaintext. ADR-044 records `sslmode=no-verify` as the only working mode before the loopback move. | Boot-time guard in `db.js`/`env.js`: if the URL host is not `127.0.0.1`/`localhost`/a Unix socket and `sslmode` is not `verify-full`, exit 1 with a non-leaking message. Cheap (≈6 lines) and it makes the topology assumption executable. Alternatively record it as an accepted ceiling in ADR-044 with the guard named as the upgrade path. |
| **F-11** | Low | A04:2021 Insecure Design | `server/src/routes/jobs.js:287-290, 355-361` | Residual of F-05: `salary_min`/`salary_max` are compared (`Number(a) > Number(b)`) but never validated as numeric. `POST/PATCH /jobs` with `"salary_min":"abc"` passes the comparison (`NaN > x` is false) and reaches the `numeric` column → Postgres 22P02 → generic 500 instead of the contract's 400. | Validate `Number.isFinite(Number(v))` for both salary fields in the same block that checks the min/max relationship (POST and PATCH). |
| **F-12** | Low | A04:2021 / RA 10173 | `src/shared/content/legal.js:53-60`; behaviour at `server/src/routes/admin.js:158-171` | The retention paragraph is generic ("retained only while necessary…"). The code has a concrete rule: non-employment applications are purged at **12 months**, while `Accepted`/`Placed`/`Terminated` are retained as employment records. A data subject cannot learn the actual period from the notice. | Add one sentence to §4: "Applications that do not result in employment are deleted 12 months after submission. Records of accepted, placed, or terminated employment are retained as employment records." |
| **F-13** | Low | A04:2021 / RA 10173 | `src/shared/content/legal.js:18-26`; collection at `server/src/routes/auth.js:8-10`, `server/src/routes/profiles.js:14`, `server/src/routes/auth.js:94` | §1 names name/address/email/mobile/credentials but omits **birthdate**, which the registration and profile forms collect and store (`job_seekers.birthdate`). | Add "date of birth" to the identity-details bullet (and, if the form keeps it optional, say so). |
| **F-14** | Low | A04:2021 / RA 10173 | `src/shared/content/legal.js:38-39`; exports at `server/src/routes/reports.js:31-35,44-53,54-59` | The notice says municipal reports use "aggregated or anonymized information", but the shipped exports include per-applicant names/emails (`applicants`, `placements`) and a named seeker roster (`seekers`). The claim is narrower than the capability and will not survive a DPO read. | Reword to "aggregated employment statistics, and — where a report requires it — the limited applicant details needed for authorized PESO follow-up", or restrict the `seekers` export to counts. |
| **F-15** | **High** | A05:2021 Security Misconfiguration | `vercel.json:1-6` | The production frontend origin sends **no** `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` or `Permissions-Policy` (live HEAD, 2026-11-12 19:56 UTC, §6.1). Root cause: `vercel.json` has only `rewrites`; helmet covers `/api/*` on the separate VPS origin only (`server/src/app.js:56`). The site renders registration/login forms and resume uploads, so it is framable (clickjacking) and has no CSP as a second line against any future injection sink. | Apply the `headers` block in §6.2 to `vercel.json` (single source of truth, applies to HTML and assets). Allowances are enumerated from the built document and runtime origins — see §6.1. |
| **F-16** | Low | A05:2021 | live response header on `https://www.joblinked.site/` (not in `vercel.json`; no `headers` key ever existed: `git log --all -- vercel.json`) | The frontend host answers `Access-Control-Allow-Origin: *`. Not set by this repo and not from the API (API CORS fails closed, pinned at `server/src/__tests__/middleware-hardening.test.js:95-121`). The origin serves only public SPA assets and holds no credentials (Bearer tokens go to `api.joblinked.site`; no cookies), so cross-origin reads gain nothing. | Narrow it in the same `headers` block (`Access-Control-Allow-Origin: https://www.joblinked.site`, §6.2) to clear the scanner banner, **or** accept as a ceiling with the reason above. Do **not** touch the API's CORS — wrong layer. |
| **F-17** | Low | A04:2021 / data integrity | `db/migrations/014_one_resume_per_seeker.sql:43-44`; `server/src/routes/profiles.js:289-294`; `db/schema.sql:445` | Deploy-order hazard: the new replace path runs `update resumes … where seeker_id = $3` assuming the unique index already exists. If the API ships before migration 014, an account that still holds 2–20 resumes updates **every** row to the new path (duplicate rows, stale files unreferenced) and the later `create unique index` fails. ADR-049 requires the migration but nothing enforces the order. | Apply 014 before (or in the same window as) the code, and verify with `select seeker_id, count(*) … having count(*) > 1`. Defence in depth: `update … where seeker_id = $3 and id = (select id from resumes where seeker_id = $3 order by uploaded_at desc, id desc limit 1)`. |
| **F-18** | Info | — | `docs/arch/adr-045-resume-autofill-accuracy.md:17,20` | ADR-045 (status "Accepted") documents `POST /api/ai/resume-extract` and resume text going to the provider; the endpoint and module were removed (`docs/plan/done/2026-11-11-bug-hunt-plan.md:35-37,645-650`; no `resume-extract` under `server/src`). A privacy reviewer will chase a flow that does not exist, and will miss that the shipped position is *better*. | Amend ADR-045 to "not implemented / removed; autofill is client-side regex only" so the DPA conversation matches the code. |
| **F-19** | Info | — | live `Strict-Transport-Security: max-age=63072000` on the frontend host | HSTS is present (2 years) but without `includeSubDomains`. Optional: adding it binds `api.joblinked.site` and any future subdomain to HTTPS — correct here, but it is a one-way door for any non-TLS subdomain. | Decide deliberately; no change required now. Note in the ops runbook. |

---

## 5. Verified secure (do not regress)

Extends (does not replace) `docs/arch/audit/phase5-security-audit.md` §"Verified secure". Every item
below was re-read on 2026-11-13.

**Auth & authorization**
1. Three headline invariants hold (§1.1): auth coverage, parameterized SQL + allow-lists, no secrets
   under `src/**`.
2. Guard chains are ordered `[auth, requireRole('super-admin'), requirePermission(...)]` on all 30
   admin routes, and `requirePermission` re-asserts 401/403 itself (`middleware/permissions.js:17-18`).
3. Super-admin still requires the service-role-only `app_metadata.role` in addition to the role row
   (`auth.js:119-123`); a role-table write alone cannot mint an admin.
4. `resolveRole` is uncached per request, so suspension and permission changes are effective on the
   next request (`auth.js:23-49`; `tokenCache.js:9-13`).
5. `POST /auth/provision` is idempotent under a double-submit (23505 → 200 existing, `routes/auth.js:134-143`)
   and refuses a body-only super-admin (`:28-30`); `company_id` is never taken from a body
   (`profiles.js:29-83`, `jobs.js:297-298`, `applications.js:119-120`).
6. `canViewJob` returns 404 for non-owners and `listStatusFor` pins non-admins to `published`
   (`jobs.js:34-45,148-152`) — no draft/pending enumeration.
7. Applications enforce deadline + published status inside the INSERT (`applications.js:65-75`) and
   the duplicate guard is `23505 → 409` (`:76-79`) — no TOCTOU.
8. Employer credential reads and resume downloads re-check the `job_applications` link
   (`applications.js:181-196`, `profiles.js:441-453`); a non-owner gets 403/404, never bytes.

**Injection / XSS**
9. Every SQL value is bound; identifiers come from constants (§1.1 item 2). CSV export neutralizes
   formula injection (`reports.js:91-102`).
10. The only `dangerouslySetInnerHTML` in `src/**` is shadcn's `ChartStyle`
    (`src/components/ui/chart.jsx:33-47`); the interpolated values are the sanitized `useId` and a
    static config — data labels never enter the style block (`EmploymentCharts.jsx:5-8,31,49`). The
    prior "zero hits" claim was true when written; record the exception and why it is safe.
11. Model output is rendered as JSX text (`HelpChat.jsx:106`, `JobCard.jsx:65-66`); no `eval`,
    `new Function`, `document.write`, or `innerHTML` anywhere in `src/**`.

**Files**
12. Upload destination is `bucket + req.user.id` only; filename is `randomUUID + basename` with
    `[^a-zA-Z0-9._-] → _` (`upload.js:24-34`) — traversal via filename impossible.
13. Download containment uses `path.normalize` + `startsWith(uploadDir/bucket + sep)` after Express
    decoding, with a bucket allow-list (`profiles.js:430-437`); `sendFile` after `existsSync`;
    `Cache-Control: private` + `Vary: Authorization` (`:462-466`).
14. Segmented-image bytes are sized-capped and MIME is derived from the extension, never the client
    (`upload.js:57-66,107-121`; `profileImages.js:12-20`).

**Transport / headers / abuse**
15. CORS fails closed: production without `CORS_ORIGIN` allows localhost only and warns at boot
    (`app.js:65-86`); a non-localhost origin gets no ACAO (`middleware-hardening.test.js:117-122`);
    `credentials` is never enabled, and there are no cookies in the stack.
16. Limiter order is correct: `attachPrincipal` → auth/upload buckets → health → apiLimiter →
    body parser (`app.js:101-119`), so an anonymous 1 MB `JSON.parse` is throttled before parsing and
    auth/upload paths are never double-counted (`rateLimit.js:54-66`).
17. `requestId` echoes a client value only after `/^[\w.-]{1,128}$/` (`middleware/requestId.js:7-12`);
    the error middleware maps body-parser 400/413 and pool saturation 503 without leaking pg details
    (`app.js:124-155`).
18. Retention purge is server-scheduled and input-free; cutoff computed by Postgres, audit row
    written as system (`admin.js:158-178`).
19. `GET /api/metrics` is constant-time gated and indistinguishable from missing when unset
    (`routes/metrics.js:14-27`).

---

## 6. Phase 5 — external scanner cross-reference (frontend origin)

### 6.1 Live evidence (read-only, permitted)

`curl -sI https://www.joblinked.site/` and one GET of the same root, 2026-11-12 19:56 UTC
(`Date: Thu, 12 Nov 2026 19:56:01 GMT`, `X-Vercel-Cache: HIT`, `Age: 2750`):

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=0, must-revalidate
Content-Type: text/html; charset=utf-8
Server: Vercel
Strict-Transport-Security: max-age=63072000
```

Absent: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, COOP/COEP/CORP. Present: HSTS. The served document
references only same-origin `/assets/*`, `/joblinked-icon.png`, and
`https://fonts.googleapis.com/css2?family=Geist…` with `preconnect` to `https://fonts.gstatic.com`.
Runtime origins come from source, not the shell: Turnstile's script/iframe at
`https://challenges.cloudflare.com` (`src/shared/lib/turnstile.js:4`), the API at
`https://api.joblinked.site` (`docs/plan/done/2026-11-12-api-vps-cutover.md:212`), Supabase Auth at
`https://omvnwyawamotmzvehdgo.supabase.co` (same file `:82`), and API-served logos via `apiAssetUrl`
(`src/shared/lib/api.js:13-15`). Avatars and resume previews use `blob:` URLs
(`src/shared/services/images.js:50`, `src/shared/services/documents.js:78`).

### 6.2 Disposition table

| Scanner finding | Owning layer | Disposition |
|---|---|---|
| Missing CSP, XFO, XCTO, Referrer-Policy, Permissions-Policy | Vercel static host — `vercel.json:1-6` has no `headers`; helmet covers `/api/*` only (`app.js:56`) | **F-15 (High).** Patch below. |
| `access-control-allow-origin: *` on the frontend host | Vercel platform default — no `headers` key ever existed (`git log --all -- vercel.json`); API CORS fails closed (`middleware-hardening.test.js:95-121`) | **F-16 (Low).** Override to the canonical origin in the same block, or accept as a ceiling (public assets, no credentials). Not an API change. |
| `strict-transport-security: max-age=63072000` present | Vercel-managed | **No action.** Optional `includeSubDomains` → F-19 (Info). |
| `server: Vercel` | Platform fingerprint | **No action.** |
| COOP / COEP / CORP "upcoming" | Frontend host | **Info, no action in this patch.** CSP `frame-ancestors 'self'` + XFO cover framing. CORP on the frontend would break nothing but adds little; the API already sets CORP `cross-origin` for file streaming (`app.js:56`). Add later only if a real embedding need appears. |

### 6.3 Proposed patch — `vercel.json` (text only; do not apply during the audit)

```diff
 {
   "$schema": "https://openapi.vercel.sh/vercel.json",
   "rewrites": [
     { "source": "/(.*)", "destination": "/index.html" }
+  ],
+  "headers": [
+    {
+      "source": "/(.*)",
+      "headers": [
+        {
+          "key": "Content-Security-Policy",
+          "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://api.joblinked.site; connect-src 'self' https://api.joblinked.site https://omvnwyawamotmzvehdgo.supabase.co https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; worker-src 'self'; manifest-src 'self'; upgrade-insecure-requests"
+        },
+        { "key": "X-Content-Type-Options", "value": "nosniff" },
+        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
+        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
+        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
+        { "key": "Access-Control-Allow-Origin", "value": "https://www.joblinked.site" }
+      ]
+    }
   ]
 }
```

Allowance provenance (do not guess-add):

| Directive value | Evidence |
|---|---|
| `script-src https://challenges.cloudflare.com` | `src/shared/lib/turnstile.js:4` (script injected at runtime) |
| `frame-src https://challenges.cloudflare.com` | Turnstile renders an iframe widget (`Turnstile.jsx:13-40`) |
| `style-src 'unsafe-inline'` | React inline style props (`EmploymentCharts.jsx:70`; shadcn components) |
| `style-src https://fonts.googleapis.com` | built `dist/index.html` and live root `<link href="https://fonts.googleapis.com/…">` |
| `font-src https://fonts.gstatic.com` | same `<link>` + `preconnect` in the live root |
| `img-src blob:` | avatars/previews via `URL.createObjectURL` (`images.js:50`) |
| `img-src https://api.joblinked.site` | public logos via `apiAssetUrl` (`api.js:13-15`) |
| `connect-src https://api.joblinked.site` | `VITE_API_URL` in the cutover runbook (`2026-11-12-api-vps-cutover.md:212`) |
| `connect-src https://omvnwyawamotmzvehdgo.supabase.co` | Supabase project URL (`2026-11-12-api-vps-cutover.md:82`); also needed by the auth client |
| `worker-src 'self'` | pdf.js worker is a hashed same-origin asset (`src/shared/lib/resumeText.js:53-59`) |
| no `unsafe-eval`, no `unsafe-inline` in `script-src` | built document has no inline script (live root: one module `<script src="/assets/…">`) |

Verification after the fix lands (separate task): `curl -sI https://www.joblinked.site/` shows all
five headers; open Jobs, registration (Turnstile), a resume upload/preview, a company logo, and the
CSV download in a browser with DevTools open — zero CSP violations; then re-run the external
scanner.

**Caveat to carry into the fix task:** if Turnstile's injected bootstrap logs a CSP violation on
`script-src`, the documented fallback is `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`
(and nothing else). Do not add `unsafe-eval`.

---

## 7. Phase 2 — secrets and supply chain

**Tracked env files.** `git ls-files` → `.env.example`, `.env.test`, `server/.env.example` only.
`git log --all --diff-filter=A` for `*.env*` shows only those three ever added (2026-10-05, 2026-11-04,
2026-11-10, 2026-11-12 checkpoints). `.env.test` holds public test placeholders only
(`.env.test:3-5`); both `.env.example` files use placeholders (`<password>`, `<service-role-key>`,
`<anon-key>`, blank `OPENROUTER_API_KEY`/`METRICS_TOKEN`).
`git check-ignore -v .env.local server/.env` → matched (`.gitignore:19` `*.local`, `.gitignore:36` `.env`).
No `.env` file exists in history.

**Secret grep** (`git grep -E "SUPABASE_SERVICE_ROLE|DATABASE_URL|OPENROUTER_API_KEY|TURNSTILE_SECRET|METRICS_TOKEN"`):
hits are `server/src` (env reads only: `aiProvider.js:19`, `auth.js:9`, `db.js:15`, `env.js:3`,
`routes/metrics.js:7,15`; no test files counted), `server/.env.example`, `db/apply-migrations.sh` (shell variable,
no value), `.github/workflows/ci.yml:40` (CI-only `postgres:postgres` on localhost), `AGENTS.md`, and
`docs/**`. `src/**` → **0 hits**. `TURNSTILE_SECRET` → **0 hits anywhere** (correct: it lives only in
the Supabase dashboard, ADR-041:33,53). No JWT-shaped literal in the tree (`git grep -l -E "eyJ…"` → 0).
The only `*supabase.co` mentions are the public project URL in docs/examples.

**`npm audit` (2026-11-13, registry data as of run).** Never `--force`; nothing auto-fixed.

| Workspace | Result | Triage |
|---|---|---|
| root (`package-lock.json`) | **4 moderate** | All dev-only: `minimatch` 7–11 DoS via globparts amplification (GHSA-g3hv-75wg-m249), reached through `eslint` → `@eslint/config-array`. Not in the shipped bundle; `npm audit` itself says the fix is a breaking eslint major. Root is below CI's `--audit-level=high` gate (`.github/workflows/ci.yml:45-47`). Re-check at the next eslint bump; no runtime exposure. |
| `server/` (`server/package-lock.json`) | **0 vulnerabilities** | Clean. |

This is a large improvement over the 2026-11-04 baseline (recorded as 11 root / 6 server,
`2026-11-04-04-security-compliance-plan.md:109-111`); the CI steps can be tightened to blocking once
the root moderate set clears.

**Dependency delta vs 2026-11-04** (`git diff 06858ed -- package.json server/package.json`, 06858ed =
last commit before 2026-11-05 00:00): **no new runtime dependencies** in either workspace. `sonner`
was removed from the root. Server deps are unchanged (`@supabase/supabase-js`, `compression`, `cors`,
`dotenv`, `express`, `express-rate-limit`, `helmet`, `multer`, `pg` — `server/package.json:13-23`).
New root *scripts* only (`smoke`, `backup:uploads`, `eval:autofill`). `@dietrichgebert/ponytail`
(dev-only, MIT, registry tarball with integrity, **no install/postinstall script**) predates the
delta; `puppeteer-core` likewise. Nothing to review for ownership/age beyond that.

---

## 8. Phase 3 — legal copy review

**Source of truth: confirmed.** `src/features/public-site/Legal.jsx:3-11` imports both documents for
`/privacy` and `/terms`; `src/shared/components/TermsModal.jsx:5-11` renders the privacy notice as the
registration consent (the `TERMS_PLACEHOLDER` export is now just an alias for `PRIVACY_NOTICE`, no
divergent text). Footer links (`PublicShell.jsx:99-100`, `DashboardFooter.jsx:10-11`,
`AccountSettings.jsx:20-21`) are routes into `Legal.jsx`, so all four surfaces read one source. No
placeholder text remains. Guarded by `src/features/public-site/__tests__/Legal.documents.test.jsx`.

**Matches the implementation:** identity/contact, employment profile, résumés/documents, application
records, notifications and technical logs (§1 vs `routes/auth.js:8-10`, `profiles.js:12-21`,
`schema.sql` resumes/applications); purposes job matching + application status + notifications +
municipal reporting (§2 vs `jobs.js`, `applications.js`, `reports.js:31-86`); employer sharing on
application with employer named in the UI (§3 vs `applications.js:45-85` and the apply screen);
RA 10173 rights including NPC complaint and DPO referral (§5); no payroll/payment claim matches the
prohibited-fee filter (`services/jobFeeFilter.js`). The one-resume change did not invalidate the
notice, and the profile copy was updated to match it (`Profile.jsx:629,641`).

**Gaps → three Low findings, each naming the missing sentence:**

- **F-12** — retention is generic; the 12-month purge / employment-record split is not stated
  (`legal.js:53-60` vs `admin.js:158-171`).
- **F-13** — birthdate is collected but not listed (`legal.js:18-26` vs `auth.js:8-10,94`).
- **F-14** — "aggregated or anonymized" reports do not match the named applicant/seeker exports
  (`legal.js:38-39` vs `reports.js:31-59`).

One optional observation (not numbered; prior audit INFO): the AI provider is a third-party
processor. §3's "service providers … subject to confidentiality and security obligations" covers the
category but does not name AI; no data-subject content is sent (`aiMatch.js:34-43`), so a DPA line
can wait for the next copy pass.

---

## 9. Accepted ceilings (keep; do not re-flag)

| Ceiling | Where recorded | Status after this audit |
|---|---|---|
| 60 s JWT revocation window (Supabase-side sign-out/password reset) | ADR-028:21; `tokenCache.js:9-13` | Unchanged. Local suspension stays immediate. |
| In-memory rate-limit store | ADR-037 (single node); `rateLimit.js:4` | Unchanged. Valid while one API process. |
| Four unbounded reads by design | `2026-11-04-04-security-compliance-plan.md:27-29` | Unchanged. The new resume list is bounded at one row by ADR-049. |
| Audit-log date filter assumes a UTC+8 Postgres session | `admin.js:191,196` (`ponytail:` comment) | Unchanged; the comment names the upgrade path. |
| Helmet's default CSP as the API policy | `app.js:50-55`; pinned by `middleware-hardening.test.js:35-42` | Unchanged. Revisit only if the API serves HTML. |
| Custom-role bundle is not a ceiling for `roles.manage`/`users.manage` | **New** — G-02 | **Not accepted.** Needs an ADR-042 amendment or the "cannot grant what you lack" rule. |
| `access-control-allow-origin: *` on the frontend origin | **New** — F-16 | Accepted *or* narrowed by the §6.3 patch; either is defensible, do not leave it undocumented. |
| Applications resolve to the account's current résumé after a replace | **New** — ADR-049:13,21 | Accepted; UI copy already says so (`Profile.jsx:629`). |

No other new ceiling is introduced, so no new ADR is required for the findings above.

---

## 10. Gaps — checks not possible under the read-only / no-live rules

1. **Turnstile enforcement state.** The Supabase CAPTCHA toggle, a replay of a used token, and an
   omission request against Supabase Auth are runtime/dashboard facts. Phase 4 owns them.
2. **Database state.** No DB was contacted, so I could not confirm: migration 014 applied; any
   `seeker_id` with >1 resume; every `reference_data.details` bundle well-formed; a break-glass
   super-admin exists. G-01/G-02's runtime proof is also Phase 4's (guard-matrix §7).
3. **G-01 exploitability.** Static only; the escalation path is code-evident but unproven live.
4. **Vercel project settings.** `Access-Control-Allow-Origin: *` and HSTS are platform-emitted; the
   dashboard may add headers not visible in the repo. The §6.3 block overrides what the repo owns.
5. **Dependency provenance beyond the lockfile.** Ownership/age of `@dietrichgebert/ponytail` was
   checked only for install scripts/integrity, not for maintainer history (no registry API call).
6. **`dist/` vs production build.** The live bundle hash (`index-2DI27wb0.js`) differs from the local
   `dist/` (`index-Fq3QpEV6.js`), i.e. the working tree is ahead of production. Findings describe the
   working tree; the header gap exists in both.
7. **No live API probes** (rate-limit rotation, upload abuse, authz matrix). Phase 4.

---

## 11. Evidence log

| Check | Method | Result |
|---|---|---|
| Route inventory / auth coverage | `Select-String` over `server/src/routes/*.js` for `router.<verb>(` without `auth|tokenAuth|optionalAuth`, then manual read of every hit | Only the deliberate anonymous routes in §1.1; admin chains carry `auth` inside their spread constants |
| Every in-scope file | full read: `app.js`, `auth.js`, `db.js`, `env.js`, `index.js`, `logger.js`, `tokenCache.js`, `upload.js`, `profileImages.js`, `util.js`, `aiProvider.js`, `ai/briefs.js`, `middleware/{permissions,rateLimit,requestId,requestLog,metrics}.js`, `routes/{auth,jobs,applications,profiles,admin,admin-users,admin-reference,admin-shared,reports,notifications,health,metrics,ai,aiMatch}.js`, `matching/{matchCache,score}.js`, `services/jobFeeFilter.js` | — |
| F-01/F-02 pins | `vitest run src/__tests__/f01-f02-rate-limit-keying.test.js src/upload.signatures.test.js` | 2 files, 10 tests passed (2026-11-13) |
| Resume one-per-account | `vitest run src/__tests__/b4-resume-upload.test.js src/__tests__/file-storage.regressions.test.js` | 2 files, 10 tests passed (2026-11-13) |
| Permission wiring | guard-matrix agent executed `permission-enforcement.test.js` 7/7 (by reference) | adopted |
| Secrets in history | `git log --all --diff-filter=A -- "*.env*"` | only `.env.example`, `.env.test`, `server/.env.example` |
| Secret grep | `git grep -E "SUPABASE_SERVICE_ROLE|DATABASE_URL|OPENROUTER_API_KEY|TURNSTILE_SECRET|METRICS_TOKEN"` | no `src/**` hits; no `TURNSTILE_SECRET` anywhere; context in §7 |
| Ignore rules | `git check-ignore -v .env.local server/.env` | both ignored (`.gitignore:19,36`) |
| JWT-shaped literals | `git grep -l -E "eyJ[A-Za-z0-9_-]{10,}\."` | 0 files |
| Dependency audit | `npm audit` root + `npm --prefix server audit` | 4 moderate (dev-only) / 0 |
| Dependency delta | `git diff 06858ed -- package.json server/package.json` | no new runtime deps; `sonner` removed |
| Dependency install scripts | read `node_modules/@dietrichgebert/ponytail/package.json` | no install/postinstall |
| Frontend sinks | grep `dangerouslySetInnerHTML|innerHTML|document.write|eval(|new Function` over `src/**` | 1 hit, `components/ui/chart.jsx:33` — static config/`useId` only |
| Model-output rendering | read `HelpChat.jsx:100-116`, `JobCard.jsx:60-70`, `OpportunityList.jsx:286-298` | JSX text only |
| Legal source of truth | grep `PRIVACY_NOTICE|TERMS_OF_USE|shared/content/legal` + read `Legal.jsx`, `TermsModal.jsx`, footers | one source, no placeholder |
| Prod frontend headers | `curl -sI https://www.joblinked.site/` + one GET of the same root, 2026-11-12 19:56 UTC | five headers absent; ACAO `*`; HSTS present |
| Vercel history | `git log -p --all -- vercel.json` | no `headers` key ever present |
| Built shell assets | read `dist/index.html` + live root body | Google Fonts links; set of same-origin `/assets/*` |

---

## 12. Fix-task handoff (planned separately; auditors do not edit code)

| Order | Task | Findings |
|---|---|---|
| 1 | Custom-role tag from `app_metadata`, body ignored, audit the resolved tag | G-01 (blocking) |
| 2 | Frontend `vercel.json` headers block (§6.3), then browser-verify CSP + re-scan | F-15 (blocking), F-16 |
| 3 | Decide G-02: "cannot grant what you lack" + self-role guard, or amend ADR-042 | G-02 |
| 4 | Pin `resolveRole` bundle resolution with a mock test | G-03, G-04 |
| 5 | `req.path` in metrics lastError; drop client fields from `/api/audit` | F-09, F-08 |
| 6 | Boot guard for non-loopback `DATABASE_URL` without `verify-full` | F-10 |
| 7 | Numeric salary validation; `doc_type` allow-list (F-04 still open) | F-11, F-04 |
| 8 | One copy edit for the three legal sentences | F-12, F-13, F-14 |
| 9 | Apply migration 014 before the next API deploy; amend ADR-045 | F-17, F-18 |

```
Gate: FAIL — blocking G-01 (High) and F-15 (High).
```

_Delta audit complete. Phase 4 live probes and the Phase 1 item-2 guard matrix are owned by other
agents and are not re-run here._

---

## 13. Phase 4 merge and Lead Architect sign-off (2026-11-13)

Phase 4 live probes (`2026-11-13-phase4-probes.md`) and the guard-matrix deep pass
(`2026-11-13-admin-guard-matrix.md`) are complete. Merged result:

| ID | Severity | Status after Phase 4 |
|---|---|---|
| G-01 | High | **Confirmed live** (P-06): provision with `custom_role_id` omitted stores `NULL` → full break-glass admin (200 on `/admin/users`, `/admin/stats`, `/admin/audit-logs`); with the tag passed, the same account is correctly limited. The body can also select any other catalogue bundle. Escalation is invisible in the `auth.register` audit row. |
| G-02 | **High (live) — matrix had Medium** | **Confirmed live** (P-07/P-08), two High vectors: `roles.manage` self-widen to all nine keys (previously-denied endpoint → 200) and self-delete (→ break-glass); `users.manage` can null another admin's `custom_role_id` (→ full break-glass); `users.manage` full-admin invite code-confirmed (runtime blocked by email cap). The matrix's Medium rating is superseded for fix priority: G-02 is gate-blocking. |
| P4-01 | Low | Captcha enforcement is provider-dashboard-only; the dev Supabase project has it off (password grant succeeds with no/garbage token). Not verifiable from the repo; needs a production verification artifact. |
| P-01-O-1 | Info | `server/scripts/verify-live.mjs:258-259` still asserts `403` for "employer B reads A's jobs"; ADR-048/contract and the API return `200` pinned to published-only. Harness assertion is stale; API is correct. |
| — | Pass | P-01 authz matrix + 404-not-403; P-02 rate-limit keying (F-01/F-02); P-03 upload abuse (all 400, zero files written); P-05 prototype pollution inert; P-09 JWT forgery (alg:none, HS256 confusion, kid/jku/jwk, payload swap) all 401. |
| — | Unprobed | Turnstile in production (dashboard switch; dev off); Supabase `signUp` and invite-created end-to-end (dev email rate limit); `/api/ai/help` body validation (no key → 503); foreign-project token (no second signing key). |

Probe hygiene: fixtures deleted, DB counts back to baseline, uploads 4→4; +30 append-only
`audit_logs` rows deliberately retained (deleting security logs would be anti-forensic). Local API on
port 4000 was reused, not started, and left running.

**Final gate: FAIL — blocking G-01 (High), G-02 (High on live proof; matrix had Medium), and F-15 (High). No Critical.**

**Lead Architect sign-off (2026-11-13):** the audit plan is fully executed; every prior finding has a
disposition and every in-scope surface a verdict. The findings are accepted as accurate — G-01 was
independently verified by me at `routes/auth.js:72-77,126-129` + `middleware/permissions.js:19`
before Phase 4 ran, and the Phase 4 live proof upgraded G-02 to High. Fix tasks proceed per §12, in
order: G-01 (backend), then the `vercel.json` headers block (F-15/F-16, Vercel deployment specialist),
then G-02 enforcement (decision taken: enforce — see fix plan Task 3). All three block the gate. No
fix is applied by an audit agent; the gate re-opens only after the three High findings are fixed and
re-verified with local probes (P-06, P-07, P-08) plus a read-only header check of the production site
root.
