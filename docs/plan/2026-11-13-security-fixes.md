# Security Fix Plan — 2026-11-13

**Goal:** close the audit gate: fix G-01 (privilege escalation) and F-15 (missing frontend security
headers), then the Medium/Low findings in risk order. No audit re-run; each task closes named findings
with a test or a recorded verification.

**Baseline (do not re-audit):** `docs/arch/audit/2026-11-13-delta-security-audit.md` (F-findings, gate
FAIL), `2026-11-13-admin-guard-matrix.md` (G-findings), `2026-11-13-phase4-probes.md` (live proof).
Fix handoff order: audit report §12.

**Tech stack:** unchanged — JavaScript/JSX (no TypeScript), Express + `pg`, React/Vite, Vitest,
Tailwind tokens. Tests near the code (`*.test.js(x)`). `npm test` and `npm run lint` must be green.

## Global constraints

- **Schema approval (Lead Architect):** this plan approves applying `db/migrations/014_one_resume_per_seeker.sql`
  (Task 9) and updating `reference_data` permission rows (Tasks 3/9). **No other `db/schema.sql` change
  is approved.** The ADR-049 working-tree changes are in flight — do not revert or reformat them.
- Do not touch unrelated modified files reported by `git status` (ADR-049 work, resume tests, Profile UI).
- Every task ends with its test/verification and one imperative commit. No finding is "closed" without
  the evidence named in its task.
- Read-only prod rule stands: only `curl -sI https://www.joblinked.site/` and the external scanner
  re-run. Everything else local.
- **Decision gates:** Task 9's G-06 key decision only. Task 3's G-02 decision is **taken: enforce**
  (Option A) — live probes rate it High. Everything else is pre-approved.

---

## Task 1 — G-01 (High, blocking): invitee must not choose its own custom role

**Files:** `server/src/routes/admin-users.js` (invite handler, ~line 209), `server/src/routes/auth.js`
(provision, `:69-77`), `server/src/__tests__/auth.provision*.test.js`, `admin.users.invite.test.js`.

**Contract (decided):** the effective `custom_role_id` comes **only** from service-role-set
`app_metadata`; the request body is ignored for all three roles.

- [ ] Invite handler: change the existing `updateUserById(id, { app_metadata: { role } })` to
      `{ app_metadata: { role, custom_role_id: customRoleId } }` (single call, before the invite email).
- [ ] Provision: `const tag = req.user.app_metadata?.custom_role_id;` — validate numeric + exists in
      `reference_data` (category `custom_role`) as defence, then insert `tag`. Delete the body read at
      `:72-77`.
- [ ] Fail closed for super-admin: if `role === 'super-admin'` and `app_metadata` has **no**
      `custom_role_id` key (pre-fix invites), return 403 `INVITE_INCOMPLETE` ("re-send the invite") —
      never fall through to `NULL`→break-glass. Key present with `null` = a full admin the inviter
      explicitly granted (governed by Task 3). Seeker/employer self-signup keep `null`.
- [ ] Audit: `auth.register` row carries the resolved tag (not just `{ role }`).
- [ ] Tests: body tag ignored/overridden; metadata tag honored; missing key → 403 for super-admin;
      explicit null → full admin; audit row contains the tag.
- [ ] Verify: re-run local P-06 probe from the Phase 4 report — omitting the body tag must NOT yield
      break-glass; a narrow tag must stay limited.

**Amendment (2026-11-13, after Task 10 live re-verification — R10-01/R10-02):**

- Supabase GoTrue strips JSON `null` from `app_metadata`, so "explicit null = full admin" is
  unrepresentable — a full-admin invite ended with no key and its invitee was permanently 403. Replace
  it with the sentinel **`custom_role_id: 0`**: the invite handler writes `customRoleId ?? 0`.
- Provision resolution order: key absent → 403 `INVITE_INCOMPLETE`; value `0`/`"0"` → `null` (full
  admin); numeric id that resolves to a `custom_role` row → that id; **anything else present
  (non-numeric, unresolvable, negative) → 403 `INVITE_INCOMPLETE`** — never silently `null`
  (closes R10-01: create empty role → invite → delete role → stale tag became break-glass).
- Tests must pin the stale-tag 403 and the sentinel round-trip; the old test that mocked a persisted
  JSON `null` must be replaced (it asserted a state the platform cannot produce).

## Task 2 — F-15/F-16 (High, blocking): frontend security headers

**Agent:** vercel-deployment-specialist. **Files:** `vercel.json`.

- [ ] Apply the `headers` block **exactly** from audit report §6.3 (CSP + XCTO + XFO + Referrer-Policy +
      Permissions-Policy + narrowed `Access-Control-Allow-Origin`). Do not invent allowances; the
      provenance table in §6.3 is the fence.
- [ ] F-19 decision (default: no change): add `includeSubDomains` to HSTS only if the operator confirms
      no non-TLS subdomain exists; record the decision in `docs/ops/deploy-runbook.md`.
- [ ] Verify on a **preview deployment first**: `curl -sI` shows all headers; browser pass with DevTools
      on Jobs, registration (Turnstile), resume upload/preview, company logo, CSV download — zero CSP
      violations. Turnstile-bootstrap fallback only as documented in §6.3 (never `unsafe-eval`).
- [ ] Promote to production, `curl -sI https://www.joblinked.site/` confirms; operator re-runs the
      external scanner.

## Task 3 — G-02 (High on live proof — gate blocker): delegation must not exceed the delegator

**Decision taken (2026-11-13): enforce (Option A).** Phase 4 proved two High vectors — self-widen to all
nine keys and nulling another admin's tag → break-glass — so G-02 joins G-01 and F-15 as gate-blocking.
Option B (amend ADR-042) is no longer on the table.

- [ ] Option A (recommended), backend: (i) invite — inviter's effective permission set must be a
      superset of the invited bundle; only a full break-glass admin (no tag) may invite a full admin;
      (ii) `PATCH/DELETE /admin/roles/:id` — deny editing/deleting the role assigned to the caller, and
      require the target bundle ⊆ caller's; (iii) `POST /admin/users/:id/custom-role` — superset rule,
      and only a full admin may set `null` on another admin. Reuse one superset helper.
- [ ] Option B: ADR-042 amendment documenting the ceiling + why; no code.
- [ ] Tests: P-07 vectors (self-widen, self-delete→break-glass) and P-08 (null another admin's tag;
      `users.manage` full-admin invite) all return 403 under Option A.

## Task 4 — G-03/G-04 (Medium/Low): pin the permission premise

**Files:** `server/src/auth.resolveRole.test.js`, `server/src/routes/permission-enforcement.test.js:60-64`.

- [ ] Test: `resolveRole` resolves `permissions` + `customRoleId` from the bundle (the fail-open premise
      must fail the suite if it regresses).
- [ ] Fix the mislabelled `dashboard.view` row and add pins for the four unpinned permission keys.

## Task 5 — F-08/F-09 (Low): write surface and PII in logs

**Files:** `server/src/routes/auth.js:155-169`, `server/src/middleware/metrics.js:55-58`, tests.

- [ ] Delete `POST /api/audit` (SPA has zero callers — verified) including tests; if the owner says a
      client uses it, strip `entity`/`entity_id`/`details` from the accepted body instead.
- [ ] `lastError`: store `req.path` (as `requestLog.js:13` already does), never the query string.
- [ ] Test: admin search URL with `?search=<name>` produces a metrics payload without the query.

## Task 6 — F-10 (Low): make the DB TLS assumption executable

**Files:** `server/src/db.js` (or `env.js`), unit test.

- [ ] Boot guard: if `DATABASE_URL` host is not `127.0.0.1`/`localhost`/Unix socket and `sslmode` is not
      `verify-full`, exit 1 with a non-leaking message. Loopback stays allowed (production topology).
- [ ] Test both branches with mocked env. (Alternative if rejected: record the ceiling in ADR-044 —
      owner's call; guard recommended.)

## Task 7 — F-04/F-11 (Low): validation residuals

**Files:** `server/src/routes/profiles.js:237-238,317-324`, `server/src/routes/jobs.js:287-290,355-361`.

- [ ] `doc_type`: validate against a short allowlist (or `reference_data` document-type catalogue if one
      exists) → 400 otherwise, on both upload paths.
- [ ] `salary_min`/`salary_max`: `Number.isFinite(Number(v))` in the same block as the min/max check
      (POST + PATCH) → 400, not a 22P02 500.
- [ ] Tests: `doc_type:"<script>"` 400; `salary_min:"abc"` 400.

## Task 8 — F-12/F-13/F-14 (Low): privacy notice matches behavior

**Agent:** frontend. **Files:** `src/shared/content/legal.js`, `src/features/public-site/__tests__/Legal.documents.test.jsx`.

- [ ] F-12: state the real retention (12-month purge for non-employment; accepted/placed/terminated kept
      as employment records).
- [ ] F-13: add "date of birth" to the identity bullet.
- [ ] F-14: reword the reports sentence to match the named applicant/roster exports (or restrict the
      roster export to counts — owner's call; wording is the default).
- [ ] Update any test that asserts the old sentences.

## Task 9 — Remaining small items

- [ ] **G-05** (backend): `admin-reference.js:141-149` — return 404 (not 403) for non-`custom_role`
      rows to a `settings.manage` holder, matching the non-disclosure rule; test.
- [ ] **G-06** (decision, then backend): key labelled "View Dashboard" gates the PII directory
      (`admin.js:12`). Recommended: rename the label to "View Directory" if PII listing is intended;
      otherwise add a distinct `directory.view` key and gate the route with it (+ `reference_data` seed,
      approved above). Small decision — architect confirms.
- [ ] **G-07** (backend, recommended): refuse suspend/role-change of the **last** super-admin with
      `custom_role_id IS NULL` (lockout guard); test. If declined, record as accepted in ADR-042.
- [ ] **F-17** (database-admin): apply migration 014 **before** the ADR-049 code deploy; run
      `select seeker_id, count(*) from resumes group by seeker_id having count(*) > 1` on the target DB
      (must be empty) before and after; document the order in the runbook. Optional defence in depth:
      restrict the replace `UPDATE` to the latest row.
- [ ] **F-18** (architect): amend ADR-045 — `/api/ai/resume-extract` is not implemented; autofill is
      client-side only.
- [ ] **P4-01** (ops — **DEFERRED 2026-11-13 per owner: disregard Turnstile/Supabase for now**). Reopen
      when auth work resumes: verify Turnstile is ON in the production Supabase project, attempt a
      password grant without a token against production → expect 400, store the artifact in the runbook.
- [ ] **P-01-O-1** (backend/tester): `server/scripts/verify-live.mjs:258-259` — update the stale
      "employer B reads A's jobs → 403" assertion to expect 200 with published-only rows per ADR-048;
      run `node scripts/verify-live.mjs --only jobs` against the local bench to confirm.

## Task 10 — Gate re-verification (after Tasks 1–9)

- [ ] Local: re-run the Phase 4 P-06 probe (G-01 closed) and the P-07/P-08 vectors (Task 3 closed).
      If the dev Supabase email rate limit blocks a fresh invite, use the equivalent invite-state
      fixture the Phase 4 report used (`2026-11-13-phase4-probes.md`, P-06 note) — do not weaken the probe.
- [ ] Prod (read-only): `curl -sI https://www.joblinked.site/` shows all five headers; operator re-runs
      the external scanner.
- [ ] `npm test` + `npm run lint` green in root and `server/`.
- [ ] Append a re-verification addendum to the delta audit report; gate flips to PASS only when G-01,
      G-02, and F-15 are evidenced closed. No finding is closed by assertion.

## Handoff

| Tasks | Agent |
|---|---|
| 1, 5, 6, 7, 9 (G-05/G-07), 3 (enforce) | `backend` |
| 2 | `vercel-deployment-specialist` |
| 4 | `test-generator` |
| 8 | `frontend` |
| 9 (F-17) | `database-admin` |
| 9 (F-18), decisions, gate sign-off | Lead Architect |
| 10 | `penetration-tester` + Lead Architect |
