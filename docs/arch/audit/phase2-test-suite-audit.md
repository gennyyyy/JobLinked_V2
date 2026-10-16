# Phase 2 — Test Suite Audit

> JobLinked · PESO Santa Maria Job-Matching Platform
> Scope: health of the existing Vitest suite — run, lint, staleness, flakiness, coverage gaps.
> Audit window: 2026-10-15 17:05 – 17:55 (local)

---

## 1. Executive summary

| Metric | Value |
|---|---|
| Test files | **95** |
| Tests | **561** |
| Passing | **561** |
| Failing | **0** |
| Skipped / todo | **0** |
| `npm test` exit code | **0** |
| `npm run lint` exit code | **0** |

`npm test` and `npm run lint` both pass. **Two stale test-authoring bugs were found and fixed**; both fixes were mutation-verified (see §4).

> ⚠️ **Important context — this repo is a moving target.** Large parts of the working tree are
> uncommitted and several parallel phases are actively adding tests. The suite went from
> **71 files / 427 tests** at the start of this audit to **95 files / 561 tests** by the end,
> with ~25 brand-new test files landing inside a 50-minute window. See §5.

---

## 2. Verification evidence

Fresh, complete runs — no reuse of earlier output:

| # | Time | Command | Result | Exit |
|---|---|---|---|---|
| 1 | 17:06 | `npm test` | 71 files / 427 tests passed | 0 |
| 2 | 17:11 | `npm test` | 71 files / 427 tests passed | 0 |
| 3 | 17:53 | `npm test` | 95 files / 561 tests passed | 0 |
| 4 | 17:54 | `npm test` | 95 files / 561 tests passed | 0 |
| 5 | 17:11 | `npm run lint` | clean (no output) | 0 |
| 6 | 17:55 | `npm run lint` | clean (no output) | 0 |

Runs 1 and 2 are byte-identical in counts, as are runs 3 and 4 — stable across repeats.

---

## 3. Checked and found clean

| Check | Result |
|---|---|
| `test.skip` / `it.skip` / `describe.skip` / `test.todo` / `test.only` / `fdescribe` / `fit` | **none** |
| Test files containing zero tests or zero `expect(...)` | **none** |
| Fixed-sleep anti-patterns (`waitForTimeout`, `sleep()`, ad-hoc `setTimeout` waits) | **none** |
| Duplicate test-file names across `__tests__` dirs | none that collide in collection |
| Tests asserting only on mocks with no real behaviour | none found on inspection |

### Timing / clock use (flakiness risk surface)

| File | Pattern | Assessment |
|---|---|---|
| `src/shared/hooks/__tests__/AuthAfk.test.jsx` | `vi.useFakeTimers()` + `vi.advanceTimersByTime()` | **Deterministic** — fake clock, no real time. Correct pattern. |
| `src/features/job-seeker/__tests__/JobDetail.deadline.test.jsx` | `new Date()` | **Safe** — builds the local date string from local components, so no UTC/local skew. Hard-coded far-past/far-future dates for the other cases. |
| `server/src/index.test.js` | `setTimeout(attempt, 10)` retry loop | Low risk — retry loop around a local port bind, not a timing assertion. |
| Everything else | `await waitFor(...)` | **Condition-based**, not sleep-based. Correct pattern. |

**No flaky tests identified.** Four consecutive full runs produced identical counts. The only
residual risk is theoretical: none of the current tests assert on wall-clock duration.

---

## 4. Broken tests found and fixed

Two test-authoring bugs, both in test files only. **No production/source file was modified.**

### 4.1 `src/features/employer/__tests__/EmployerAccreditation.test.jsx` — 6 tests failing

**Symptom:** every test in the file errored in `beforeEach`:

```
TypeError: default.mockReturnValue is not a function
 ❯ EmployerAccreditation.test.jsx:35:13
```

**Root cause:** the `vi.mock` factory for `useAuth` returned a **plain arrow function**, but the
tests call `useAuth.mockReturnValue(...)`. Only a `vi.fn()` exposes `.mockReturnValue`.

**Fix (one line):**
```diff
-  default: () => ({ user: { id: 'employer-1' }, refreshUser: vi.fn() }),
+  default: vi.fn(() => ({ user: { id: 'employer-1' }, refreshUser: vi.fn() })),
```
The `vi.fn()` carries a default implementation, so the per-test overrides in `beforeEach` and the
dedicated refresh test still work, and tests that never override it get a sane default.

**Mutation proof** (temporarily disabled the `refreshUser` call in the component):
```
FAIL EmployerAccreditation > submits the application and refreshes auth context on Begin
Tests  1 failed | 5 passed (6)
```
→ the test really does catch a regression. Component restored afterwards.

### 4.2 `src/features/job-seeker/__tests__/Employment.test.jsx` — 1 test failing

**Symptom:**
```
TestingLibraryElementError: Found multiple elements with the text: Current
```

**Root cause:** `getByText('Current')` matched **two** nodes — the "Current" filter-tile label
*and* the "Current" status badge on the employment record. Same for "Past". The component is
correct; the query was ambiguous.

**Fix:** scope the assertion to each record card, which also makes the assertion *stronger*
(it now proves the right record carries the right badge, not merely that the word exists):
```diff
-    // Two status badges: one Current, one Past.
-    expect(screen.getByText('Current')).toBeInTheDocument()
-    expect(screen.getByText('Past')).toBeInTheDocument()
+    // Each record card carries its own status badge. The filter tiles also
+    // read "Current"/"Past", so scope the query to the record cards.
+    expect(within(screen.getByText('Acme Corp').closest('section')).getByText('Current')).toBeInTheDocument()
+    expect(within(screen.getByText('Beta Foods').closest('section')).getByText('Past')).toBeInTheDocument()
```
plus `within` added to the `@testing-library/react` import.

**Mutation proof** (flipped the badge ternary in the component):
```
FAIL Employment history > renders employment records with their Current/Past status
Tests  1 failed | 4 passed (5)
```

### 4.3 Transient failures — fixed by their owning phases, not by me

Between 17:13 and 17:41 several other test files landed already-red and were **fixed by the
phases that own them** while this audit ran. Recorded here so the pattern is visible:

| File | Symptom | Root cause | Status |
|---|---|---|---|
| `src/features/super-admin/__tests__/Logs.test.jsx` | `Found multiple elements with the text: auth.login` | action name appears in a filter `<option>` and in the table row | Owner scoped to `within(table)`; now passes |
| `src/shared/components/__tests__/ChangePassword.test.jsx` (5 tests) | `getByLabelText(/new password/i)` ambiguous | matches "New password" **and** "Confirm new password" | Owner fixed; now passes |
| `src/shared/components/__tests__/SidebarAccount.test.jsx` | expected the email, component renders the role label | test **name** said "falls back to the role label" but the assertion chased the email | Owner fixed; now passes |
| `src/features/auth/__tests__/ForgotPassword.test.jsx` | blank-email test never reached the handler | see §4.4 | Owner fixed; now passes |
| `server/src/__tests__/*.test.js` (9 files) | collection crash: `Error: supabaseUrl is required` | see §4.4 | Owner fixed; now passes |

### 4.4 Two diagnoses worth keeping (not fixed by me — root cause sat in production/env boundary)

**(a) `server/src/auth.js` creates the Supabase client at MODULE scope.**
```js
export const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
```
Any test that transitively imports it (e.g. via a route module) crashes **at collection time**,
before a single test runs, unless `SUPABASE_URL` is set. I verified this empirically: with the
env present the 9 suites collected and executed; without it they produced
`Test Files 9 failed … Tests no tests … Error: supabaseUrl is required`.
I added test-only dummy env values to `vite.config.js` and `server/vitest.config.js`, then
**reverted that change**: once the owning phase mocked `@supabase/supabase-js` in the test files,
the env vars became redundant (the mocked `createClient` never validates the URL). I re-ran the
experiment to confirm redundancy before reverting. Config files are byte-identical to their
pre-audit state.

> **Recommendation for a later phase:** the correct durable fix is to make `supa` **lazy**
> (create on first use) or to move the client behind a small factory, so a missing env var
> degrades at request time instead of at import time. A shared `server/src/test/env.js` (or a
> `setupFiles` entry) would also remove this foot-gun for every future server test.

**(b) jsdom enforces HTML constraint validation on submit-button clicks.**
A blank-email test using `type="email" required` never reached the component's own trim guard,
because jsdom blocks the submission. Verified with a probe:

| Scenario | Result |
|---|---|
| `type=email required`, value `"   "`, **click** submit | BLOCKED |
| `type=email required`, value `""`, **click** submit | BLOCKED |
| `type=email required`, value `"   "`, `fireEvent.submit(form)` | SUBMITTED |
| `type=text required`, value `"   "`, **click** submit | SUBMITTED |

So the test's comment "Whitespace bypasses the HTML `required` attribute but fails the trim
check" was **false** for `type="email"` — whitespace also trips `typeMismatch`. The reliable way
to unit-test a form's own validation is `fireEvent.submit(form)`. Worth remembering: the
component's trim guard is defence-in-depth, since a real browser blocks empty `required` fields
before the handler runs.

---

## 5. Coverage gaps

Static analysis of the current tree: **100** source files (excluding tests) under `src/` and
`server/src/`, **95** test files, **29** source files with **no test importing them**.

| # | File | Note |
|---|---|---|
| 1 | `server/src/util.js` | `ah()`, `err()`, `audit()`, `notifyUser()`, `notifyAdmins()`, `buildFullName()` — used by **every** route, tested only transitively |
| 2 | `server/src/upload.js` | multer storage, MIME filter, `relPath()` — file-upload trust boundary |
| 3 | `server/src/middleware/rateLimit.js` | `authLimiter`, `uploadLimiter`, `aiLimiter` — abuse protection |
| 4 | `src/App.jsx` | router + lazy route wiring |
| 5 | `src/main.jsx` | bootstrap (low value) |
| 6 | `src/shared/services/audit.js` | `logAudit()` |
| 7 | `src/shared/services/ai.js` | `askHelp()` |
| 8 | `src/shared/utils/names.js` | name formatting |
| 9 | `src/shared/constants.js` | role/tag/benefit catalogues |
| 10 | `src/shared/components/dashboard.jsx` | `PageHeader`, `StatCard`, `SectionCard` — **exercised indirectly** by Employment/Logs tests but never unit-tested |
| 11 | `src/shared/components/TagInput.jsx` | skill/tag entry |
| 12 | `src/shared/components/PortalLayout.jsx` | portal shell |
| 13 | `src/shared/components/LoadingScreen.jsx` | spinner (low value alone) |
| 14 | `src/features/auth/Register.jsx` | role selection |
| 15 | `src/features/auth/AuthCallback.jsx` | Supabase OAuth callback |
| 16 | `src/features/auth/EmployerStatus.jsx` | accreditation status page |
| 17 | `src/features/employer/EmployerLayout.jsx` | portal shell |
| 18 | `src/features/job-seeker/Dashboard.jsx` | seeker dashboard (employer's `Dashboard.jsx` **is** tested) |
| 19 | `src/features/job-seeker/JobSeekerLayout.jsx` | portal shell |
| 20 | `src/features/public-site/Landing.jsx` | public landing page |
| 21 | `src/features/public-site/PortalSelect.jsx` | portal picker |
| 22 | `src/features/public-site/PublicJobs.jsx` | **public job list — a primary user journey** |
| 23 | `src/features/public-site/PublicJobDetail.jsx` | **public job detail + apply — a primary user journey** |
| 24 | `src/features/super-admin/Dashboard.jsx` | admin stats |
| 25 | `src/features/super-admin/JobPosts.jsx` | admin job management |
| 26 | `src/features/super-admin/Employees.jsx` | admin employee list |
| 27 | `src/features/super-admin/Notifications.jsx` | admin notifications (shared `NotificationsPage` **is** tested) |
| 28 | `src/features/super-admin/Profile.jsx` | admin profile |
| 29 | `src/features/super-admin/SuperAdminLayout.jsx` | portal shell |

`src/test/setup.js` also appears in the list; it is test infrastructure, not a gap.

### Suggested priority for closing gaps
1. **`PublicJobs.jsx` / `PublicJobDetail.jsx`** — the only *public*, unauthenticated journeys; no test covers them at all.
2. **`server/src/upload.js`** and **`rateLimit.js`** — trust-boundary and abuse-protection logic.
3. **`server/src/util.js`** — `err()` shapes and `notifyUser/notifyAdmins` fan-out are load-bearing for every route's error contract.
4. Pure helpers first (`names.js`, `audit.js`, `ai.js`) — cheapest to test, no rendering needed.

---

## 6. Recommendations

1. **Do not treat a green `npm test` as final while parallel phases are mid-flight.** During this
   audit the suite flipped green→red→green twice as owning phases landed and repaired tests.
   Re-run immediately before any merge gate.
2. **A green suite is necessary, not sufficient.** Coverage is measured by *behaviour covered*,
   not line count; §5 is the honest gap list.
3. **Adopt the two mocks this repo already got right:** `vi.fn()` in `vi.mock` factories when a
   test needs `.mockReturnValue`, and `within(...)` to scope queries when a string appears in
   more than one role (filter `<option>` vs. data row, stat tile vs. badge).
4. **Use `fireEvent.submit(form)`** to unit-test a form's own validation; jsdom will block a
   submit-button click whenever `required`/`type` constraints fail.
5. **Consider making `supa` lazy** in `server/src/auth.js` so a missing `SUPABASE_URL` fails
   at request time rather than at import time (see §4.4a).

---

## 7. Bottom line

> **The suite is healthy and trustworthy: 95 files / 561 tests, 0 failures, 0 skips, stable
> across repeat runs, and lint-clean.** Two stale test-authoring bugs were fixed at the root
> cause in the test layer — no production code touched, no test deleted or weakened — and both
> fixes were proven by mutation testing. The main residual risk is coverage (§5), not
> correctness.
