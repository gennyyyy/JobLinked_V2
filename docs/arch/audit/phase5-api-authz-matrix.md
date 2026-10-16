# Phase 5 — API Authorization Matrix (endpoint-by-endpoint)

**Project:** JobLinked (PESO Santa Maria) · **Date:** 2026-10-15 · **Auditor:** API Security Audit (Phase 5)
**Method:** Read-only code inspection of `server/src/**` + live read-only probes (server started locally against the
provisioned `server/.env` DB: unauthenticated 401 sweep across 30 routes) + read-only `pg_constraint` metadata query.
**No source was modified.** `server/src/routes/admin.js` was read once mid-edit by a concurrent agent — the copy read
was syntactically coherent and internally consistent; line numbers are from that snapshot.

Contract: `docs/arch/rework/02-api-contract.md` (+ Addenda A–D). Guard matrix: seeker ⇄ own `id`; employer ⇄ rows
where `company_id` = own `id`; admin ⇄ all.

---

## 1. Headline verification — "ids come from the token, never the body"

```
grep -E "req\.body\.(company_id|seeker_id|user_id)|req\.query\.(company_id|seeker_id|user_id)" server/src
→ No matches found.
```

Every scoped read resolves the principal from `req.user.id` (set by `auth`/`tokenAuth`). No route interpolates a
client-supplied tenant id into an ownership check. **Zero IDOR / tenant-confusion findings.** The only id-carrying
params are resource ids in the path, and each is checked (see matrix "Owc" column).

| Ownership check abbreviation | Meaning in handler |
|---|---|
| `tok` | `req.user.id` is the only id used |
| `pkA` | path id checked against `req.user.id` (or company/job owner), else 403/404 |
| `lnk` | path id checked via a `job_applications` link to one of the caller's jobs (Addendum A/B) |
| `n/a` | no resource id — token-scoped list/action |

---

## 2. Matrix

### Auth (public except `me`) — `server/src/routes/auth.js`, `server/src/auth.js`
| # | M | Endpoint | Auth | Owc | Cross-tenant read/mutate? | Verdict |
|---|---|---|---|---|---|---|
| 1 | POST | `/auth/provision` | `tokenAuth` | n/a | role from **body**, gated by `app_metadata.role` for `super-admin` | PASS |
| 2 | POST | `/audit` | `tokenAuth` | n/a | writes as `req.user.id` | PASS (F4) |
| 3 | GET | `/auth/me` | `tokenAuth` | tok | — | PASS |
| 4 | GET | `/health` | none | n/a | — | PASS |

### Jobs — `server/src/routes/jobs.js`
| # | M | Endpoint | Auth | Owc | Cross-tenant? | Verdict |
|---|---|---|---|---|---|---|
| 5 | GET | `/jobs` | `optionalAuth` | n/a | non-admins pinned to `status='published'` (`listStatusFor`) | PASS |
| 6 | GET | `/jobs/:id` | `optionalAuth` | `pkA` | non-published → 404 (no existence oracle) | PASS |
| 7 | GET | `/employers/:employerId/jobs` | `auth` | `pkA` | `employerId !== req.user.id` → 403 | PASS |
| 8 | POST | `/jobs` | `auth`+`employer` | tok | `company_id = req.user.id`; `status` from body only as `draft`/`published` | PASS |
| 9 | PATCH | `/jobs/:id` | `auth` | `pkA` (`ownOrAdmin`) | `status` must be in `JOB_STATUSES`; `published` → `canPublish` | PASS (F8) |
| 10 | POST | `/jobs/:id/duplicate` | `auth` | `pkA` | copies the loaded row (owner's `company_id`) | PASS |
| 11 | POST | `/jobs/:id/status` | `auth` | `pkA` | same enum + `canPublish` gate, txn writes history | PASS |
| 12 | DELETE | `/jobs/:id` | `auth` | `pkA` | hard delete by design (ADR-013) | PASS |
| 13 | GET | `/jobs/:id/history` | `auth` | `pkA` | — | PASS |

### Applications — `server/src/routes/applications.js`
| # | M | Endpoint | Auth | Owc | Cross-tenant? | Verdict |
|---|---|---|---|---|---|---|
| 14 | POST | `/applications` | `auth`+`job-seeker` | tok | `seeker_id = req.user.id`; `resume_id` re-checked `and seeker_id = $2`; deadline in SQL `EXISTS` | PASS |
| 15 | GET | `/applications/mine` | `auth`+`job-seeker` | tok | — | PASS |
| 16 | GET | `/applications/job/:jobId` | `auth` | `pkA` | seeker PII embeds only for the owning employer | PASS |
| 17 | GET | `/applications/company/:companyId` | `auth` | `pkA` | `companyId !== req.user.id` → 403 | PASS (F6) |
| 18 | GET | `/applications/employers/me/dashboard` | `auth`+`employer` | tok | `companyId = req.user.id` (no body id) | PASS |
| 19 | POST | `/applications/:id/status` | `auth` | `pkA` | owner employer or admin; seeker → 403 | PASS (F7) |
| 20 | GET | `/applications/seekers/:seekerId/education` | `auth` | `lnk` | own id, admin, or linked-application employer | PASS |
| 21 | GET | `/applications/seekers/:seekerId/experience` | `auth` | `lnk` | idem | PASS |
| 22 | GET | `/applications/seekers/:seekerId/employment` | `auth` | `lnk` | idem | PASS |
| 23 | GET | `/applications/:id/history` | `auth` | `pkA` | seeker own, owner employer, or admin | PASS |

### Profiles / files / documents / accreditations — `server/src/routes/profiles.js`
| # | M | Endpoint | Auth | Owc | Cross-tenant? | Verdict |
|---|---|---|---|---|---|---|
| 24 | GET/PATCH | `/employers/me` | `auth`+`employer` | tok | column allow-list, `id = req.user.id` | PASS |
| 25 | GET/PATCH | `/seekers/me` | `auth`+`job-seeker` | tok | idem | PASS |
| 26 | POST | `/accreditations` | `auth`+`employer` | tok | `company_id = req.user.id` | PASS |
| 27 | GET | `/accreditations/company/:companyId` | `auth` | `pkA` | — | PASS (F6) |
| 28 | PATCH | `/accreditations/:id` | `auth`+`super-admin` | n/a | admin-only; enum-guarded | PASS |
| 29 | POST | `/documents` | `auth`+`employer` | tok | `accreditation_id` verified `and company_id = $2`, dropped if not ours | PASS |
| 30 | GET | `/documents/company/:companyId` | `auth` | `pkA` | — | PASS (F6) |
| 31 | PATCH | `/documents/:id` | `auth`+`super-admin` | n/a | admin-only, status-guarded | FAIL (F3) |
| 32 | POST | `/files/resumes` | `auth`+`job-seeker` | tok | `req.user.id` in storage path; orphan-unlink compensation | PASS (F5) |
| 33 | POST | `/files/documents` | `auth`+`employer` | tok | idem; **no DB row when `doc_type` absent** | PASS (F5) |
| 34 | DELETE | `/files/resumes/:id` | `auth` | `pkA` | `seeker_id !== req.user.id` → 403; disk file unlinked | PASS |
| 35 | GET | `/files/resumes/mine` | `auth`+`job-seeker` | tok | — | PASS |
| 36 | POST | `/files/resumes/:id/activate` | `auth`+`job-seeker` | `pkA` | `seeker_id !== req.user.id` → 403 | PASS |
| 37 | GET/POST/DEL | `/seekers/me/{education,experience}` | `auth`+`job-seeker` | tok | insert stamps `seeker_id = req.user.id`; delete is `where id=$1 and seeker_id=$2` | PASS |
| 38 | GET | `/seekers/me/employment` | `auth`+`job-seeker` | tok | read-only | PASS |
| 39 | GET | `/files/:bucket/*` | `auth` | `pkA`/`lnk` | see §4 traversal proof; employer only via linked application | PASS |

### AI — `server/src/routes/ai.js`
| # | M | Endpoint | Auth | Owc | Verdict |
|---|---|---|---|---|---|
| 40 | POST | `/ai/help` | `auth` → `requireRole('job-seeker')` → **`aiLimiter`** → handler | n/a | PASS (F10) |

### Reports — `server/src/routes/reports.js`
| # | M | Endpoint | Auth | Owc | Verdict |
|---|---|---|---|---|---|
| 41 | GET | `/admin/reports/:type/export` | `auth`+`super-admin` | n/a | PASS |

### Admin — `server/src/routes/admin.js` (`admin = [auth, requireRole('super-admin')]`)
| # | M | Endpoint | Auth | Verdict |
|---|---|---|---|---|
| 42–61 | GET | `/admin/{stats,users,companies,jobs,applications,employees,referrals,accreditations,audit-logs,reference/:category,permissions,roles,seekers/:id/{education,experience,employment}}` | `admin` | PASS (F6) |
| 62 | PATCH | `/admin/users/:id` | `admin` | PASS (F2) |
| 63 | POST | `/admin/users/invite` | `admin` | PASS |
| 64 | POST | `/admin/users/:id/custom-role` | `admin` | PASS |
| 65 | POST | `/admin/users/:id/role` | `admin` | **FAIL (F1)** |
| 66 | PATCH | `/admin/jobs/:id` | `admin` | PASS |
| 67 | POST | `/admin/jobs/:id/{publish,unpublish}` | `admin` | PASS |
| 68 | POST | `/admin/system-notifications` | `admin` | PASS |
| 69 | GET | `/notifications/mine` | `auth` | PASS (Addendum C: `user_id` from token, never params) |
| 70 | POST | `/notifications/:id/read` | `auth` | PASS (F9) |
| 71 | POST | `/notifications/read-all` | `auth` | PASS |
| 72 | DELETE | `/notifications/:id` | `auth` | PASS (non-numeric → 400, other user's → 404) |
| 73 | POST/DELETE | `/admin/{roles,reference}` mutations | `admin` | PASS |

**80 registered routes, 0 authz bypasses.** All other non-admin routes are behind `auth`+`requireRole` or `pkA`; the
only unauthenticated routes are `GET /health`, `GET /jobs`, `GET /jobs/:id`, `POST /auth/provision`.

---

## 3. Findings

| Sev | File:line | Issue | Fix |
|---|---|---|---|
| **HIGH** | `server/src/routes/admin.js:638` (B2 fix) | `POST /admin/users/:id/role` now `delete from ${table} where id = $1`. FK cascade confirmed live: `job_vacancies.company_id → employers ON DELETE CASCADE`, `employer_accreditations.company_id → employers CASCADE`, `employer_documents.company_id → employers CASCADE`, `resumes/education/work_experience/employment_history/job_applications.seeker_id → job_seekers CASCADE`, plus second-hop `job_status_history`, `application_status_history`. An employer→job-seeker move **permanently destroys every job posting, every application (with applicant PII), all status history, all accreditations and all document rows**; a job-seeker→employer move destroys resumes/education/experience and orphans the resume files on disk. One request, no confirmation, irreversible, and the audit row records only the role change. The B2 fix traded a 500 for silent data loss. | Keep the old row (preserves dependents) and upsert the target: `insert into ${t} (id,email,full_name,status) values ($1,$2,$3,'active') on conflict (id) do update set status='active', email=excluded.email, full_name=excluded.full_name`. If `delete` must stay, refuse when dependents exist: `select 1 from job_vacancies where company_id=$1` / `job_applications where seeker_id=$1` → 409 "archive first". |
| **LOW** | `server/src/routes/admin.js:104-110` (B13) | `delete body.id/role/created_at/updated_at` but **not `email`**; the allow-list comes from `information_schema.columns`, which includes `email`. An admin can rewrite a local email Supabase never sees → login/display divergence (cross-table collision now 409, but the desync remains). | `delete body.email;` next to `delete body.id`. |
| **LOW** | `server/src/routes/profiles.js:158-166` (S1 gap) | `PATCH /documents/:id` has no `isUuid(req.params.id)` guard, unlike every sibling. A malformed id reaches `where id = $1` → PG `22P02` → **500** instead of 404. Super-admin only, so no authz impact. | `if (!isUuid(req.params.id)) return err(res, 404, 'NOT_FOUND', 'Document not found');` |
| **LOW** | `server/src/routes/auth.js:143-150` | `POST /api/audit` accepts any `action` ≤100 chars and any `entity`/`entity_id`/`details` (≤1 MB) from any authenticated token, including an **unprovisioned** one. The admin Audit-Logs UI renders/searchs `action`, so a user can forge entries such as `admin.login` or `user.role.change`. | Namespace client events: reject actions not matching `/^client\.[a-z.]+$/`, or prepend `client.` server-side before insert. |
| **LOW** | `server/src/routes/profiles.js:203-213` | `POST /files/documents` without `doc_type` writes 5 MB to disk with **no `employer_documents` row, no audit, no unlink path and no way to ever read or delete it** (the read at `:310` fails closed with no row, so it is not a leak — it is unbounded orphan growth). `uploadLimiter` caps it at 50×5 MB/15 min/IP ≈ 2.4 GB/day/IP. | Require `doc_type` (mirror `POST /documents`), or `fs.unlink` when absent. |
| **LOW** | `applications.js:97,107`; `profiles.js:76,154`; `admin.js:253,264` | Unpaginated multi-row responses: applicant lists with full seeker PII embeds, plus `/admin/employees` and `/admin/referrals` which return the entire `job_applications` table. No `LIMIT`. Response size grows linearly with tenure. | `pageParams` already exists and is used by every sibling — one line each. |
| **LOW** | `applications.js:139-166` | Application status has **no transition matrix**: an owner employer can move any row to any of the 7 statuses, including `Accepted/Placed → Applied` or a direct jump to `Terminated`. `RETAINED_STATUSES` (`admin.js:296-303`) governs the 12-month purge and `employment_history` is trigger-written, so a status flip moves rows in and out of the deletion window — reversible, compliance-relevant. | Forbid terminal → non-terminal, or drive the purge off a separate `is_employment` flag. |
| **LOW** | `jobs.js:249-250` | Employer `PATCH /jobs/:id` accepts admin-review statuses (`pending`, `approved`, `rejected`) for their own job. No visibility impact (`canViewJob`/`listStatusFor` pin non-admins to `published`), so it is cosmetic + audit noise. | Restrict employers to `draft\|published\|closed\|archived`; leave the full set to admin. |
| **LOW** | `admin.js:512-516` | `POST /notifications/:id/read` returns `{read:true}` 200 for any numeric id, including another user's — no ownership-confirming 404, unlike `DELETE /:id` (Addendum C). Not exploitable (the update is scoped `and user_id = $2` and the response is non-informative). | `returning id`, 404 on empty row. |
| **INFO** | `ai.js:54-62` | 1–10 user-typed messages (≤1000 chars each) are forwarded to OpenRouter with no account data and no logging — correct — but a third-party processor relationship needs a GDPR Art. 28 DPA and a privacy note. `model: process.env.OPENROUTER_MODEL` is unset here → upstream 4xx → 502. Also: `OPENROUTER_API_KEY` is absent from `server/.env`, so the route currently answers 503 `AI_NOT_CONFIGURED`. | Document the processor + DPA; default the model. |
| **INFO** | `app.js:38` | `express.json({ limit: '1mb' })` is correct; `multer` limits are 5 MB with a 2 MB PDF cap (`upload.js:8-9,40`). Verified: 413 → `PAYLOAD_TOO_LARGE`, 400 → `BAD_REQUEST`. | — |

---

## 4. Targeted probes

**Path traversal — `GET /api/files/:bucket/*` (`profiles.js:287-294`).** Guard is
`path.normalize(path.join(uploadDir, bucket, rel))` + `startsWith(join(uploadDir, bucket) + sep)`, with `bucket`
allow-listed to `resumes|documents`. Runtime-checked with Node's real `path.win32`:

| `rel` | result |
|---|---|
| `abc/resume.pdf` | PASS (legit) |
| `../../../../etc/passwd` | 400 |
| `..\..\..\server\.env` | 400 |
| `a/../../../../etc/passwd` | 400 |
| `..%2f..%2fetc%2fpasswd` | decoded by Express → `../../etc/passwd` → **400** |

No traversal. The DB check (`file_path = $1`) is then the real gate and fails closed when the row is absent.

**Live unauthenticated sweep (30 routes).** Every `auth`/`tokenAuth`/`requireRole` route returned
`401 {code:'UNAUTHORIZED'}` (including `/api/ai/help`, `/api/admin/**`, `/api/files/**`, all four notification
routes). `GET /api/jobs/not-a-uuid` → **404** (S1 fix correct). Unknown route → 404 `NOT_FOUND`. `GET /api/jobs`
returned live published rows for anonymous callers only.

**Rate limiting.** `authLimiter` 100/15 min (auth paths), `uploadLimiter` 50/15 min (matched to
`POST /api/documents` and `POST /api/files/*`), `apiLimiter` 300/15 min for the rest with a `skip` mirroring exactly
those two, and `aiLimiter` 20/15 min keyed `req.user?.id || ipKeyGenerator(req.ip)` — mounted **after** `auth`, per
Addendum D. Health is mounted before the limiters. All 429s use the contract error shape. Limiter store is in-memory
(`ponytail:` noted in-file) — single-instance only.

**Phase-2 fixes re-verified in current code.**
- **B2** — the round-trip 500 is gone (delete + insert in one txn, `23505 → 409`) **but the delete introduces F1**.
- **B3** — deadline now enforced *inside* the insert's `WHERE EXISTS … (deadline is null or deadline >= current_date)`,
  together with `status = 'published'`. TOCTOU closed.
- **B5** — `isUuid` present in `loadJob`/`loadApp` (both files), `findUserTable`, and 16 param handlers. Only gap: F3.
- **B6** — `ACCOUNT_STATUSES` / `APPLICATION_STATUSES` / `ADMIN_JOB_STATUSES` / `JOB_STATUSES` / `JOB_ARRANGEMENTS`
  allow-lists on every enum filter and mutation; `400` on violation.
- **B11** — `POST /auth/provision` catches `23505` and answers the documented idempotent 200.
- **B13** — **not fixed** (F2).
- **S1/S2/S3** — `isUuid`/`isNumericId` (util.js:14-16), 1 MB JSON limit + body-parser error mapping
  (app.js:59-62), and helmet/CORS-fail-closed/trust-proxy are all in place.

---

## 5. Verified correct

1. **`company_id` / `seeker_id` / `user_id` are taken from the token on every scoped route** — grep-confirmed zero
   body/query sourced tenant ids. Addendum C honoured on all four notification routes.
2. **Accreditation gate (ADR-022)** — `canPublish`/`employerMayPublish` runs on **both** `POST /jobs` and any write
   that sets `status='published'` (`PATCH /jobs/:id`, `POST /jobs/:id/status`). A non-approved employer gets 403 and can
   only save drafts. Not a client-side check.
3. **Cross-tenant file read** — own resume, own-company document, or admin; the employer exception is exactly the
   linked-application join from Addendum A (and Addendum B for education/experience/employment).
4. **Duplicate-application guard** — relies on `unique (job_id, seeker_id)` + `23505 → 409`; no check-then-act.
5. **No SQL injection** — dynamic identifiers come from hard-coded allow-lists (`ORDER_COLS`, `JOB_COLS`,
   `ADMIN_JOB_COLS`, `USER_TABLES`, `ROLE_BY_TABLE`) or live `information_schema` columns; every value is parameterized.
6. **Error shape and status codes** — `{ error: { code, message } }` uniformly; 404 (not 403) for non-visible jobs so
   there is no existence oracle.
7. **Best-effort audit/notify** — `audit`/`notifyUser`/`notifyAdmins`/retention swallow failures; no unhandled rejections.
8. **Role escalation** — `super-admin` provisioning requires the service-role-only `app_metadata.role`, never the body.
9. **Self-lockout guards** — `PATCH /admin/users/:id` refuses self status/custom-role edits; `/role` refuses self-move.

**Bottom line:** no broken access control. One HIGH data-loss defect (F1) introduced by an earlier fix, one
not-actually-fixed Phase-2 bug (F2), and a set of Low hardening items. F1 and F2 should be fixed before launch.

*Phase 5 complete — no source modified.*
