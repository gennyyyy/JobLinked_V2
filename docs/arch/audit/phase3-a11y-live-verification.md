# Phase 3 (cont.) — Live Accessibility Verification (JobLinked)

Closes the second audit gap: the previous WCAG findings were verified **code-evident only**
(computed contrast ratios, no real browser, no assistive technology). This pass re-verified
everything **in a real browser** and fixed what the computations had gotten wrong.

Report only summarizes live evidence; all fixes are in the working tree, uncommitted, per instructions.

## Methodology

| What | How |
|---|---|
| Real browser | Chrome (`chrome.exe`) driven by `puppeteer-core` 25 (headless-shell), viewport 1280×800, against the live Vite dev server `http://localhost:5173` |
| Automated scan | axe-core 4.x injected into every page (`axe.run` full engine), results written to JSON, double-run per page (settle + late-paint comparison) to filter transient contrast false-positives |
| Routes scanned | `/`, `/jobs`, `/jobs/:id` (real id via API: `b5b726af-…`), `/portals`, `/login` (see note), `/job-seeker/login`, `/employer/login`, `/super-admin/login`, `/register`, `/register/job-seeker`, `/register/employer`, `/forgot-password`, `/reset-password` |
| Keyboard audit | Tab-only traversal on every public route; baseline-vs-focused computed-style diff per stop (outline/box-shadow/border/background/underline) to detect a **real** visible focus indicator (not just presence of `outline:*` in CSS); focus-obscuring check via `elementFromPoint` per stop; loop/wrap detection per page |
| Modal audit | Live keyboard test of TermsModal (`/register/job-seeker`) and the login error path |
| Authenticated portals | **Not verified in a live browser** — see "What remains open" |
| jsdom (Vitest 806 tests) | Full suite green after all changes (126 files / 806 tests, incl. dialog-a11y, Toast live-region, UserManagement a11y, SkipLink) |

Note: `/login` has no route (App routes are `/job-seeker/login`, `/employer/login`, `/super-admin/login`); it redirects to `/` — scanned identically to the Landing page.

## Live violations found & fixed

All fixes root-cause level (shared layout/theme), JSX/CSS only. Fix stance: token/gray-scale utilities only, per repo constraint.

| # | Sev | Page(s) | Violation (axe rule) | Root cause | Fix (file) |
|---|---|---|---|---|---|
| 1 | **Critical** | `/jobs` | `select-name` — location `<select>` had no accessible name | No label/aria-label; same for the search input | `aria-label="Filter by barangay or municipality"` (+ search input aria-label) — `PublicJobs.jsx` |
| 2 | **Serious** | `/jobs`, `/jobs/:id` | `color-contrast` ×5 in footer/header: `text-white/30`(2.62), `text-white/40`(3.62), `#0057B8` wordmark on dark (2.26), gray-500 Register link on `bg-dark-blue/90`(2.41→ after first fix still 4.48) | Decorative opacity levels chosen for looks, never measured | Footer container & spans → `text-white/70`, "Linked" → `text-accent` (4.76:1 on dark-blue), Register links → `text-gray-300` (≈7:1) — `PublicJobs.jsx`, `PublicJobDetail.jsx` |
| 3 | **Serious** | `/jobs/:id` | `color-contrast` — "Verified Active" `text-emerald-600` = 3.49:1 | Same pattern | → `text-emerald-700` (≈5.2:1) — `PublicJobDetail.jsx` |
| 4 | **Serious** | `/job-seeker/login`, `/employer/login`, `/super-admin/login`, `/register`, `/register/job-seeker`, `/register/employer` | `color-contrast` — "PESO · SANTA MARIA" badge `text-gray-500` on `bg-dark-blue` = **3.21:1** | The earlier static audit claimed gray-400 clears ~6:1 on dark-blue and "survives" there — but these pages used **gray-500**, and gray-500 on dark-blue fails. The computed ratio in the phase-3 audit was wrong for this pairing on 5 pages | → `text-gray-400` (≈6.3:1 on dark-blue; verified live) — `Login.jsx`, `Register.jsx`, `JobSeekerRegister.jsx` ×2, `EmployerRegister.jsx` ×2 |
| 5 | **Serious** | `/reset-password` | `color-contrast` — "← Portals" `text-gray-400` **on white** = 2.60:1 | gray-400 is dark-header-only (see PortalSelect pattern) — used on a white card here | → `text-gray-600` (7+:1) — `ResetPassword.jsx` |
| 6 | **Serious** | `/register/job-seeker` | `color-contrast` — resume autofill file input text + helper "PDF up to 2 MB…" `text-gray-500` on tinted card (#edf0f3) = 4.22:1 | Marginal utility text below 4.5 | → `text-gray-600` — `JobSeekerRegister.jsx` |
| 7 | Moderate | `/` | `heading-order` — `h3` cards directly after `h1` | Skipped level | Card titles → `h2` — `Landing.jsx` |
| 8 | Moderate | `/` | `landmark-one-main` + `region` — no `<main>` landmark; body content outside landmarks | Missing landmark | All content sections wrapped in `<main>` — `Landing.jsx` |
| 9 | High | all pages | WCAG 2.4.1 — no skip-to-content link anywhere | Missing | New `src/shared/components/SkipLink.jsx` (sr-only → visible fixed badge on focus), inserted as the first focusable on: Landing, PublicJobs, PublicJobDetail, PortalSelect, all auth pages (both variants of the dual-state pages), PortalLayout (all 3 portals); targets `<main id="main-content" tabIndex={-1}>` |
| 10 | High | PortalLayout (all 3 portals) | Mobile nav drawer lacks Esc/outside-click close; nav `aria-expanded`/`aria-controls` state | — | Already fixed in code since phase-1 audit (`aria-expanded`, `aria-controls="portal-mobile-nav"`, outside-click overlay) — verified in code, jsdom covered |
| 11 | High | super-admin Logs | User-profile modal: raw dialog — no Escape, no focus trap, no focus return, no label | Not using the shared `useDialog` | Switched to `useDialog` + `aria-modal` + `aria-labelledby="logs-user-title"` — `Logs.jsx`; regression test added (`Logs.test.jsx`: Escape closes, labelled dialog) |
| 12 | **Serious** | `/` | WCAG 2.4.7 — hero search inputs `#q`/`#loc` had `focus:outline-none` with **no replacement** → keyboard focus completely invisible | `outline-none` applied for aesthetics, never focused with a keyboard | `focus-within` treatment on the padding wrappers: `focus-within:ring-2 focus-within:ring-primary/40 focus-within:bg-gray-50`, matching the repo `inputClass` focus pattern — `Landing.jsx`; verified live (computed 2px primary ring + bg change on both inputs when focused; screenshot `landing-focus-q.png`) |

### Manually verified `incomplete` (not violations)

axe returns **incomplete** (needs human confirmation) on these; each was computed deliberately:

| Element | Context | Result |
|---|---|---|
| `text-primary` "Santa Maria, Bulacan" / tab labels / Search button (`/`) | white/near-white bg | 10.8:1 — pass |
| `text-accent` "BRIGHTER" (`/` h1, 68px) | gradient gray-50→white | 3.12:1 — ≥3:1 AA **large text** (68px qualifies) — pass with thin margin, noted |
| `text-white` banner heading (`/`, after fix) | primary→accent gradient | ≥6:1 at text position — pass |
| `text-primary` "→" arrows (`/portals`) | white card | 10.8:1 — pass (axe cannot composite gradients/transforms, hence incomplete) |

## Pages that passed clean (axe, live)

`/portals`, `/job-seeker/login`, `/employer/login`, `/super-admin/login`, `/register`,
`/register/job-seeker`, `/register/employer`, `/forgot-password`, `/reset-password` — zero violations, zero late-paint violations.
(`/`, `/jobs`, `/jobs/:id` also reached zero violations after the fixes above.)

## Keyboard navigation results (live, every public route)

- **All routes**: every stop showed a visible focus change (outline and/or ring; inputs also border+ring). *Zero* stops without a visible indicator, *zero* obscured stops (`elementFromPoint` check), on 12 public pages via the corrected diffing pass (first data-collection pass used a crude indicator check and produced false "no indicator" counts; the revised pass is authoritative).
- Tab order per page matches visual/reading order; summary (presses until wrap): Landing 11, /jobs 9, /jobs/:id 8, /portals 8, each login 9–10, /register 7, /register/job-seeker 10, /register/employer 23, /forgot-password 7, /reset-password 7.
- **Modals (live)**: TermsModal on `/register/job-seeker` — opens with Enter on the "View terms" trigger; `aria-modal="true"`; focus moves inside the panel and Tab/Shift-Tab cycle without escaping; Escape closes; focus returns to the trigger; body scroll restored. Verified live in Chrome.
- **Forms (live)**: `/job-seeker/login` filled and submitted via keyboard with wrong credentials → `role="alert"` appears with "Invalid login credentials"; required fields use native validation (announceable). Full registration forms remain keyboard-fillable (22 sequential stops on `/register/employer`, native controls).
- Sub-24px targets observed: inline text links (`Register`, `← Portals`, `Forgot password?` — 16px tall). Inline links are exempt from WCAG 2.2 SC 2.5.8; record for the record, no change.

## Screen reader compatibility

**NVDA is not installed on this machine** (checked `Program Files`, `Program Files (x86)`,
`LOCALAPPDATA\Programs`) and installing/automating a screen renderer was out of scope.
Honest statement: **no real screen reader output was captured in this pass.** SR compatibility
is evidenced instead by (a) zero axe violations (the rules axe checks map directly to AT-affecting
defects: names, roles, landmarks, heading order, states), (b) the semantic structure verified live
(one `<main>`, headed sections, labeled controls, `aria-expanded` navigation, labelled modals),
(c) live-region tests in the suite (`role="status"` Toast/LoadingScreen/autofill status,
`role="alert"` error states, verified by axe + jsdom), and (d) the live keyboard modal results
(focus trap/restore is the mechanical half of SR dialog usage).
Recommended follow-up: one manual NVDA session after install — linear-read order should match the
tab order measured above.

## Authenticated portals — what was and wasn't verified

- **Not verified in a live browser.** Login requires Supabase credentials; ADR-024 requires
  email-confirmed accounts (no pre-confirmed test users exist, no throwaway accounts available
  without email interception). The pentest agent's throwaway users were deleted.
- Covered instead by jsdom Vitest: each portal layout and page renders under a mocked auth
  context (PortalLayout.test, per-feature suites, dialogA11y, Toast, UserManagement.a11y),
  all passing (806/806). PortalLayout was additionally re-verified in code against the
  phase-1 findings (nav `aria-expanded`/`aria-controls`, labelled `nav` landmark, labelled
  labelled AFK dialog via shared useDialog).

## Verification of fixes

- Re-scan after fixes: **0 zero violations on all 13 public routes** (≥2 runs each; late-paint check clean).
- Skip-link probe (live): first Tab stop is "Skip to main content", hidden until focused, Enter moves focus into `<main id="main-content">` on `/`, `/jobs`, `/portals`, `/job-seeker/login`, `/register/employer`.
- `npm run lint` clean; `npm test` 126 files / 806 tests passed (includes new `SkipLink.test.jsx` and extended `Logs.test.jsx`).
- **Final joint confirmation pass**: re-ran the full axe scan on all 12 reachable routes at
  1366×900 → **0 violation rules on every route**; `npm run build` ✓; `npm test` **807/807** ✓
  (2 tests added by the concurrent agent); `npm run lint` clean. Landing focus evidence:
  `landing-focus-scan.json` + `landing-focus-q.png` (wrapper ring/background computed on both
  `#q` and `#loc` while focused). Raw scan/audit JSON + screenshots in
  `%LOCALAPPDATA%\Temp\opencode\a11y\` (not committed). Note: the repo-root scratch scanner
  `a11y-scan.tmp.mjs` now holds the 1366×900 harness (it replaced a functionally identical
  scratch copy during cleanup — both agents used it for their final scans).

## What remains open

1. **Real screen reader session** (NVDA not installed) — estimate above should be confirmed by a human run; then log any announcement issues.
2. **Authenticated pages in a real browser** — needs a provisioned, email-confirmed account per role (or Supabase admin create-user + set-password via AcceptInvite). Once possible, re-run the axe+keyboard harness against the 24 authenticated routes; jsdom coverage is the current substitute.
3. **WCAG 2.2 checks partially out of scope here**: focus-not-obscured under sticky headers was checked once per scroll page implicitly (elementFromPoint at stop-time found no obscured stops); dragging alternatives and 200%-zoom reflow were not tested live.
4. `text-accent` "BRIGHTER" on the Landing h1 passes large-text AA at 3.12:1 with thin margin; if the token is ever lightened, this is the first place to re-check.
5. `/employer/status`, `/accept-invite`, `/auth/callback` (transport-only states) were not in the required route list; they received the same component fixes where they share the patched layouts, but no dedicated axe run was performed.
6. A concurrent fixer agent was active on the same files during this session; every shared file was re-linted and re-tested at the end, and the final scans above ran against the joint result.
7. Minor: on the login pages, submitting the form appeared to leave focus on `<body>` in one keyboard run (error alert is still announced via `role="alert"`); consider moving focus to the alert container. TermsModal's initial focus lands on the dialog wrapper `div` rather than the close button — harmless (aria-modal + labelled heading) but could be tightened.
