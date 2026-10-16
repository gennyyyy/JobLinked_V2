# Phase 2 — Bug Hunt Report

**Project:** JobLinked (PESO Santa Maria)
**Date:** 2026-10-15
**Auditor:** Debugger (subagent, Phase 2)
**Method:** Read-only trace of `server/src/**`, `src/shared/**`, `src/features/**`, `db/schema.sql`. Pure-JS hypotheses verified with runnable snippets (results embedded). PostgreSQL type-cast behavior is standard/known, not runtime-verified here. No source modified.

---

## Summary

**15 findings** (2 Medium correctness bugs, 2 Low-Medium, 11 Low). The two headline gaps the task asked about turned out **clean** and are documented in §2: the duplicate-application guard is TOCTOU-safe, and the dynamic `ORDER BY` allowlist blocks injection. The real bugs cluster in **input-type coercion** (UUID / enum / date / unbounded integers reaching Postgres and 500ing instead of 400/404) and **two genuine logic bugs** (employer email-verification callback, one-way admin role move).

Severity key: **Medium** = wrong user-visible behavior on a normal path; **Low-Med** = wrong behavior on a plausible/concurrent path; **Low** = wrong status code / data-hygiene on malformed or edge input.

---

## 1. Bugs

### B1 — Employer email verification lands on a job-seeker-only callback (Medium)

- **Files/lines:**
  - `src/shared/services/auth.js:130` — `emailRedirectTo: `${window.location.origin}/auth/callback`` (one shared redirect for seeker *and* employer signup)
  - `src/features/auth/AuthCallback.jsx:27` — `if (profile?.role !== 'job-seeker') throw new Error('This account is not a jobseeker account.')`
  - `src/features/auth/AuthCallback.jsx:29` — success path is hardwired: `navigate('/job-seeker', { replace: true })`
- **Description:** Both `signUp()` roles share `/auth/callback`, but `AuthCallback` rejects any non-job-seeker. When Supabase requires email confirmation, an employer who clicks the verification link gets the error page *"This account is not a jobseeker account."* — even though provisioning succeeded just before the check (the employer row + pending accreditation are created). The only escape is "Go to sign in"; the user is never routed to the employer portal.
- **Reproduction:** Register at `/register/employer` on a Supabase project with email confirmation enabled → open the verification email link → error screen (account does work after manual sign-in, but the verification UX is broken and the message is wrong).
- **Suggested fix:** Route by role — `navigate(`/${profile.role}`, { replace: true })` and replace the hardcoded throw with a role-aware one (or split the redirect per role at `services/auth.js:130`). Add a regression test rendering `AuthCallback` with an employer profile.

### B2 — Admin role move is one-way: moving a user back to a previous role 500s (Medium)

- **File/lines:** `server/src/routes/admin.js:586-602` (specifically `:589` `update ${table} set status = 'inactive' …` and `:590-592` `insert into ${USER_TABLES[role]} (id, email, full_name, status) …`)
- **Description:** A role move deactivates the old row but leaves it in place. The insert into the target table uses the same `id`. Because each role table has `id` as PK (schema.sql:27,61,97), moving a user *back* to a table that still holds their old (inactive) row violates the primary key → PG `23505` → uncaught → 500 `INTERNAL`. (A same-email collision in the target table hits the per-table email unique index for the same reason.)
- **Reproduction:** As super-admin, move user U from `job-seeker` → `employer` (works). Then move U from `employer` → `job-seeker` → `POST /admin/users/U/role` returns 500; the user now exists as an active employer *and* an inactive job-seeker (and `resolveRole` precedence at `auth.js:9-19` silently keeps returning employer).
- **Suggested fix:** In the move transaction, `delete` (not just deactivate) the old-table row, or `on conflict (id) do update set status = 'active', email = excluded.email, full_name = excluded.full_name`. Wrap the insert to map `23505` to a 409 with a clear message. Add a round-trip test (A→B→A).

### B3 — Applications are accepted past the job deadline (server never checks it) (Medium)

- **Files/lines:**
  - `server/src/routes/applications.js:44-46` — checks only `job.status !== 'published'`; **no deadline check**
  - `src/features/job-seeker/JobDetail.jsx:94-95,234` — the only enforcement is `disabled={applying || deadlinePassed}` on the client
- **Description:** The deadline gate is UI-only. `POST /api/applications` with a valid token accepts an application to any `published` job whose `deadline` has passed. This is exactly the class of bug ADR-022 called out for the accreditation gate ("A UI check is not enforcement at the trust boundary — any employer could POST directly…"), and the admin dashboard separately counts these jobs as expired (`admin.js:25`).
- **Reproduction:** Take a published job with `deadline` yesterday. `curl -X POST /api/applications -H "Authorization: Bearer <seeker-token>" -d '{"job_id":"…"}'` → 201 created (the seeker UI shows the Apply button disabled).
- **Suggested fix:** In the insert path, after `loadJob`, reject when `job.deadline && job.deadline < today` (the DATE parser keeps `deadline` as `YYYY-MM-DD`; compare with `current_date` in SQL to avoid TZ issues, e.g. fold into the status check: `… where id = $1 and status = 'published' and (deadline is null or deadline >= current_date)`). One-line boundary fix + a route test.

### B4 — Concurrent resume uploads 500 on the one-active unique index and orphan the file (Low-Med)

- **File/lines:** `server/src/routes/profiles.js:176-194` (`POST /files/resumes`), constraint at `db/schema.sql:393` (`resumes_one_active_uidx on resumes(seeker_id) where is_active`)
- **Description:** The transaction does `update resumes set is_active = false where seeker_id = $1` then inserts the new row `is_active = true`. Two concurrent uploads by the same seeker: T2's `update` snapshot predates T1's inserted row (READ COMMITTED — an INSERT is invisible to a concurrent statement's scan), so T2's "deactivate all" misses T1's new active row, and T2's insert then violates the partial unique index → `23505` → rollback → 500. Additionally, unlike `storeDocument` (`profiles.js:122-125`), this route has **no `fs.unlink` compensation**: multer has already written the file to disk, so every failed upload leaks an orphaned file forever.
- **Reproduction:** In two tabs (or one script with two parallel requests) upload two resumes as the same seeker within the same instant → one request 500s and its file stays on disk under `uploads/resumes/<seekerId>/` with no DB row.
- **Suggested fix:** `try { …commit } catch (e) { rollback; try { fs.unlinkSync(req.file.path) } catch {} ; throw e }` — mirror `storeDocument`. For the 23505 race, either retry once inside the transaction or `on conflict` the partial index (`insert … on conflict (seeker_id) where is_active do update …` is not directly expressible on a partial index — simplest is catch-23505 → one retry of the whole transaction).

### B5 — Non-UUID path params reach Postgres and return 500 instead of 404 (Low-Med)

- **Files/lines (representative, pattern repeats ~20×):**
  - `server/src/routes/jobs.js:13-18` (`loadJob`) used by `:96-101` (public `GET /jobs/:id`), `:220`, `:264`, `:298`, `:329`, `:338`
  - `server/src/routes/applications.js:27-30` (`loadJob`) used by `:44` and `:76`; `:22-25` (`loadApp`) used by `:123`, `:178`
  - `server/src/routes/profiles.js:210` (delete resume), `:227` (activate resume), `:85` (accreditation PATCH), `:161` (document PATCH)
  - `server/src/routes/admin.js:488` (job PATCH), `:535` (publish/unpublish), `:63-73` (`findUserTable`, role/custom-role routes)
- **Description:** `:id` params are interpolated straight into `where id = $1`. Postgres infers `$1` as `uuid`; any non-UUID string raises `22P02 invalid input syntax for type uuid`, the handler never reaches its 404 branch, and `ah` forwards a 500. The error *shape* is still the contract's, but the status is wrong on a trivially reachable public path. Notably `admin.js:463` already validates notification ids (`/^\d+$/`), so the codebase has the right pattern — it just isn't applied.
- **Reproduction:** `curl localhost:4000/api/jobs/not-a-uuid` → `500 { error: { code: 'INTERNAL', … } }` (expected 404). Same for `POST /api/applications` with `job_id: 'xyz'`, `DELETE /api/files/resumes/abc`, `PATCH /api/accreditations/123`.
- **Suggested fix:** One shared `isUuid` guard (regex or `pg`'s `parse` of a UUID lib) applied in `loadJob`/`loadApp`/the `:id` handlers, returning 404/400 before the query; or a global error-middleware mapping of `22P02` to 400. A single test per route family.

### B6 — Enum-valued query filters are unvalidated → 500 on any invalid value (Low)

- **Files/lines:** `server/src/routes/admin.js:47` (`GET /admin/users?status=`), `:171` (`/admin/companies`), `:178` (`/admin/jobs`), `:189` (`/admin/applications`); `server/src/routes/jobs.js:110` (`GET /employers/:employerId/jobs?status=`)
- **Description:** `vals.push(req.query.status)` with `status = $1` against `account_status` / `job_status` / `application_status` enum columns. An invalid value raises `22P02 invalid input value for enum …` → 500. The jobs list route validates `workArrangement` against an allowlist (`jobs.js:57-58`) but not `status`; the admin filters validate nothing.
- **Reproduction:** `GET /api/admin/jobs?status=bogus` → 500 (expected 400 or an empty list).
- **Suggested fix:** Validate against the existing constant sets already in each file (`JOB_STATUSES`, `ADMIN_JOB_STATUSES`, a new `ACCOUNT_STATUSES`) and `err(res, 400, …)`; or reuse the ADMIN/PATCH validation shape.

### B7 — Unbounded `page` overflows the SQL OFFSET → 500 (Low)

- **File/lines:** `server/src/routes/jobs.js:46-47` (`const page = Math.max(1, parseInt(q.page) || 1)`) and `:90-91` (`offset $${vals.length + 2}` with `(page - 1) * pageSize`)
- **Description:** `page` has no upper clamp (unlike `pageSize`, clamped at `:47`, and audit-log `limit`, clamped at `admin.js:273`). **Verified:** `parseInt('99999999999999999999')` → `1e20`; `(1e20 - 1) * 10` serializes to the literal string `1e+21`, which Postgres rejects as a bigint OFFSET (`22P02`/`22003`) → 500.
- **Reproduction:** `GET /api/jobs?page=99999999999999999999` → 500.
- **Suggested fix:** Clamp: `Math.max(1, Math.min(1_000_000, parseInt(q.page) || 1))` (any sane cap), matching the existing `pageSize` clamp.

### B8 — `skills` query param as an array crashes with TypeError → 500 (Low)

- **File/lines:** `server/src/routes/jobs.js:77` — `if (q.skills?.trim())`
- **Description:** Express's query parser turns repeated keys into arrays: `?skills=a&skills=b` → `q.skills` is `['a','b']`, and `q.skills?.trim()` is not a function → TypeError → 500. **Verified:** `q.skills?.trim()` with an array throws `q.skills.trim is not a function`. Sibling params (`search`, `employer`) are array-tolerant via `String()` coercion; `skills` is the one that assumes a string.
- **Reproduction:** `GET /api/jobs?skills=a&skills=b` → 500.
- **Suggested fix:** `const skills = String(q.skills ?? '')` before the trim/split (one line, also makes the later `q.skills.split` type-stable).

### B9 — CSV export does not escape cells (Low)

- **File/lines:** `server/src/routes/reports.js:85` — `rows.map((c) => `"${c}"`)`
- **Description:** Cell contents are wrapped in quotes but embedded `"` are not doubled and newlines are not handled. **Verified:** a company name `SA "Best" Co` renders as `"SA "Best" Co"` — a malformed row that shifts every column after it in Excel/Sheets. Cell values come from user-entered job titles, company names, and seeker names, so this is reachable with ordinary data. (Secondary: a cell starting with `=`/`+`/`-`/`@` is a spreadsheet formula-injection vector from the same unfixed surface.)
- **Reproduction:** Create a job/company with a `"` in the name → `GET /api/admin/reports/vacancies/export` → broken CSV row.
- **Suggested fix:** `` `"${String(c).replace(/"/g, '""')}"` `` (one line). Prefix a `'` for formula-leading cells if that matters to PESO.

### B10 — Retention purge cutoff drifts a few days at month ends (Low)

- **File/lines:** `server/src/routes/admin.js:243-244` — `cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS)`
- **Description:** JS `setMonth` overflows short months. **Verified:** `new Date(2026, 2, 31).setMonth(2)` → `2025-03-30`, and other month-ends drift up to ~3 days. The automated 12-month purge (`admin.js:251-255`) therefore deletes applications slightly *outside* the Terms §4 window on those dates — a compliance-relevant off-by-days, not a crash.
- **Reproduction:** Run `runRetentionPurge()` on/after Mar 31 with applications from Mar 29–31 of the prior year; rows inside the retention window get deleted.
- **Suggested fix:** Compute the cutoff in SQL (`now() - interval '12 months'`) and pass nothing, or clamp the day: `cutoff.setMonth(cutoff.getMonth() - 12, Math.min(cutoff.getDate(), 28))`.

### B11 — `POST /auth/provision` double-submit returns 500, not the documented idempotent 200 (Low)

- **File/lines:** `server/src/routes/auth.js:31-35` (check-then-act `resolveRole`) and `:77-89` (insert; no `23505` handling)
- **Description:** The route is idempotent by design (comment at `:16`) but only via a prior-existence *check*. Two provisions racing (double-clicked submit, a fast refresh of `/auth/callback` or `/accept-invite`, or `signIn` + callback both firing) both pass the check; the loser's insert hits the PK → `23505` → rollback → 500. The codebase already maps `23505`→409 precisely in `applications.js:59` and `admin.js:295`; this route is the inconsistent one.
- **Reproduction:** Fire two `POST /api/auth/provision` with the same fresh token in parallel → one 500.
- **Suggested fix:** Catch `e.code === '23505'` around the insert and return the same 200 `{ ...existing.profile, role }` idempotent body.

### B12 — Audit-log `from`/`to` date filters are unvalidated → 500 (Low)

- **File/lines:** `server/src/routes/admin.js:269-271` — `vals.push(`${from}T00:00:00`)`
- **Description:** `from`/`to` are concatenated into timestamptz comparisons with no format check; any junk (or a partial date) raises `22007 invalid datetime` → 500. The sibling `userId` param *is* regex-validated (`:262`), so the omission is inconsistent. (The naive-local-vs-timestamptz comparison is already flagged with `ponytail:` comments in-file.)
- **Reproduction:** `GET /api/admin/audit-logs?from=abc` → 500.
- **Suggested fix:** `/^\d{4}-\d{2}-\d{2}$/` check on both, 400 otherwise.

### B13 — Admin user PATCH permits editing `email` (desync from Supabase) (Low)

- **File/lines:** `server/src/routes/admin.js:94-98` — allowlist built from `information_schema.columns`, which includes `email`
- **Description:** An admin can rewrite a user's local `email` to any string. Nothing syncs the change to Supabase auth (the login source of truth), and the per-table unique indexes (`schema.sql:453,466,479`) allow the same email to exist in a *different* role table — so the invite dupe-check (`admin.js:139-143`) and `auth/me` email can disagree with the actual account. All other identity-bearing fields are either blocked (`id`, `role`, timestamps at `:85-91`) or intentional.
- **Reproduction:** `PATCH /api/admin/users/<id>` with `{ "email": "someone-else@example.com" }` → 200; the user's displayed/logged email diverges from their login.
- **Suggested fix:** `delete body.email` (email is auth-owned), or explicitly reject it with 400 like `role`.

### B14 — `AuthProvider.loadProfile` late-resolve can install a stale profile (Low / theoretical)

- **File/lines:** `src/shared/context/AuthProvider.jsx:24-35`
- **Description:** `loadProfile` resolves asynchronously and its `setUser` updater decides "unchanged → keep current" by comparing the *fetched* profile against whatever is current at resolve time. If two loads overlap (session user replaced while the first fetch is in flight), the older response can win and install `{...oldSessionUser, ...oldProfile}` after the newer user has loaded. Practically hard to reach (sessions aren't persisted; `ProtectedRoute`/`PublicRoute` force logout on role change), hence Low — but the guard at `:55` (`signedInId.current === session.user.id`) protects the listener, not in-flight promises.
- **Reproduction (synthetic):** mock `getProfile` slow for user A, fast for B; trigger SIGNED_IN(A) then SIGNED_IN(B) in the same tick → final `user` is A.
- **Suggested fix:** Capture the target id and bail in the updater: `setUser((cur) => sessionUser.id !== signedInId.current ? cur : …)`, or track an in-flight request id.

### B15 — LIKE wildcards in search/employer filters are unescaped (Low)

- **Files/lines:** `server/src/routes/admin.js:48` (`%${search}%`, `/admin/users`), `server/src/routes/jobs.js:64-67` (`%${name}%`, employer filter)
- **Description:** User input containing `%` or `_` acts as a wildcard instead of a literal, so e.g. employer filter `a_b` matches `axb`, and a search of `%%` matches everything. Inconsistent with the same file's skills filter, which deliberately escapes wildcards (`jobs.js:80`, `t.replace(/[\\%_]/g, '\\$&')`). Not an injection issue (parameterized) — a correctness issue in result matching.
- **Reproduction:** `GET /api/jobs?employer=%` → returns every employer's jobs.
- **Suggested fix:** Apply the same escape helper already written at `jobs.js:80` to the `search`/`location`/`employer` patterns (or centralize it).

---

## 2. Areas probed and found CLEAN (negative results)

These were specifically requested and are **not** bugs — documented so fixers don't re-open them:

1. **Duplicate-application guard (`applications.js:41-67`)** — Correct by design: no app-level check-then-insert at all; the insert relies on the DB constraint `unique (job_id, seeker_id)` (`db/schema.sql:236`) and maps `23505 → 409` (`:59`). TOCTOU-safe. The only nit: the `job.status === 'published'` check at `:46` is likewise TOCTOU (a job closed between load and insert still accepts) — sub-second window, acceptable.
2. **Job status transitions + history writes (`jobs.js:148-157, 235-250, 304-314`; `admin.js:477-485, 500-524`)** — Update and history insert share one transaction on one dedicated client; concurrent transitions serialize on row locks (last-write-wins, both history rows recorded). No drift. Note the two `writeStatus` copies are byte-identical (pattern-review D3) — a sync-risk, not a bug.
3. **Resume active-swap (`profiles.js:226-244`)** — Transactional; row-lock serialization makes the activate path safe (see B4 for the *upload* path's insert race, which is the only broken variant).
4. **SQL injection surface (dynamic ORDER BY / column interpolation)** — All dynamic identifiers come from allowlists or DB-derived values: `ORDER_COLS` (`jobs.js:9,50-51`, direction binary `asc`/`desc`), `JOB_COLS`/`ADMIN_JOB_COLS` (`jobs.js:120-121`, `admin.js:472-473`), `information_schema` column validation (`admin.js:94-98`), fixed `USER_TABLES` map (`admin.js:35,589-591`), duplicate-route columns from the DB row itself (`jobs.js:267-272`), fixed table names in `seekerChild`/`credByLink`. Every *value* is parameterized. No injection found.
5. **`api.js` 401 refresh/retry (`src/shared/lib/api.js:44-107`)** — Straight-line, no loop/recursion: one refresh + one retry, then bounce. Covered by `api.test.js` including the double-401, refresh-throws, and tokenless cases. No unhandled rejection paths (`bounce`'s `signOut` is itself try/caught; `unreachable`/`throwStatus` throw into `request`'s caller, which pages handle).
6. **Notification/audit fan-out best-effort paths** — `audit` (`util.js:19-26`), `notifyUser` (`:28-35`), `notifyAdmins` (`:37-52`), `notifyMatchingSeekers` (`jobs.js:126-146`), `notifyDocAdmins` (`profiles.js:128-135`), and the retention interval (`admin.js:251-255`) all swallow failures internally; the `void`-ed call sites cannot produce unhandled rejections.
7. **Empty-string vs null vs undefined in PATCH bodies** — Handled deliberately and consistently: `''` → `null` except `NOT NULL`-defaulted text fields which keep `''` (`profiles.js:23-25,36`), title exempted (`jobs.js:224`). Array fields (`skills`, `tags`) are type-guarded before write (`jobs.js:189`, `profiles.js:37`). `skills: ''` → empty array via filter. No null-coercion bugs found.
8. **DATE parser (`db.js:5`)** — Keeping DATE as `YYYY-MM-DD` is correct for the birthday drift; no comparison bug found in code paths that read deadlines (frontend comparisons at `JobDetail.jsx:94-95` and `employer/JobPosts.jsx:442-444` use end-of-day local cutoffs consistently).
9. **`withQuery` boolean coercion (`api.js:18-26`)** — `unreadOnly: false` serializes to the string `'false'` and the server (`admin.js:445-446`) tests `=== 'true'` — works, though by luck of two independent literal conventions. Robustness nit only, not filed as a bug.
10. **Frontend fetch abort/resize handling** — No `AbortController` anywhere in `api.js`; in-flight responses can resolve after unmount (setState-on-unmounted). React 19 no longer warns for this, and no data corruption results (each page's `.then` guards are local state setters). Not filed as a bug.

---

## 3. Suggested fix order

| Priority | Bugs | Why |
|---|---|---|
| P0 | B2, B3 | Correctness on normal admin/seeker paths (broken revert loop; boundary bypass) |
| P1 | B1, B4 | Broken user journey (employer verification); concurrency 500 + disk leak |
| P2 | B5, B6, B7, B8, B11, B12 | Input-coercion 500s — best fixed as one shared UUID/enum/date validation layer + error-middleware SQLSTATE mapping, not per-route |
| P3 | B9, B10, B13, B15 | Data hygiene / compliance edge cases, one-liners each |
| P4 | B14 | Theoretical race; cheap guard while touching AuthProvider |

## 4. Prevention measures

- **One input-validation seam:** the codebase already has two right patterns (`ORDER_COLS` allowlist, `admin.js:463` numeric-id regex). Add a `validate.ts`-less JS `server/src/validate.js` with `uuid(id)`, `enumOf(set)`, `isoDate(s)`, and a `clampInt` — every B5/B6/B7/B8/B12 is one line with it.
- **Map SQLSTATE at the boundary:** a `22P02`/`22007` → 400 branch in the error middleware (`index.js:41-47`) catches the whole family even where a guard is missed.
- **Race test template:** the applications `23505 → 409` pattern (`applications.js:58-61`) is the reference for provision (B11) and uploads (B4); one shared `withRetryOnUniqueViolation`-style helper or copy-paste of the catch is enough.
- **Regression tests per fix:** B1 (AuthCallback employer render), B2 (role round-trip), B3 (apply past deadline), B4 (parallel uploads), B5/B6/B7/B8 (one request each asserting 4xx).

---

*Phase 2 complete — 15 findings documented, no source modified.*
