# Code Health Plan — dead code, duplicates, monoliths, dormant modes

**For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
(after Lead Architect sign-off; two items are user decisions, see Decision gates).

**Goal:** Remove what shouldn't exist, finish small verified-open product gaps,
and impose split-on-touch discipline on the three monoliths — without any
behavior change beyond what Decision gates approve.

**Tech stack:** unchanged.

## Baseline (verified 2026-11-04)

Dead/unused code (kept alive only by their own tests):
- `src/shared/components/SiteHeader.jsx`, `SiteFooter.jsx`, `AccountMenu.jsx`,
  `NotificationBell.jsx` (Bell + dropdown re-implemented inline in
  `TopNavLayout.jsx:220-260`); chain `ApplicantsShell → CardListLayout → SearchBar`
  (Applicants imports ApplicationTimeline/SeekerProfileCard directly).
- `src/components/ui/sonner.jsx` wrapper + `sonner` dep + `<Toaster>` in `App.jsx`
  with **zero** `toast()` calls anywhere; live feedback = the shared `Toast`
  component inside NotificationsPage. Two toast systems, one dead.
- `public/images/*.png` — three ~3.3 MB files, ~11 MB into every build (flagged in
  the perf plan as supplied assets — DELETION IS A DECISION, default keep).

Monoliths (no preemptive refactor policy: split when next touched):
- `employer/JobPosts.jsx` (1090 lines), `job-seeker/Profile.jsx` (730 lines).
- `server/src/routes/admin.js` (697 lines; notifications routes still inside —
  ADR-026 ratified, never executed).

Verified-open product gaps: employer resume-view action (route exists server-side);
admin seeker depth tabs (server routes exist: `/admin/seekers/:id/education|
experience|employment`); admin accreditation "request additional docs";
admin dashboard counters; ADR-001 one-liners book-closing.

## Task order

### Phase A — deletions (each step grep-verified before delete)
- [ ] Step 1: For each candidate: `grep -r "ComponentName" src/ --include=*.jsx --include=*.js`
      excluding its own file + own test. If ANY non-test importer exists → stop, re-route
      through Roadmap 01, don't delete (ladder rung 2 rule: the inventory was sampled).
- [ ] Step 2: Delete each confirmed-dead component **and its own test** in one commit:
      SiteHeader, SiteFooter, AccountMenu, NotificationBell, ApplicantsShell,
      CardListLayout, SearchBar (the whole chain only if all three survive grep).
- [ ] Step 3: Delete `src/components/ui/sonner.jsx`, remove the `<Toaster>` mount
      from `App.jsx`, remove `sonner` from `package.json`, prune imports; keep the
      live `Toast` in NotificationsPage. Commit with "remove unused sonner toasts".
- [ ] Step 4: `npm run lint && npm test` — tests referencing removed exports are
      exactly the dead ones; make sure no live test silently overwritten/skipped.

### Phase B — server decomposition (ADR-026, execute finally)
- [ ] Step 1: In `server/src/routes/admin.js`, lift the 4 `notifications/*` routes
      into `server/src/routes/notifications.js` (self-contained, user-token-only). Wire
      into `routes/app.js`. 697→~600 lines.
- [ ] Step 2: Split the remainder into `admin-users.js` / `admin-jobs.js` /
      `admin-reference.js` (or keep as two files if each under ~350 lines — the ADR's
      spirit is boundaries, not file-count aesthetics). Existing route paths and test
      mocks (`helpers/auth.js`, `helpers/db.js`) must be updated at parity.
- [ ] Step 3: `npm --prefix server test` — all existing server tests must pass
      *unchanged* (only route-location/mocks updated).
- [ ] Step 4: Update the "stale" note in ADR-026 and the API contract doc
      (`docs/arch/rework/02-api-contract.md` mentions file locations).

### Phase C — small verified-open product gaps
- [ ] Step 1: Employer resume-view row-action restore: button in
      `employer/Applicants.jsx` opening the existing file GET
      (`documents.js` service, signedUrl/link rule at `profiles.js:298-301`).
      Verify 403 fallback surfaces `InlineError`.
- [ ] Step 2: Admin seeker depth: in `super-admin/Employees.jsx` detail modal add
      tabs (Background / Employment History) consuming the three existing
      `/admin/seekers/:id/*` endpoints. Add admin resume view row via the same
      files endpoint the employer uses (admin policy bypass already server-side).
- [ ] Step 3: Accreditation "request additional docs" — VERIFY FIRST what
      `ACC_STATUSES` supports today (`server/src/routes/profiles.js`) before
      requesting schema change; if a status must be added this is a db migration and
      needs Lead Architect sign-off (do NOT edit `db/schema.sql` on your own).
- [ ] Step 4: ADR-001 one-liners book-close: verify the four items (register
      navigate path, `'revoked'` in ACC_STATUSES constants, getStats dedup, Logs
      user-join) — close whatever remains reviewable in one commit; doc-annotate
      statuses in ADR-001.
- [ ] Step 5 (optional, cheap): admin Dashboard counters — add
      `ACTIVE_VACANCIES` / `ACCEPTED_TOTAL` / `PLACED_TOTAL` to `getStats()`
      + render. Report-only, no new endpoints.

### Phase D — split-on-touch discipline (no code now)
- [ ] Step 1: No preemptive refactor of `JobPosts.jsx` / `Profile.jsx`. Policy
      note (one comment line at the top of each file): when a feature next
      edits the file beyond one screen, split along that feature's boundary
      instead of extending the monolith.

## Decision gates (user input blocks these)

| Decision | Default proposal | Effect |
|---|---|---|
| AiMatchModal (`AiMatchModal.jsx:8,19` fake) | **Cut the button**; keep the real HelpChat (live `/api/ai/help`) | no backend work; one JSX deletion |
| Dark mode (dormant tokens + signed spec) | **Implement spec** (`docs/superpowers/design/2026-10-18-dark-mode-design.md`) as one scoped pass OR **delete** tokens+spec; commit either way | ~22 `dark:` usages + provider |
| `public/images/*.png` (11 MB unused) | Keep (supplied brand assets), note in build | none |

## Acceptance

- `npm test`, `npm run lint`, `npm run build` green after every phase.
- Server test suite parity after Phase B: same number of passing tests, only
  file-level relocations.
- No behavior change beyond the three Decision gates above.
