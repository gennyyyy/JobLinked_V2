
**Spec:** this plan plus the ADR; seed terms mirror the user's examples ("registration fee", "processing payment").

## Global Constraints

- Server-side scan at the trust boundary on every write that can end result in a `published` post; the client hint is cosmetic, never authority.
- Employers are held, never auto-rejected: false positives exist, and fee language may be benign ("no fees are collected" is still held; the admin clears it).
- Reuse the existing review lane: `pending` in the `job_status` enum, the admin-jobs routes, and the admin JobPosts "Pending Review" badge. No enum change, no status rename.
- Employers keep their four statuses (draft | published | closed | archived, jobs.js:13); the server may set `pending` for them (an admin-lane value).
- Migrations go through db/migrations/012_*.sql applied with db/apply-migrations.sh; db/schema.sql changes need architect approval per AGENTS.md.
- Super-admin writes are exempt from blocking but must auto-resolve held flags when a fresh scan is clean (admins can legitimately edit content).
- No AI/ML in v1: one fixed, test-covered dictionary of English + common Tagalog fee phrases in a single server module; growing it is a data change, not code.
- Every hold and clear writes audit_logs (reuse audit()); employer-facing messages stay plain and instructive.

## Review Focus

1. Obfuscation ("reg. fee", "procesing", spaced "r e g i s t r a t i o n") — the detector normalizes case/spacing/punctuation and matches substrings; sophistication is capped at regex+normalization in v1 (documented ceiling, deeper NLP later).
2. Scope discipline: only job-post text fields are scanned; employer profile fields are out of scope for v1.
3. Fan-out safety: a held post must never trigger notifyMatchingSeekers and must be invisible to seekers — the existing status='published' pin guarantees invisibility; Task 3 keeps the fan-out behind a clean scan.
4. Concurrency: the scan decision happens in the same transaction as the status write, so a publish cannot commit without passing the guard.

---

### Task 0: DB migration — job_prohibited_flags

**Files:**
- Create: db/migrations/012_job_prohibited_flags.sql
- Create: docs/arch/adr-045-prohibited-fee-filter.md (one page: decision, thresholds, term list source, rollback = drop table)

**Interfaces (produced):**
- Table public.job_prohibited_flags: id uuid pk default gen_random_uuid(); job_id uuid not null references job_vacancies(id) on delete cascade; matched_terms text[] not null; source_fields text[] not null; severity text not null check (severity in ('blocked','held')); resolved text check (resolved in ('cleared','approved','rejected')); resolved_by uuid; resolved_at timestamptz; created_at timestamptz not null default now()
- Index: (job_id, resolved_at desc) plus partial index (job_id) where resolved is null — supports "is there an open flag for this job?" in O(1)
- Applied with: bash db/apply-migrations.sh (or the Windows equivalent documented in db/README.md); verify with a status check against the remote store + a rollback note in the ADR

### Task 1: Lexical detector — server/src/services/jobFeeFilter.js (test-first)

**Files:**
- Create: server/src/services/jobFeeFilter.js (pure ESM, zero new deps)
- Create: server/src/services/jobFeeFilter.test.js
- ADR picks up the curated term list (editable data later)

**Interfaces (produced, consumed by Task 3):**
- extractScannableText(job) -> string — title + description + requirements + benefits + instructions + tags joined, null-safe
- scanJobText(text) -> object { severity: 'none' | 'blocked' | 'held', matchedTerms: [], sourceFields: [] }
- scanJob(job) -> object — wraps the two
- FEE_BLOCK_TERMS / FEE_HOLD_TERMS exported arrays ("registration fee", "processing fee" in the block list; softer variants and Tagalog like "bayad muna", "magsingil" phrasing in the hold list)

**Behavior:** normalize text (lowercase; collapse repeated whitespace; strip punctuation; strip intra-word spaces like "r e g i s t r a t i o n"); then substring match. "registration fee"/"processing payment" must match all spelling-space variants. Severity 'blocked' wins over 'held' when both lists hit.

**Steps:**
- [ ] Step 1: write failing tests — hits for "We charge a registration fee", "500 processing payment required", "bayad muna bago interview", spacing-variant "r e g i s t r a t i o n   f e e", punctuation variant "reg.fee"; 'none' for clean posts; multi-field sourceFields; held-vs-blocked precedence.
- [ ] Step 2: run server/src/services/jobFeeFilter.test.js — FAIL (module missing).
- [ ] Step 3: implement the module (≈60 lines, comments at every evasion case).
- [ ] Step 4: run the same file — PASS.
- [ ] Step 5: npm run lint; run full server test suite once to prove no regression.
- [ ] Step 6: git commit — "feat(jobs): fee-post lexical detector with dual severity".

### Task 2: Wire the guard into every publishing path (server/src/routes/jobs.js)

**Files:**
- Modify: server/src/routes/jobs.js (POST /jobs, PATCH /jobs/:id, POST /jobs/:id/status)
- Test: server/src/routes/feeFilter.routes.test.js (new)

**Interfaces (consumes scanJob from Task 1; produces response shape):**
- When severity is 'blocked' on any employer-owned write: respond err(res, 422, 'FEE_POLICY', message-with-matched-terms) and DO NOT write anything (no insert, no status/history spin). Response is identical for create vs update; the client renders the matched terms inline.
- When severity is 'held' and the write result would be `published`: run the job write with status='pending' (not the caller's value). row insert on job_prohibited_flags (matched_terms, severity 'held') in the same transaction, one audit row, and notifyAdmins + notify employer (reuse notifyUser) with the hold explanation and link /employer/job-posts. notifyMatchingSeekers is NOT called.
- When severity is 'held' and the write result stays/stays draft: allow it (draft is invisible), record the flag row anyway for the record trail.
- When severity is 'none': the existing path is unchanged — a published create/update writes and fans OUT exactly as today.

**Steps:**
- [ ] Step 1: write failing supertest tests: (a) POST /jobs as employer with "registration fee" in description + canPublish stub true -> 422 + zero writes; (b) equivalent PATCH keeps the post draft/unchanged; (c) POST /jobs/:id/status to published with hold-term -> response .status='pending', one flag row, notifyAdmins called, notifyMatchingSeekers NOT called; (d) clean publish path still publishes and fans out (regression guard).
- [ ] Step 2: run the new test file — FAIL.
- [ ] Step 3: implement one shared helper inside Task-2 (per-route, ~15 lines): build the candidate job text from the caller's request (insert: the built record; PATCH: existing job merged with patch; POST /:id/status: the loaded job), run scanJob BEFORE any DB write. blocked -> 422, nothing written. held + result would be published -> write with status='pending' in the existing transaction, insert the flag row inside it. none / held-but-draft -> proceed as today. (Typo fixed in proofread: "tabla insert" -> "row insert" below.)
- [ ] Step 4: run the new tests — PASS.
- [ ] Step 5: npm test (full server+client suites green) and npm run lint.
- [ ] Step 6: commit — "feat(api): hold or reject fee posts at the employer publish boundary".

### Task 3: Admin decisions close the loop (super-admin paths)

**Files:**
- Modify: server/src/routes/admin-jobs.js (PATCH /admin/jobs/:id, POST /admin/jobs/:id/publish)
- Modify: server/src/routes/jobs.js (POST /jobs/:id/duplicate — copy an already-clean parent only)
- Test: server/src/routes/feeFilter.admin.test.js — new supertest suites

**Behavior:**
- Admin write/publish: scan runs again AFTER applying the admin's edits inside the transaction. If still 'blocked' or 'held' AND the admin explicitly publishes or approves, ALLOW the write and mark any open flags resolved='approved', resolved_by, resolved_at (the admin IS the human reviewer — audit proves it).
- If 'held' has an OPEN flag and the admin has NOT explicitly published/appraised (they are, e.g., just editing a field), the flag stays open and the post keeps its 'pending' status.
- Employer edit of a held post (PATCH /jobs/:id content-only while status 'pending'): re-scan; if clean, status flips to 'draft' (back to employer's lane) and the flag is resolved='cleared'; if still matching, keep 'pending' + note.
- Employer re-attempts publish on a still-matching post: same hold semantics as Task 2 (no new flag row if an OPEN row exists — upsert guard).
- Duplicate: the copy inherits ONLY from a job with no open flag; otherwise 422 like a blocked create.

**Steps:**
- [ ] Step 1: write failing supertest tests: admin publish on held post resolves the flag + publishes + fans out once; employer clean edit clears ('draft' + resolved flag); employer re-publish on still-matching post does not duplicate flags; duplicate of a held parent 422s.
- [ ] Step 2-4: implement in admin-jobs.js/jobs.js so all tests pass (one flag row per job at a time = the partial unique open-flag index is the enforcement).
- [ ] Step 5: npm test + lint.
- [ ] Step 6: commit — "feat(admin): fee-post review decisions close the loop".

### Task 4: Client surfaces (employer posting dialog + admin queue)

**Files:**
- Modify: src/features/employer/JobPostFormDialog.jsx (inline live warning)
- Modify: src/features/employer/JobPosts.jsx (422 error path renders matched-terms message; held rows show the existing Pending badge)
- Modify: src/features/super-admin/JobPosts.jsx (pending filter default surface + "held for fee language" detail row linking to the flag evidence)
- Create: src/shared/services/feeFilter.js -> api client GET /jobs/fee-filter/terms
- New Server GET route (same Task-2 file edit): GET /jobs/fee-filter/terms (employers + super-admins; returns the term lists so the dialog can highlight locally without a round-trip per keystroke)

**Behavior:**
- The dialog fetches the terms once on mount and regionally re-highlights matched phrases as the employer types (pure client-side lookup against the same dictionary — cosmetic; server remains authority).
- On a 422 FEE_POLICY response, the dialog shows a red alert listing the matched phrases per field, the post stays unsaved (server wrote nothing).
- On a held publish (2xx response with status 'pending'), the dialog/rows show "Submitted for PESO review — mentions of fees/payments need PESO clearance before the post goes live."
- Super-admin JobPosts: the pending list gains a fee-evidence strip (matched terms + source fields) and an Approve button that routes through the existing admin PATCH publish path (Task 3), which resolves the flag server-side.

**Steps:**
- [ ] Step 1: client component tests (jsdom): terms fetch + highlight on typing a trigger phrase; 422 alert listing matched terms; held row shows pending badge.
- [ ] Step 2: run tests -> FAIL. Step 3: implement. Step 4: PASS.
- [ ] Step 5: npm run lint + full client suite.
- [ ] Step 6: commit — "feat(ui): live fee-post warning and PESO review surfacing".

### Task 5: End-to-end verification (manual, mirrors acceptance)

- [ ] Run: log in as employer, create post typed "…a registration fee of ₱500 applies" -> server 422, dialog explains, DB has zero new job rows.
- [ ] Run: create post with only "Hiring! No fees, payments or donations required" -> held -> employer sees pending; admin JobPosts shows the evidence strip; admin Approve -> published; seeker search finds it; flag resolved='approved' in psql.
- [ ] Run: npm test + npm run lint green; migration applied to the remote store: select from job_prohibited_flags returns both the held row and the resolved row.

## Rollback

- Code: revert the three commits (filter module / route wiring / client). The injected GET /jobs/fee-filter/terms route is additive and dies with the module import.
- DB: db/migrations/012_job_prohibited_flags.sql is additive (new table + indexes). Rollback = drop table job_prohibited_flags; nothing else references it after the code revert.
- Data: held posts stay status='pending' — re-enabling the old behavior requires manually flipping pending posts back (documented one-liner in the ADR; no hidden state).

## Proofread record (self-review, 2026-11-11)

- Spec coverage: block semantics (Task 2), hold semantics + review lane reuse (Task 2/3), admin override and evidence (Task 3), employer live hint + 422 UX (Task 4), migration + rollback (Task 0), end-to-end acceptance (Task 5). All user asks covered: automatic flag on employer typing fee/payment language, strict no-bribery/no-payment stance, live feel via in-dialog highlighting.
- Step scan: every step authorable as a single artifact; no "and also…"/TBD rows found in the final text.
- Type/name consistency: scanJob/scanJobText/extractScannableText used identically in Tasks 1, 2; job_prohibited_flags columns identical between Task 0 and Task 2/3 texts; status lanes match jobs.js:13 and admin-jobs.js:33 (draft/published/closed/archived vs the full admin enum incl. pending).
- Contradictions fixed during proofread: super-admin exemption now stated once in Global Constraints and implemented once in Task 3; the draft "tabla insert" typo removed; the mangled Task-2 step-3 sentence rewritten as a decision-before-write ordering that matches each route's real structure; duplicate-route ownership moved fully under Task 3.
- Fix-pass list: test-first ordering intact; fan-out prohibition (notifyMatchingSeekers) asserted in Task 2 test (c) and honored in Task 3 admin path only after explicit approval.
- Confidence statement: the mechanics are code-level exact (files, statuses, helper shape); the only judgment calls are the open term list and the "held" default — both documented in the ADR, both cheap to re-tune post-hoc.
