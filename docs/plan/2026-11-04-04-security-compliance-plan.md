# Security & Compliance Plan

**For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
(after Lead Architect sign-off; ADR-036 requires explicit user approval first).

**Goal:** Close the security decision that is real (custom-role permissions),
replace the placeholder legal text, and pin the accepted ceilings in writing so
future agents stop flagging them as new findings.

**Tech stack:** unchanged. No browser-side DB (repo rule).

## Baseline (verified 2026-11-04)

- Strong posture already: helmet + fail-closed CORS/TRUST_PROXY, parameterized SQL
  with column allow-lists everywhere (no `...req.body` spreads), central error
  middleware that never leaks pg errors, CSV-injection-guarded exports, path-traversal
  guard on file serving, per-role `requireRole` middleware, audit logs, per-request
  account-status check, no anon access to PII (only `/api/jobs*` + `/health`).
- Real open item 1: custom-role permission bundles live in
  `reference_data.details` jsonb, are editable in super-admin UI, but are enforced
  NOWHERE server-side — `requireRole('super-admin')` is the only gate; permissions
  only shape what the SPA renders (documented in-code).
- Real open item 2: `/privacy` + `/terms` render `TERMS_PLACEHOLDER`
  (`src/shared/components/Legal.jsx:14`); TermsModal placeholder likewise. A PESO
  employment portal processes citizen PII → PH RA 10173 (Data Privacy Act) notice +
  employer terms are required, not optional.
- Known accepted ceilings (recorded, keep): 60 s JWT revocation window (ADR-028),
  in-memory rate-limit store (single instance), four unbounded reads by design
  (ADR-029), audit-log date filter assumes UTC+8 host.

## Decision gate 1 — ADR-036: custom-role permissions (user approval required)

Options (pick one, record in `docs/arch/adr-036-{slug}.md`):

- **A (recommended): document, don't enforce.** Today only super-admin accounts
  exist in the system; every admin endpoint already gates on
  `requireRole('super-admin')`. Roles + permission bundles are descriptive UI.
  Write the contract down (one paragraph in the ADR + a comment where bundles are
  read) and stop pretending they're authorization. Revisit the day a second admin
  tier is actually requested.
- **B: enforce server-side.** New middleware that resolves the caller's
  `custom_role_id` → permission set and guards each admin route by a
  route→permission map. Cost: touches every admin route + tests + role-UI
  contract. Only worth it if sub-admin delegation is a real upcoming requirement —
  that is the trigger, not hygiene.
- **C: cut the feature.** Delete custom-role CRUD + UI. Only if stakeholders say
  roles will never delegate.

## Task order

1. [ ] ADR-036 written with user's choice (blocks everything else here).
2. [ ] (If A) one comment + one contract paragraph; permission bundles remain
       UI-shaping only. Add a test asserting `requireRole('super-admin')` still
       gates a sampled admin route so the guarantee is pinned.
- [ ] 3. **Legal text — BLOCKED on stakeholder copy.** Replace `TERMS_PLACEHOLDER`
       in `Legal.jsx` with real Privacy Policy (data collected: identity, contact,
       education, employment history, resumes; purposes: job matching, stat
       reporting to LGU/PESO; RA 10173 rights; retention = the actual
       `runRetentionPurge` behavior) + real platform Terms. Same copy feeds
       TermsModal. Owner: backend/doc agent; needs user-supplied text.
- [ ] 4. CSP check: review helmet defaults; add a conservative CSP only if the app
       renders fine with it (inline styles/Tailwind AST check first). One task,
       revert if it breaks anything.
- [ ] 5. Dependency audit in CI: add `npm audit --audit-level=high --dry-run`
       step for root and `server/` to `.github/workflows/ci.yml` (advisory only,
       non-blocking initially).
- [ ] 6. Secrets hygiene confirmation: repo grep for any hardcoded
       `SUPABASE_SERVICE_ROLE_KEY`/DATABASE_URL literal (expect only dummy values
       in tests). Record result in this file's Results section.

## Failure modes to guard

1. Never "fix" G3 by removing `requireRole` checks because bundles "already
   describe" permissions — the role gate is the real boundary.
2. Legal copy is stakeholder-supplied — do not invent it silently; placeholder
   stays until real text arrives (it must not regress to *remove* the page).
3. CSP without testing the file-streaming + blob-download flows breaks resume
   view/download — test both before landing.
