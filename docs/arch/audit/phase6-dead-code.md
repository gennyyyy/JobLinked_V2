# Phase 6 — Dead Code, Leftovers & Dependency Bloat

**Scope:** whole repo, post ~80-file multi-agent session. Scans ran against the working tree, not git HEAD — most of the session's work is still untracked.

---

## 1. Deleted (proof of zero importers + verification)

### 1.1 `src/features/super-admin/Employees.jsx` — 516 lines

Zero importers, verified 4 independent ways:

| Check | Result |
|---|---|
| `git grep` / ripgrep for `super-admin/Employees` repo-wide | 0 hits (only self-refs inside the file) |
| Resolved-import graph (`src/` + `server/src/`) | no file imports it |
| `src/App.jsx` routes | `/super-admin/*` has **no** `employees` child route (employer's does, line 108) |
| `SuperAdminLayout.jsx` navItems | no `Employees` entry (only employer's `EmployerLayout` has one) |

- No test file imports it (`src/features/employer/__tests__/Employees.test.jsx` imports `../Employees` = the **employer** page).
- `vite build` chunk list confirms removal: only one `Employees-*.js` chunk remains (`src/features/employer/Employees.jsx`), the super-admin one is gone.
- Corroborating: `docs/arch/audit/phase2-test-suite-audit.md:217` listed it in section **A5 "files with no tests"** — never reachable, so never tested. This is the dead sibling of the session's already-deleted `Facebook.jsx`.

### 1.2 `server/scripts/tmp-users.cjs` — 14 lines

Literally named `tmp-*`; a one-off ad-hoc DB dump (`select 'seeker'… union all …`). Zero
importers (standalone script, nothing references it); not in any package.json script.
`server/scripts/` now contains only `loadtest.mjs` (a documented deliverable, referenced
in `docs/arch/audit/phase4-loadtest.md`).

### 1.3 `exportReport()` — `src/shared/services/admin.js`, 6 lines (incl. 2 comment lines)

Zero importers: `Reports.jsx` builds its own CSV via a local `downloadCSV()` (line 63) and
never calls it. Its comment claims "the Reports page falls back to its client-side CSV builder"
— but there is no server-export path on the page, so the comment describes behaviour that
never existed. Not referenced in any config/entry. `api.blob` stays — `services/documents.js:83` uses it.

### Verification after deletions

| Command | Result |
|---|---|
| `npx vite build` | ✅ `✓ built in 2.72s` |
| `npx vitest run` (root) | ✅ **121 files / 767 tests — all pass** |
| `cd server && npx vitest run` | ✅ **46 files / 360 tests — all pass** |
| `npx eslint .` | ✅ clean (no output) |

**Baseline note:** before deleting anything I captured a baseline of 121/767 (2 failures)
and 46/360 (2 failures). All four were **flaky**, not caused by my changes — they pass on
re-run (`JobPosts.search.test.jsx` 5 s timeout; `api-rate-limit.test.js` 404-vs-429 on
`/api/not-a-route`, which depends on the limiter having already consumed its bucket).
Backup of all three deleted bodies: `C:/Users/genny_/AppData/Local/Temp/opencode/phase6-backup/`

---

## 2. Recommend deleting — did NOT (needs architect sign-off)

### 2.1 `NOTIFICATION_TYPES` — `src/shared/constants.js` (7 lines)
Zero refs anywhere in code. **But** `docs/arch/rework/04-frontend-plan.md:24` explicitly names
it as a constant that "stay[s] client-side" — a documented design decision, so keep-or-delete
is not a dead-code call.

### 2.2 `listAllEmployees()` + `listReferrals()` — `src/shared/services/admin.js` (8 lines)
Became dead **as a consequence of deletion 1.1** (they were its only callers). However the
server routes they mirror are live: `server/src/routes/admin.js:286` `GET /admin/employees`
and `:297` `GET /admin/referrals`. Deleting the wrappers removes the last client path to a
live API surface — a parity call, not a dead-code call.

### 2.3 `@types/react@^19.2.17` + `@types/react-dom@^19.2.3` — root devDependencies
Zero `.ts`/`.tsx` files in the entire repo (verified) and zero importers. Pure bloat. Not
deleted: removal requires `npm install` + `package-lock.json` regen, a dependency/lifecycle
decision, not a code deletion.

### 2.4 `@dietrichgebert/ponytail@^4.9.0` — root devDependency
Zero importers in code; the only repo copy of ponytail is the bundled skill at
`.agents/skills/ponytail/SKILL.md`. **Leftover tooling, not an app dependency.** Reported,
not removed, per instructions.

### 2.5 Dead `export` keywords on internal-only symbols
Used inside their own file, so only the *export surface* is dead. Four one-word edits, zero
behaviour change — listed for completeness: `server/src/auth.js` `userFromToken`, `roleFrom`
(used at 51/53/66/70/84/86/103); `NotificationsPage.jsx` `SystemBadge` (134), `NotificationItem`
(446); `TermsModal.jsx` `TERMS_PLACEHOLDER` (47, default param).

### 2.6 Repo-root scratch / non-code leftovers (report only)

| File | Size | Tracked? | Note |
|---|---|---|---|
| `test_samples.mjs` | 67 lines | **tracked** | manual harness for `mapResumeText`; output is `test-final.txt` |
| `test-final.txt` | 3.5 KB | untracked | captured vitest run output |
| `to_do.md` | 9.7 KB | **tracked** | requirements checklist, superseded by `docs/arch/plans/` |
| `dbcheck.cjs` | 23 lines | untracked | one-off `employer_accreditations` schema dump |
| `new_landing_page/` | 1.5 MB | untracked | design mockup, zero references (incl. no git-grep hit) |
| `.freebuff/project-id`, `gawa ni josh.pdf` | small | mixed | unrelated tooling/asset |

Nothing under `db/`, `docs/`, `supabase/`, `.env*`, `sample_pdf/` was touched.

---

## 3. Checked and genuinely used (no action)

- **Every `src/shared/services/*` module has importers.** `audit.js` looks unimported on a naive
  path grep because it is imported as `./audit` — real importer is `services/auth.js:3`
  (`logAudit`, 4 call sites).
- **All 14 `src/shared/components/*`** have importers (`dashboard.jsx` = 12, `LoadingScreen` = 31,
  `TagInput` = 3, `Toast`/`SidebarAccount`/`NotificationBell` = 2 each…).
- **Whole-module zero-importer scan** over `src/` + `server/src/` returned only `main.jsx`
  (entry, `index.html`), `src/test/setup.js` (vitest setup), and the deleted `super-admin/Employees.jsx`.
- **Zero broken relative imports** repo-wide. The single hit was a false positive:
  `import { err } from './util.js'` inside a `toContain()` **string literal** at
  `s3-s6-s7-error-handling.test.js:17` (a source-text assertion, correct as written).
  **Zero re-exports / `export *`** — the export-name scan had no blind spots.
- **Dependencies:** all 35 have importers except `@dietrichgebert/ponytail`, `@types/react`,
  `@types/react-dom` (§2.3–2.4). `concurrently` and `jsdom` show zero *imports* but are used via
  `package.json` script and `environment: 'jsdom'` — both live. `supertest` (19 files) and
  `vitest` in `server/` are heavily used, not single-test. `mammoth`/`pdfjs-dist` are used by
  `src/shared/lib/resumeText.js` (the `test_samples.mjs` hits are a second, scratch consumer).

## 4. Test-file hygiene — clean

- **`.only` / `.skip` / `.todo` / `describe.only` / `it.skip`:** 0 hits repo-wide.
- **Test files importing non-existent modules:** 0.
- **The `_scratch-debug.test.js` twin is gone** — no `scratch|debug|temp|tmp|_1|_2|~` named
  test files remain (the only `tmp-*` file was the script deleted in §1.2).
- **Duplicated test files:** none. Two basenames appear twice (`auth.provision.test.js`,
  `profiles.patch.test.js`) but the pairs are **different test styles** — `routes/*` =
  source-text contract tests (read the file, no DB), `__tests__/*` = supertest runtime tests
  with mocked db. Both intentional, both run.
- **Test helpers:** all used — `server/src/__tests__/helpers/{app,auth,db}.js` (16–20 importers
  each), `src/test/api-helper.js` (4 service tests), `src/test/setup.js`.

## 5. Session leftovers — clean

- **`console.*` in `server/src/**`:** exactly 1 hit, `logger.js:24` — the sink itself
  (excluded per policy). **The logging migration missed nothing.**
- **`console.log`/`console.debug`/`debugger` in `src/**`:** 0 hits.
- **`DEBUG-` / `FIXME` / `XXX` / `HACK`:** 0 hits. (Two `XXX` matches are the
  `02-XXXX-XXXX` phone *placeholder* text, not markers.)
- **Commented-out code blocks (3+ consecutive):** 0. Every 3+ line comment run in the repo is
  explanatory prose (ADR/security rationale), not dead code.
- **`docs/arch/audit/` superseded duplicates:** none — all 21 files have distinct md5 hashes
  and distinct phase subjects (phase1–5, master-plan, 6 agent briefs).

---

## Impact

**-536 lines** (516 dead page + 14 scratch script + 6 dead service fn). Test coverage unchanged at 121 files / 767 (root) and 46 files / 360 (server) — the deleted page had no tests because it had no route.
