# Phase 2 — Error Handling Completeness Audit

**Scope:** Read-only audit of error handling across the Express API (`server/src`), the
frontend HTTP layer + service layer + feature pages (`src`), and the upload pipeline.
No fixes applied — findings and one-line suggestions only.

**Method:** Traced the error contract end-to-end (`err`/`ah` → route handlers → 404/global
middleware; `api.js` throw path → service layer → page `catch`), then compared it against what
each route/payment actually does. Malformed-input and error-shape gaps were verified against
`db/schema.sql` (all PK columns are `uuid`).

**Error contract (baseline):** success = any JSON; failure = `res.status(N).json({ error: { code, message } })`
via the `err()` helper (`server/src/util.js:7`). Async handlers must be wrapped in `ah()`
(`util.js:4`) or the rejection is lost on Express 4. Frontend `api.js` throws `Error` with `.status`
and the server's `error.message` (`src/shared/lib/api.js:28-38`); pages render `err.message`.

---

## 1. Server error-handling matrix

Format: **handler → validation / not-found / ownership / conflict / malformed-id / unexpected**.

`✅` handled with correct status + envelope · `⚠️` handled but inconsistent shape or wrong status ·
`❌` gap.

| File (handlers) | 400 validation | 404 not found | 403 ownership | 409 conflict | malformed :id (uuid) | unexpected → 500 |
|---|---|---|---|---|---|---|
| `auth.js` middleware (22/48/70) | ✅ | ✅ (me:150) | ✅ (403 not-provisioned/suspended) | n/a | n/a (id from token) | ✅ (role lookup 500) |
| `routes/auth.js` (provision, audit, me) | ✅ 21-61 | ✅ 150 | ✅ 29/33 | n/a | n/a | ✅ global |
| `routes/jobs.js` (7 handlers) | ✅ 58/181/226/229/302 | ✅ 98/36 | ✅ 38/106 | n/a | ❌ **all 7** → 22P02 500 | ✅ global |
| `routes/applications.js` | ✅ 43/127 | ✅ 45/77/179 | ✅ 37/79 | ✅ 59 (dup apply) | ❌ `:id`,`:seekerId`, body `job_id`/`resume_id` | ✅ global |
| `routes/profiles.js` | ✅ 41/139/156/257 | ✅ 29/86/162/211/228/273 | ✅ 73/179/213/301 | ⚠️ see note¹ | ❌ `:id` (accr/resume) | ✅ global |
| `routes/admin.js` (~25 handlers) | ✅ 87/100/114/263/495 | ✅ 84/405/536 | ✅ 81/403 | ✅ 143/156/295/364/380 | ❌ ~9 sites (users/roles/jobs/reference `:id`) | ✅ global |
| `routes/reports.js` | ✅ 92/93 | (guarded by TYPES list) | ✅ admin guard | n/a | n/a | ✅ global |
| `routes/ai.js` | ✅ 47 | n/a | ✅ requireRole | n/a | n/a | ✅ 502 (73) |
| `upload.js` (middleware) | ⚠️ inline envelope (AP-5) | ⚠️ "No file" as 400 | n/a | n/a | n/a | ⚠️ mkdirSync throw² |
| `index.js` 404 / global | n/a | ✅ 404 (39) | n/a | n/a | n/a | ❌ 413→500; partial 400 map |

¹ `profiles.js:58-69 POST /accreditations` uses `on conflict ... do update` and no `returning` guard —
   if the branch yields no row, `rows[0].id` (line 65) throws → 500. Minor/edge.
² `upload.js:16 fs.mkdirSync` is synchronous and inside the multer `destination` callback; an fs-failure
   (permissions, disk) throws inside multer → surfaces as a 400 with the raw fs message, not a 500. Acceptable
   but the message is not the `err()` envelope.

**Status codes actually emitted:** 400, 401, 403, 404, 409, 429 (rateLimit), 502 (ai), 503 (health + ai),
200/201/204. **Missing proper code:** 413 (payload too large — becomes 500), and 22P02 malformed-uuid
(becomes 500). See gaps below.

---

## 2. Frontend error-path checklist

| Concern | Verdict | Evidence |
|---|---|---|
| Every service call handles errors | ✅ mostly | Services return `api.*`; pages use `.catch`/`try-catch`. See **F1** for exceptions. |
| Loading state reset on error | ✅ | `.finally(() => setLoading(false))` in 20+ page effects; AuthProvider `.finally` (`AuthProvider.jsx:57`); `setSending(false)` in `HelpChat.jsx:57`. |
| Error messages shown to users | ✅ mostly | `setError(err.message \|\| fallback)` + danger-styled render (e.g. `Applicants.jsx:109-123`, `Dashboard.jsx:25`). See **F1/F2**. |
| 401 bounce safe from infinite loops | ✅ **safe** | See §4 analysis. `settleAuth` + `bounce` (`api.js:44-85`) are straight-line: one refresh + one retry, then terminal `signOut()` + `window.location.href='/portals'` + `throwStatus`. No recursion; the `Authorization` header is empty after sign-out, so a subsequent request cannot re-enter the 401 branch. |

---

## 3. Gaps that can cause unhandled 500s / silent failures

### S1 — Malformed `:id` (uuid) path/body params return **500**, not 400/404  *(systemic, highest-impact)*
Every id column is `uuid` (`db/schema.sql:27,61,97,150,160,177,216,225,274`, …). A non-uuid `:id`
makes Postgres raise `22P02 invalid input syntax for type uuid`, which no handler catches → global
middleware → **500 INTERNAL**.

Only **two** sites validate the format before hitting the DB — proving the pattern exists but isn’t applied:
- `admin.js:262` audit-logs `userId` (uuid regex)
- `admin.js:463` notifications `:id` (`/^\d+$/`)

Everything else passes the raw param straight into a uuid comparison. Representative sites (non-exhaustive):
- `jobs.js`: 97 `loadJob`, 265, 299, 330, 339 (`/jobs/:id` family), 104-115 (`/employers/:employerId/jobs`)
- `applications.js`: 123, 178 `/applications/:id`, 173-175 `credByLink` `/seekers/:seekerId/…`, and **body** `job_id`/`resume_id` at 44/48
- `profiles.js`: 79 `/accreditations/:id`, 210/227 `/files/resumes/:id`, 271 `seekerChild` delete
- `admin.js`: 75 `findUserTable` `/admin/users/:id`, 374/389 `/admin/roles/:id`, 487/534 `/admin/jobs/:id`, 419 `/admin/reference/:id`, 402, 579

**Suggestion (one line per handler, or a shared guard):** a single `isUUID` param guard mirroring
`admin.js:262` applied in the `loadX` helpers (return `err(res,400,'BAD_REQUEST','Invalid id')`) — root-cause
fix in each `loadJob/loadApp/findUserTable` closes every caller at once.

### S2 — `413 Payload Too Large` becomes **500**
`index.js:24` sets `express.json({ limit: '1mb' })`. When exceeded, body-parser throws with `status: 413`.
The global handler (`index.js:45`) only special-cases `status === 400`, so an oversized JSON body returns
**500 "Something went wrong"** instead of **413**.

**Suggestion (one line, `index.js:45`):** honour the parser status — e.g.
`if ([400, 413].includes(e.status)) return err(res, e.status, e.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST', …)`.

### S3 — AP-5: `upload.js` bypasses the `err()` contract
`upload.js:36-41` hand-builds the error envelope with `res.status(400).json({ error: { code: 'BAD_REQUEST', … } })`
instead of importing `err()` from `util.js`. Shape is currently correct, so behavior is fine, but it is the only
place in `server/src` that duplicates the envelope (confirmed: the only other non-`err()` status writes are the
health probe `index.js:34` and rate-limit `rateLimit.js:6`, both intentional/non-error). Already logged as **AP-5 / P3**
in `master-plan.md:64` and `phase1-pattern-review.md:42,90`.

**Suggestion (one line):** `import { err }` in `upload.js` and replace the three inline calls.

### S4 — Transaction `catch` doesn’t guard `rollback` (originals can be masked)
Every write transaction uses:
```js
} catch (e) { await client.query('rollback'); throw e; }   // e.g. jobs.js:204, applications.js:144, profiles.js:188, admin.js:519, auth.js:129
```
If `rollback()` itself rejects (broken connection), the rollback error replaces the original `e` before it reaches
the global middleware. Still a 500, but the logged `e.code`/`sqlState` no longer reflects the real cause.
`client.release()` is in `finally`, so no connection leak.

**Suggestion (one line):** `try { await client.query('rollback'); } catch {} throw e;`.

### S5 — Auth middlewares are `async` but not `ah()`-wrapped
`auth.js:22/48/70` (`auth`, `optionalAuth`, `tokenAuth`) are async and used bare between route guards. On Express 4
an async throw is **not** auto-forwarded (root cause of the whole `ah` pattern, noted in `phase1-architectural-audit.md:141`).
They are only safe today because every path returns `err(…)` or `next()` and never throws — a discipline, not a
structure. A future un-wrapped `await` that throws would be a silent unhandled rejection.

**Suggestion (one line each):** wrap in `ah(…)`, or confirm-on-review that the never-throw rule holds; upgrade path is Express 5.

### F1 — `Accreditation.jsx` mutation handlers fail **silently** + raise **unhandled rejections**
Six of seven admin actions are `async` handlers with **no `try/catch`**, invoked via `onClick`/modal `onConfirm`:
- `handleApprove` (150-154, called 292)
- `confirmReject` (162-171, called 285)
- `toggleCompanyStatus` (192-197, called 372)
- `confirmRevoke` (199-206, called 399 via ConfirmationModal)
- `reinstate` (208-213, called 365)
- `handleDocStatus` (41-45 in `DetailModal`, called 98/99)
- `handleViewDoc` (32-39) — has `catch` but it **swallows silently** (`// ignore`)

On a failed request: the `await` throws → `onClick` doesn’t await → **uncaught promise rejection** (console only, NOT
caught by the root ErrorBoundary, which only intercepts render/lifecycle throws). The optimistic `setAccs/setCompanies`
after the `await` never run, so the row just doesn’t change and the admin gets **no feedback**. This is inconsistent with
`confirmRequestDocs` (180-189) in the *same file*, which does wrap in `try/catch` + `setRequestError`.

**Suggestion (one line each):** wrap each mutation in `try { … } catch (err) { setError(err.message) }` (or reuse the
existing reject/request modal error state); for `handleViewDoc`, `setResumeError(err.message)` instead of swallowing.

### F2 — `Applicants.jsx` shares one error state between load and actions
`setStatus` (51-62) writes the page-level `error` on failure; because the render guards on `if (error) return <error card/>`
(109-123), a single failed status change **replaces the whole applicant table** with an error card and offers no retry.
Loading here is not re-shown, but the list is destroyed by an action error.

**Suggestion (one line):** use a separate transient action-error (or a toast via the existing `Toast` component) rather than
the page-load `error` state.

### F3 — Silent degradation (by design, low priority)
- `NotificationBell.jsx:20` `fetchUnread` — `.catch(() => … return 0)` (badge silently shows 0 unread).
- `SeekerProfileCard.jsx:30` — credential fetch `.catch(() => setCredentials(NO_CREDENTIALS))` (documented as intended).

These are acceptable, noted only so the next reviewer doesn’t re-flag them as bugs.

---

## 4. 401 bounce loop-safety (explicit answer)

**Conclusion: the 401 bounce is safe from infinite loops.**

`settleAuth` (`api.js:44-67`) runs per request only when `res.status === 401 && sent.Authorization`. It performs
**at most one** `refreshSession()` and **at most one** retry; a second 401 calls `bounce`. `bounce`
(`api.js:75-85`) signs out, sets `window.location.href = '/portals'`, and `throwStatus` — no loop, no recursion.
After sign-out the session has no `access_token`, so `authHeaders()` sends no `Authorization` header and the
401 branch can no longer be entered on `/portals`. The bursting case (many concurrent 401s) all converge on the
same single navigation + `signOut()`. The code comment at `api.js:40-43` is accurate.

---

## 5. Prevention / monitoring (for confirmed gaps)

- **Alert rule (S1/S2):** count `unhandled_error` log lines (`index.js:44`) grouped by `sqlState`. Page when
  `22P02` count > 0 in 5 min (malformed-id 500s) or when 5xx rate exceeds baseline on `/api/*`. Both SQLSTATEs are
  currently invisible because the handler collapses everything to `INTERNAL`.
- **Honor parser status (S2):** emit a distinct `PAYLOAD_TOO_LARGE` code so a 413 can be alerted separately from 500.
- **Contract lint (S3):** a `grep`/ESLint rule forbidding `res.status(4|5).json({ error` outside `util.js` — would have
  caught AP-5.
- **Frontend:** wrap async handlers centrally (a tiny `withErrors(fn, setError)` or the existing `Toast`); ErrorBoundary
  does not cover event-handler rejections, so a page-level error surface is the only guard.
- **Dashboard additions:** error-shape heat map by service; a time-series of 5xx by `code`/`sqlState` to surface 22P02/413
  trends; dependency map showing the single global error handler as the funnel for all uncaught DB errors.

---

## Summary of concrete findings (file:line)

- **S1** malformed uuid `:id` → 500: systemic; only `admin.js:262` + `admin.js:463` validate. Sites incl. `jobs.js:97,265,299,330,339,104`, `applications.js:123,178,173-175,44,48`, `profiles.js:79,210,227,271`, `admin.js:75,374,389,487,402,419,579`.
- **S2** 413 → 500: `index.js:24,45`.
- **S3** AP-5 `err()` bypass: `upload.js:36,37,41`.
- **S4** rollback not guarded: `jobs.js:204`, `applications.js:144`, `profiles.js:188`, `admin.js:519`, `auth.js:129`.
- **S5** async auth mw not wrapped: `auth.js:22,48,70`.
- **F1** silent / unhandled Accreditation actions: `Accreditation.jsx:150,162,192,199,208,41,32` (contrast `180`).
- **F2** shared action/page error state: `Applicants.jsx:51-62` (guard `109-123`).
- **F3** intentional silent degradation: `NotificationBell.jsx:20`, `SeekerProfileCard.jsx:30`.
- **OK** 401 bounce loop-safe: `api.js:44-85`. Single-root ErrorBoundary: `App.jsx:53` (render-throw coverage only).
