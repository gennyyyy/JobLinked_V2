# Role-Aware Help Assistant Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the dormant `POST /api/ai/help` assistant for all three portal roles with role-specific factual briefs, fix the unconfigured-model bug, and move the widget into the shared portal shell so every portal serves help from one mount.

**Architecture:** Thin changes on an already-built feature: the route selects a brief by the server-resolved DB role (`req.user.role` from `server/src/auth.js`), the shared `HelpChat` widget mounts once in `TopNavLayout`, and privacy/DPA copy plus a friendly fallback complete the contract. Provider plumbing comes from Plan A Task 1.

**Tech stack:** Node 24 · Express · React 19 · Vitest · zero new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-05-ai-job-matching-and-help-design.md` v1.1 §3 + §5 (the plan argues from the spec, and it travels with it).

**Depends on (exact):** `server/src/aiProvider.js` exports `callChat({messages, maxTokens, timeoutMs})`, `resolveConfig() -> {key, base, model}`, from Plan A Task 1. Plan A must land Task 1 first; everything else in this plan is independent of Plan A Task 4.

## Global Constraints

- JavaScript/JSX only; no TypeScript; zero new dependencies; no DB changes.
- Keep unchanged (ADR-023 contract): `auth` middleware; `aiLimiter` (20 req / 15 min, key `req.user?.id || ipKeyGenerator(req.ip)`); ≤10 messages × 1000 chars; 10 s timeout; `502 UPSTREAM_ERROR`; `503 AI_NOT_CONFIGURED` when key unset; error envelope `{ error: { code, message } }`; message content never logged or persisted.
- Roles served (exact): `job-seeker`, `employer`, `super-admin` — brief chosen from `req.user.role` (server-resolved DB role; never client-decodable claims). Any other role value → 403 `FORBIDDEN`.
- Feature-2 copy pinned in this plan's tasks is exact copy: the privacy footer line, the 503 fallback line, and the DPA paragraph — do not paraphrase.
- Route keeps Upstream provider plumbing via Plan A's `callChat`; the message array sent upstream stays `[system brief, ...user messages]`.

## Review Focus

1. **A stored payload with someone else's PII** (e.g., a super-admin pastes "who is john.doe@example.com"): the brief must answer only how-do-I and steer to PESO channels — no account data exists upstream, no logging exists. — Pinned by Task 2's `does not echo personal data and logs no message content`.
2. **Unauthenticated or mid-provisioning visitor:** shared `TopNavLayout` renders public-shape pages only through portal routes; the widget must not render for a missing user, and `POST /api/ai/help` still 401s safely. — Pinned by Task 3's `does not render the widget without a user`.
3. **Wrong role brief requested** (spoofed or unknown role value): 403 `FORBIDDEN`, no provider call, no brief disclosure. — Pinned by Task 2's `answers 403 for unknown roles without calling the provider`.
4. **Model unset while base points at NVIDIA:** upstream 404-class → existing 502 contract (NOT 403/500 surprises), boot warning at first use. — Pinned by Task 2's `surfaces the existing 502 when the model is unresolvable`.
5. **Old mount left behind:** `JobSeekerLayout`'s HelpChat import/mount must be gone so no double widget appears. — Pinned by Task 3's source-grep step + updated layout test.

---

### Task 1: Role briefs `server/src/ai/briefs.js`

**Files:**
- Create: `server/src/ai/briefs.js`
- Test: `server/src/ai/briefs.test.js`

**Interfaces:**
- Produces: `BRIEFS: { 'job-seeker': string, employer: string, 'super-admin': string }` (plain strings, consumed by Task 2 as the system message).
- The job-seeker brief is the existing `HELP_BRIEF` text from `server/src/routes/ai.js` (lines ~7–21), moved verbatim.
- New briefs — pin this exact copy (may fix only code-level facts that changed in the app before shipping):

employer:
```
You are the in-app help assistant for PESO JobLinked employers (PESO Santa Maria).

You answer "how do I..." questions about the employer side of the app. You can explain:
- Posting jobs: create a draft, fill title/description/requirements/tags, publish when all required fields are complete, edit or duplicate a posting, close or archive it when it is no longer available.
- Accreditation: your first post requires PESO accreditation; submit company details and authorized-representative information from Company Profile, and PESO staff review and update your status (Approved, Pending Review, Rejected, Resubmission Requested, Suspended).
- Applicants: open your posted jobs to review applicants, view their details, and move each applicant through your pipeline. Hiring decisions belong to you; PESO staff handle accreditation only.
- Account: company details and representative information are editable on your Company Profile page.

Answer only questions about JobLinked and how to use it. You cannot see your posts, applicant data, or any account data, so never claim to look something up. For anything beyond the app, tell the employer to contact PESO Santa Maria.
```

super-admin:
```
You are the in-app help assistant for PESO JobLinked super-admins (PESO Santa Maria staff).

You answer "how do I..." questions about the admin side of the app. You can explain:
- Accreditation review: open employer submissions, approve, request resubmission, or reject with required remarks.
- User and role management: search accounts, invite users, change or suspend role access (role moves deactivate the old role's row; you cannot modify your own elevated permissions).
- Applications: review the recent application pipeline across employers.
- Reports: barangay and platform reports; CSV downloads are provided-data only.
- Audit trail: browse system activity records.

Answer only questions about JobLinked and how to use it. You cannot see any account's data, so never claim to look something up. For questions outside the app, tell the user to follow internal PESO channels.
```

- Shared guard rows are already inside each brief (the "You cannot see..." lines).

- [ ] **Step 1: Write failing test** `briefs.test.js`: `exposes exactly three role briefs`, `job-seeker brief matches the live route copy` (text starts `You are the in-app help assistant for PESO JobLinked, a job-matching site run by PESO Santa Maria.`), new briefs end with a PESO-contact guard line.
- [ ] **Step 2: Run** `npx vitest run --root server -- src/ai/briefs.test.js` → FAIL
- [ ] **Step 3: Implement** `BRIEFS` (move HELP_BRIEF verbatim; add the two pinned texts)
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `feat(server): role briefs for the AI help assistant`

### Task 2: Route change `server/src/routes/ai.js`

**Files:**
- Modify: `server/src/routes/ai.js` (remove `HELP_BRIEF` constant + `requireRole('job-seeker')`; system prompt = `BRIEFS[req.user.role]`; unknown role → `err(res, 403, 'FORBIDDEN', 'Insufficient role')` BEFORE validation; model resolution via `resolveConfig()` from Plan A Task 1 — `model: cfg.model` where cfg.model is `null` → send request only if key+model present, else map to the existing 503/`UPSTREAM_ERROR` semantics exactly as today: missing CONFIG (key OR model with non-OpenRouter base) → 503 `AI_NOT_CONFIGURED`)
- Test: extend `server/src/routes/ai.test.js`

**Interfaces:**
- Consumes: `BRIEFS` (Task 1), `resolveConfig()` (Plan A Task 1), existing `validate()`, `aiLimiter`, `auth`, `ah`, `err`.
- Produces: same response contract as today (`{ reply }`), now for all three roles.

- [ ] **Step 1: Write failing tests** in `ai.test.js` (existing harness style — createClient/fetch stubs stay):
  - `serves an employer with the employer brief` (route 200; assert outbound body messages[0].content contains `PESO JobLinked employers`)
  - `serves a super-admin with the admin brief`
  - `answers 403 for unknown roles without calling the provider` (Review Focus 3)
  - `503s when the model is unset for a non-OpenRouter base` (NVIDIA-style base with no `OPENROUTER_MODEL` → 503 `AI_NOT_CONFIGURED` before any provider call; a SET model rejected upstream keeps the existing 502)
  - `does not echo personal data and logs no message content` (assert logger spy got no fixture message text) (Review Focus 1)
  - keep existing job-seeker cases green (same 200/429/502/503 semantics)
- [ ] **Step 2: Run** `npx vitest run --root server -- src/routes/ai.test.js` → new FAIL
- [ ] **Step 3: Implement** the change per Interfaces (delete HELP_BRIEF from the file after moving)
- [ ] **Step 4: Run** route tests + full server suite: `npx vitest run --root server` → PASS
- [ ] **Step 5: Commit** `feat(server): role-aware AI help for all portal roles`

### Task 3: Widget relocation + single shared mount

**Files:**
- Create: `src/shared/components/HelpChat.jsx` (moved verbatim from `src/features/job-seeker/HelpChat.jsx`; keep the job-seeker wording for seats where it renders; no functional change)
- Modify: `src/features/job-seeker/JobSeekerLayout.jsx` (remove import + `<HelpChat />` mount)
- Modify: `src/shared/components/TopNavLayout.jsx` (render `{user && <HelpChat />}` next to the existing floating actions — `user` comes from the auth hook the layout already uses; attr: no new props)
- Test: `src/shared/components/__tests__/HelpChat.test.jsx` (moved from `src/features/job-seeker/__tests__/HelpChat.test.jsx`, import path updated)

**Interfaces:**
- Consumes: `askHelp` (`@/shared/services/ai`) unchanged.
- Produces: floating help button on all three portals via their shared layout.

- [ ] **Step 1: Write failing test** in `TopNavLayout` tests: `renders the help widget only when a user exists` (with user → `aria-label="Open help chat"` present; without user → absent) — also assert JobSeekerLayout-level old mount removal via source grep step below.
- [ ] **Step 2: Run** `npx vitest run src/shared/components src/features/job-seeker` → FAIL (new mount test)
- [ ] **Step 3: Implement** move + mount + remove
- [ ] **Step 4: Grep guard:** `grep "HelpChat" src/features/job-seeker` → must return no matches (Review Focus 5)
- [ ] **Step 5: Run** `npx vitest run src/shared/components src/features/job-seeker src/features/employer src/features/super-admin` and `npx eslint .` → PASS
- [ ] **Step 6: Commit** `refactor(ui): mount the help chat once in the shared portal shell`

### Task 4: Privacy, fallback copy, docs — final

**Files:**
- Modify: `src/shared/components/HelpChat.jsx` — add (1) dialog footer line, exact: `Answers are generated by an AI provider. Don't include personal details here; nothing about your account is shared.` (2) error branch: when `err.status === 503` or `err.status === 429`, set message exactly: `The assistant isn't available right now. For help, contact PESO Santa Maria.` (other errors keep `FALLBACK_ERROR` unchanged)
- Modify: `src/features/public-site/Legal.jsx`-rendered terms body — `src/shared/components/TermsModal.jsx` `TERMS_PLACEHOLDER`: append section 8, exact:
```
8. AI Features
Some in-app assistance (help answers and vacancy ranking) may be processed by an external AI provider on our behalf. JobLinked transmits only the content you type or public job information. We do not transmit your name, contact details, resume, or application records to that provider. Processor arrangements and safeguards apply; to exercise your privacy rights, contact the PESO Santa Maria office listed in section 5.
```
- Modify: `docs/arch/rework/02-api-contract.md` (Addendum: `/api/ai/help` served for the three roles + 403 unknown role + 503 when key OR required model missing) + mark ADR-023 §"Audit whether..." line as resolved by this feature
- Test: extend `HelpChat.test.jsx`: footer line renders; 503 error shows the PESO-contact line; 429/other error unchanged

- [ ] **Step 1: Write failing tests** (copy assertions above)
- [ ] **Step 2: Run** `npx vitest run src/shared/components src/features/public-site` → FAIL
- [ ] **Step 3: Implement** copy + docs edits
- [ ] **Step 4: Run** `npx vitest run` (whole root suite) + `npx vitest run --root server` + `npx eslint .` → PASS
- [ ] **Step 5: Commit** `feat(ui): privacy disclosures and friendly AI fallback for all portals`

## Execution order

Plan A Task 1 first → then this plan Task 1 → 2 → 3 → 4 (strict).

## Out of scope

- Employer-side briefs touching candidate data (by design — briefs see no account data), new chat persistence, new roles.
