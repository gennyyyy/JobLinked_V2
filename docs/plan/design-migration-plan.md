# PESO Design Migration Plan — Next.js design → React JS app

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin `E:\code_ni_hans\peso_project` (Vite + React 19, plain `.jsx`) to the exact frontend design of `E:\code_ni_hans\peso_project-next-upgrade` (Next.js 16 + TS, Tailwind 4, shadcn UI) — pixel-exact look, same tokens/components/spacing — while keeping the JS app's existing behavior, routing, and Express-API data layer intact.

**Architecture:** Port in layers so nothing breaks mid-migration: (1) design foundations (tokens, utilities, fonts, `cn`), (2) UI primitives (shadcn components copied from the Next app and converted TSX→JSX over `@base-ui/react`), (3) layout shells, (4) page surfaces bottom-up from public site → portals, (5) cleanup of the old `--theme-*` system and custom Toast/Modal stack. Styling is data presented by Tailwind 4 `@theme inline`; the JS app's services/auth/routing code is never rewritten.

**Tech Stack:** Vite + React 19 (JSX only, no TypeScript) · Tailwind CSS 4 (vite plugin, already installed) · `@base-ui/react` + `class-variance-authority` · `sonner` (toasts) · `recharts` (dashboard charts, already in design) · `lucide-react` (already installed) · react-router-dom (already installed — replaces Next routing).

**Spec:** This plan is its own spec — the design reference is the Next app at `E:\code_ni_hans\peso_project-next-upgrade`; every source file below is copied/translated from it. Reference = source of truth for pixels; this JS repo = source of truth for behavior.

**Sign-off:** Structure approved by the Lead Architect (session 2026-11-04). Implementation is delegated to the `fullstack-developer` agent using this plan; schema/APIs untouched.

---

## Global Constraints

- **JS/JSX only.** No `.ts`/`.tsx` files may be created. When copying a `.tsx` from the Next app, strip type annotations mechanically; do not redesign signatures.
- **npm only.** No pnpm/yarn lockfile, no `packageManager` field.
- **Design tokens live in `src/index.css`.** Any color/radius/spacing value must come from the token block in Task 1 — no ad-hoc hex values in JSX. Exceptions: the `.dark` block is ported verbatim as dead code (design is light-only); see Cleanup.
- **The design is light-only.** The Next app defines no dark palette. The `ThemeToggle` and `ThemeProvider` from this repo are **retired** (details in Task 10); `next-themes` equivalent is not added.
- **Data layer unchanged.** All fetches go through `src/shared/lib/api.js` and `src/shared/services/` exactly as today. Do NOT port the Next app's `services/`, SWR hooks (`use-demo`, `use-action`), or demo data — only its design.
- **Routing adapter:** Next `Link`/`usePathname`/`useRouter`/`next/navigation` imports translate 1:1 to react-router: `Link` (same), `usePathname()` → `useLocation().pathname`, `router.push(x)` → `navigate(x)`. Accessories like `favicon.ico` metadata are dropped.
- **44px control floor preserved.** The Next app enforces min-height 44px on buttons/inputs/dialogs via `data-slot` rules — these rules ship inside the CSS port and must never be removed.
- **Permission/role guards unchanged.** `ProtectedRoute`, `AuthProvider`, portal role checks keep their current logic; only their render shell changes.
- Every copied primitive keeps its `data-slot` attribute contract; component-level `[data-slot=…]` overrides in `globals.css` are part of the look and must be ported in full into `src/index.css`.

## Review Focus

1. **Auth/session edge** — an expired or unauthenticated session, or a role hitting the wrong portal, must land on a skeleton-then-redirect screen that still uses the new tokens (the PortalShell loading/guard pattern), never a blank page or the old theme. Test: mount PortalShell with a logged-out state and assert skeleton + redirect.
2. **Dialog/sheet a11y** — the old `dialogA11y.test.jsx` must keep passing after `ConfirmationModal`/TermsModal switch to the ported `Dialog`/`AlertDialog`. Test: keep `src/shared/components/__tests__/dialogA11y.test.jsx` green.
3. **Long/dense content** — job lists with many rows, long job descriptions, tables with narrow viewports must scroll/ellipsis like the Next app (`dialog-content` overflow, table sticky header), not break layout. Test: render a 40-row table in the jsdom smoke test.
4. **Empty/error/loading states** — portals with zero jobs, zero applicants, network failure, and page-load must show the ported `Empty`/`Skeleton`/`Alert` components, not raw text. Test: render `<Empty/>` and skeleton grid from the ported primitives.
5. **Form inputs at trust boundaries** — register/login/profile forms validated by old logic must still submit identical payloads; the port only swaps markup/classes. Test: keep each form's existing test passing unchanged (assert on payload shape, not markup).

---

## File Structure (destination map)

```
src/
├── index.css                     ← replaced: Next tokens + utilities + data-slot rules
├── lib/utils.js                  ← NEW: cn() (clsx + tailwind-merge)
├── components/ui/                ← NEW: ported primitives (JSX), ~30 files (Task 2–3)
├── shared/components/            ← shells + design-only components (Task 4)
│   ├── PublicShell.jsx / PortalShell.jsx   (replacing SiteHeader/PublicHeader/PortalLayout skinning)
│   └── Logo.jsx, LinkButton.jsx, EmptyState.jsx
├── features/
│   ├── public-site/  Landing, PublicJobs, PublicJobDetail          (Task 5)
│   ├── auth/         Login, Register*, Forgot/Reset                (Task 6)
│   ├── job-seeker/   Layout, Dashboard, Jobs, JobDetail,
│   │                 Applications, Profile, Employment              (Task 7)
│   ├── employer/     Layout, Dashboard, JobPosts, Applicants,
│   │                 CompanyProfile, Employees, Accreditation       (Task 8)
│   └── super-admin/  Layout, Dashboard, JobPosts, UserManagement,
│                     RoleManagement, Accreditation, Logs,
│                     Notifications, Reports, Settings,
│                     Broadcast, Profile                            (Task 9)
```

Source references (all paths relative to `E:\code_ni_hans\peso_project-next-upgrade`):
`app/globals.css`, `components/ui/*`, `components/layout/{public-shell,portal-shell,demo-switcher}.tsx`, `components/shared.tsx`, `app/(public)/*`, `app/(portals)/*`, `app/page.tsx`, `app/layout.tsx`.

---

### Task 1: Design foundations — tokens, utilities, fonts, `cn`

**Files:**
- Modify: `src/index.css` (rewrite per reference `app/globals.css`)
- Create: `src/lib/utils.js`
- Modify: `index.html`
- Test: `src/test/design-tokens.test.js` (new — cheap smoke guards)

**Interfaces:**
- Consumes: tailwindcss 4 + `@tailwindcss/vite` (already configured).
- Produces: `cn` from `src/lib/utils.js` (`(input) => twMerge(clsx(input))`) — every primitive in Tasks 2–3 imports this exact symbol.

- [ ] **Step 1: Install runtime deps.**

```bash
npm i @base-ui/react@^1.5.0 class-variance-authority clsx tailwind-merge@^3.3.1 sonner@^2.0.8 recharts@^3.8.0 tw-animate-css@^1.4.0
```

(Keep versions in `package.json` from the Next app's `package.json` so component ports behave identically. `deps already present`: react, react-dom, lucide-react.)

- [ ] **Step 2: Write `src/lib/utils.js`.**

Exactly:
```js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (input) => twMerge(clsx(input));
```

- [ ] **Step 3: Replace `src/index.css` with the ported design stylesheet.**

Content = the Next app's `app/globals.css` **minus**: `@import 'shadcn/tailwind.css'` (that package ships the base-ui-compatible Tailwind layer — instead port the block this import provides by pasting the token usage: the `@theme inline` mapping and `:root` block verbatim) — **plus**:
1. Verbatim `:root` tokens: `--background:#fff; --foreground:#0f172a; --card:#fff; --primary:#2563eb; --secondary:#f0f5fc; --muted:#f8fafc; --muted-foreground:#64748b; --accent:#edf4ff; --destructive:#c6413b; --border:#e4eaf1; --navy:#12325b; --teal:#0d9488; --radius:.75rem; --chart-1..5` and soft palette (`teal-soft #eaf8f4`, `blue-soft #edf4ff`, `success #168255`, `warning #a05c0b`, etc.).
2. Verbatim `@layer components` classes: `.page-container`, `.section-heading`, `.eyebrow`, `.section-copy`, `.surface`, `.soft-icon`, `.teal-icon`, `.nav-link`, `.text-link`, `.company-blue/teal/navy/amber`, `.job-grid`, `.portal-grid`, `.form-select`, `.demo-label`, `.timeline-dot`, `.prose-copy`.
3. Verbatim `[data-slot=…]` blocks (buttons/inputs/cards/badges/dialogs/sheets/tables/field-labels).
4. `@font-face` for **Geist Sans** (self-host; file inside `node_modules/geist/dist/fonts/geist-sans` of the Next app — copy `GeistSans-Variable.woff2` into `public/fonts/`) and set `--font-sans` on `:root`.
5. Remove the old `--theme-*` var block and `dark` scheme overrides **except** keep the file's `.dark { … }` block commented as DETACHED (design is light-only; ThemeToggle is retired in Task 10).

- [ ] **Step 4: Add `<link rel="preload" href="/fonts/GeistSans-Variable.woff2" as="font" type="font/woff2" crossorigin>` to `index.html`.**

- [ ] **Step 5: Write the failing test first (add before implementation of Step 3).**

`src/test/design-tokens.test.js` — assert the generated stylesheet contains the tokens (read file, regex):
```js
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("css carries the migrated token contract", () => {
  const css = readFileSync(resolve(__dirname, "../../index.css"), "utf8");
  for (const marker of ["--primary: #2563eb", "--navy: #12325b", ".page-container", ".portal-grid", "data-slot='button'")
    expect(css).toContain(marker);
});
```

Run: `npx vitest run src/test/design-tokens.test.js` → expected FAIL (old css), then after Step 3 → PASS.

- [ ] **Step 6: Run `npm run lint` and `npm test` — all existing tests may still break (components not yet ported); fix only test-environment regressions from CSS (e.g. je-stale classNames referenced in old component tests stay untouched — those are updated in later tasks).** Commit:

```bash
git add src/index.css src/lib/utils.js index.html src/test/design-tokens.test.js package.json package-lock.json public/fonts
git commit -m "Port design tokens and utilities from Next.js design"
```

---

### Task 2: Port UI primitives — batch A (local, no overlay deps)

Copy + convert the following from the Next app `components/ui/` (TSX→JSX: erase types/interfaces, keep everything else byte-equivalent except imports of `cn` → `src/lib/utils.js`; replace `@/` alias with relative paths or add a matching `@` alias in `vite.config.js` — **recommend adding `resolve.alias { "@": path.resolve(__dirname, "src") }` so future copy-paste from the Next app is drop-in**).

**Files (Create, each mapped from Next `components/ui/<name>.tsx`):**
`button.jsx`, `badge.jsx`, `card.jsx`, `avatar.jsx`, `skeleton.jsx`, `spinner.jsx`, `separator.jsx`, `input.jsx`, `textarea.jsx`, `label.jsx`, `checkbox.jsx`, `switch.jsx`, `progress.jsx`, `alert.jsx`, `empty.jsx`.

**Interfaces:**
- Consumes: `cn` (Task 1), `lucide-react`, `@base-ui/react`, `class-variance-authority` where the TSX uses them.
- Produces: same named exports as the TSX files (`Button`, `ButtonVariants`, `Card`, `CardHeader`, `CardTitle`, …). Task 4–9 tasks consume `Button`, `Card*`, `Badge`, `Input`, `Label`, `Skeleton`, `Spinner`, `Empty`.

- [ ] **Step 1: Add `@` alias in `vite.config.js` (jsconfig `paths` too if present).**
- [ ] **Step 2: Copy each file, convert TSX→JSX, fix the `cn` import.**
- [ ] **Step 3: Smoke test `src/components/ui/ui-batch-a.test.jsx`** — render `<Button variant="outline">`, `<Card/>`, `<Skeleton/>`, `<Empty/>` and assert `data-slot` attributes exist (`button`, `card`, `badge`, `skeleton`) and the 44px min-height class renders on `[data-slot=button]`.
- [ ] **Step 4: Run `npx vitest run src/components/ui/ui-batch-a.test.jsx` → PASS. Then `npm run lint`. Commit: `Port shadcn primitives (batch A)`.**

---

### Task 3: Port UI primitives — batch B (overlays, menus, tables, forms via base-ui)

**Files (Create, mapped 1:1 from Next `components/ui/`):**
`dialog.jsx`, `alert-dialog.jsx`, `sheet.jsx`, `dropdown-menu.jsx`, `tooltip.jsx`, `tabs.jsx`, `table.jsx`, `select.jsx`, `field.jsx`, `input-group.jsx`, `toggle.jsx`, `toggle-group.jsx`, `sonner.jsx`.

**Interfaces:**
- Consumes: same as Task 2 + `sonner` (for `sonner.jsx` `<Toaster/>` wrapper).
- Produces: `Dialog`, `DialogContent`, `DialogHeader/Footer/Title/Description`, `AlertDialog*`, `Sheet*`, `DropdownMenu*`, `Tooltip*`, `Tabs*`, `Table*`, `Select*`, `Field*`, `InputGroup*`, `Toaster`.

- [ ] **Step 1: Convert and copy each file exactly as in Task 2 (no behavior redesign).**
- [ ] **Step 2: Mount `<Toaster/>` once inside `src/shared/context/AppProvider` (or `App.jsx`) along with `position="top-center"` as chosen by the source's own mount config.**
- [ ] **Step 3: Smoke test `src/components/ui/ui-batch-b.test.jsx`**: render `<Table/>` with rows; render `Tabs`; `dropdown` open/mouseless keyboard reachability claim verified in old `dialogA11y.test.jsx` stays running. Also assert `dialog-content` CSS overflow block still present in `src/index.css` (already, but pin it).
- [ ] **Step 4: Run `npx vitest run src/components/ui/ui-batch-b.test.jsx` → PASS. Commit: `Port shadcn primitives (batch B)`.**

---

### Task 4: Layout shells + shared design components

Replace the current skin of `SiteHeader`, `PublicHeader`, `PublicFooter`, `SiteFooter`, `PortalLayout`, `TopNavLayout`, `AccountMenu`, `NotificationBell`, `SidebarAccount`, `SeekerProfileCard`, `SearchBar` / while preserving each component's API and behavior (props, dialogs, navigation logic unchanged).

**Files:**
- Create: `src/shared/components/PublicShell.jsx` (from `components/layout/public-shell.tsx`), `src/shared/components/PortalShell.jsx` (from `components/layout/portal-shell.tsx`), `src/shared/components/design/Logo.jsx`, `LinkButton.jsx`, `EmptyState.jsx` (from `components/shared.tsx`).
- Modify: `src/features/{job-seeker,employer,super-admin}/…Layout.jsx` to render `PortalShell role="jobseeker|employer|superadmin"`.
- Keep intact: `AuthProvider`, `ProtectedRoute`, `SkipLink`, `ErrorBoundary`, `LoadingScreen` (retire in Task 10 only if superseded).

**Interfaces:**
- Consumes: primitives (Tasks 2–3), `cn`, `useLocation()` (replaces `usePathname`), existing `useAuth`/services for profile data (replacing the Next app's `useDemo` demo hook); `PORTAL_NAV` equivalent must be built from the existing constants (`src/shared/constants.js`) not the Next app's.
- Produces: `PortalShell({ role, children })`, `PublicShell({ children })` — Tasks 5–9 wrap every page in these.

- [ ] **Step 1: Port `Logo`, `LinkButton`, `EmptyState` → `src/shared/components/design/*.jsx` (re-export them from `src/shared/components/index` if the app has a barrel; otherwise direct imports).**
- [ ] **Step 2: Port `PublicShell`** — nav items sourced from existing public routes; keep working attribute targets `id="main-content"` matching `SkipLink`.
- [ ] **Step 3: Port `PortalShell`** — collapsible sidebar, mobile `Sheet` nav, header search `Dialog`, `AccountMenu` dropdown, notification bell. Replace demo-profile wiring with real auth/profile state from `useAuth` and `services/` (employer name/logo); replace Next `useDemo`'s `ready` gating with this app's own loading/protected-route state (render the same skeleton layout while state is resolving).
- [ ] **Step 4: Wrap `JobSeekerLayout`/`EmployerLayout`/`SuperAdminLayout` to render inside `PortalShell`; delete old chrome components from the render tree (not the files yet).**
- [ ] **Step 5: Tests** — update `PortalLayout.test.jsx`, `PublicChrome.test.jsx`, `AccountMenu.test.jsx` (or replace with `PublicShell.test.jsx`/`PortalShell.test.jsx` equivalents asserting: nav renders, guard redirects to login when unauthenticated, skeleton on pending auth, mobile sheet opens). Run full `npm test`; fix regressions that are *render* breakage only.
- [ ] **Step 6: Run `npm run lint`. Commit: `Switch portals to design shells`.**

---

### Task 5: Public site pages

**Files (Modify, skins swapped to ported design):**
- `src/features/public-site/Landing.jsx` ← `app/page.tsx` + `components/home/*`
- `src/features/public-site/PublicJobs.jsx` ← `app/(public)/jobs/*` + `components/jobs/*`
- `src/features/public-site/PublicJobDetail.jsx` ← `app/(public)/jobs/[slug]/*`, `app/(public)/[slug]/*` static pages
- `src/shared/components/BrowseJobs.jsx`, `SearchBar.jsx` ← restyle with `.job-grid`, `Card`, `Badge`, ported `Input`/`Select`.

**Interfaces:** Consumes `PublicShell`, primitives, `.job-grid`/`.page-container`/`.section-heading` classes. Produces: navigations into `/login`, `/signup`, portal routes — link paths must be this app's react-router paths, not Next's.

- [ ] **Step 1: Restyle `Landing` section by section against `app/page.tsx` (`hero`, `eyebrow` sections, testimonials/logos band, CTA), using `.eyebrow`, `.section-heading`, `.surface`, `.text-link`, `.demo-label`.**
- [ ] **Step 2: Restyle `PublicJobs` (filter row, grid of job cards) and `PublicJobDetail` (info card + apply CTA via existing modal logic).**
- [ ] **Step 3: Verify `BrowseJobs.test.jsx`, `PublicChrome` landing tests still pass; add `public-site design smoke` assertions if cheap. `npm test` + `npm run lint`. Commit: `Apply design to public site`.**

---

### Task 6: Auth pages

**Files:** `src/features/auth/{Login,Register,EmployerRegister,JobSeekerRegister,ForgotPassword,ResetPassword,AcceptInvite,AuthCallback,EmployerStatus}.jsx`

**Constraints:** payloads/validation/supabase flow unchanged — markup + classes only, built from `Card`, `Field`, `Input`, `Checkbox`, `Button`, `Alert`; wrap in `PublicShell` (the Next login layout is the centered-card public layout).

- [ ] **Step 1: Restyle each form surface; centered card under `PublicShell` (`class="mx-auto w-full max-w-md"` interiors are spelled out in the Next `login/page.tsx`).**
- [ ] **Step 2: Replace any custom alert/banner with `Alert` tones (`success-soft`, `danger-soft`).**
- [ ] **Step 3: Verify each form's existing test passes unchanged (Review Focus #5). `npm test` + `npm run lint`. Commit: `Apply design to auth pages`.**

---

### Task 7: Job seeker portal

**Files (Modify):** `JobSeekerLayout.jsx` (Task 4 already wired), `Dashboard.jsx`, `Jobs.jsx`, `JobDetail.jsx`, `Applications.jsx`, `Profile.jsx`, `Employment.jsx`, `AiMatchModal.jsx`, `HelpChat.jsx`.

- [ ] **Step 1: Dashboard** — 4 status summary cards from `app/(portals)/jobseeker/page.tsx` (`Card`, `Badge`, `.portal-grid`), recommended-jobs list, notifications feed. Data still via existing `services/` (`listBySeeker` etc.).
- [ ] **Step 2: Jobs/JobDetail** — `.job-grid` cards, `Sheet` or `Dialog` for details matching source layout, sticky filter bar.
- [ ] **Step 3: Profile** — sectioned cards for contact/address/education/skills with `Field`/`Input`/`TagInput` restyled; progress ring via `Progress`.
- [ ] **Step 4: Applications & Employment** — status timeline (`.timeline-dot`), `Table` or card list per source.
- [ ] **Step 5: `AiMatchModal`/`HelpChat`** — swap the modal for the ported `Dialog`, keep all logic.
- [ ] **Step 6: Update/replace tests, `npm test`, `npm run lint`. Commit: `Apply design to job seeker portal`.**

---

### Task 8: Employer portal

**Files (Modify):** `EmployerLayout.jsx`, `Dashboard.jsx`, `JobPosts.jsx`, `Applicants.jsx`, `CompanyProfile.jsx`, `Employees.jsx`, `EmployerAccreditation.jsx`.

Same pattern as Task 7 but the authority is `app/(portals)/employer/*` (+ `components/employer/*`). Special attention: tables (`Table`, `TableHead/Row/Cell` with `data-slot` styling), row action `DropdownMenu`, applicant status `Badge` tones (`success/warning/danger-soft`), post-a-job form (`Field`+`Input`+`Select`+dialog, form modal), accreditation upload+status card. Keep every feature flag/behavior from `plan.md` (duplicate job, reopen job) exactly as it works today.

- [ ] **Step 1–4: Restyle surfaces in this order: Dashboard → JobPosts → Applicants → remaining pages.**
- [ ] **Step 5: Update `__tests__` for these files, run `npm test` + `npm run lint`. Commit: `Apply design to employer portal`.**

---

### Task 9: Super admin portal

**Files (Modify):** `SuperAdminLayout.jsx`, `Dashboard.jsx`, `Reports.jsx`, `JobPosts.jsx`, `UserManagement.jsx`, `RoleManagement.jsx`, `Accreditation.jsx`, `Logs.jsx`, `Notifications.jsx`, `Settings.jsx`, `Broadcast.jsx`, `Profile.jsx`.

Charts: install and use the ported `chart.jsx` from the Next app (`components/ui/chart.tsx` → `chart.jsx`) so `Chart*` containers + `recharts` match the Next dashboards.

- [ ] **Step 1: Port `chart.jsx` and restyle `Reports` with `ChartContainer`/`ChartTooltip`; export CSV/PDF behaviors (`window.print`, client CSV) unchanged.**
- [ ] **Step 2: Restyle `Dashboard` KPI cards/charts against `app/(portals)/admin/*`.**
- [ ] **Step 3: Restyle management screens (data tables, role cards, logs feed, broadcast composer).**
- [ ] **Step 4: Tests + `npm run lint`. Commit: `Apply design to super admin portal`.**

---

### Task 10: Cleanup + full verification

**Files:**
- Delete: `src/shared/components/{Toast.jsx, ConfirmationModal.jsx, ThemeToggle.jsx}` after confirming zero imports; remove `ThemeProvider.jsx` + `next-themes`-equivalent from provider tree (design is light-only); delete `SidebarAccount.jsx`/`TopNavLayout.jsx` if Task 4 replaced their callers.
- Purge: remaining `--theme-*` var usage and dark-scheme tokens from `src/index.css` (keep only the designed light palette + the dark map *only if* a component still references it — otherwise delete).
- Keep: nothing from the Next app's demo data.

- [ ] **Step 1: `grep -r "theme-text\|theme-action\|ThemeToggle\|Toast\b" src/` → fix stragglers or delete dead files.**
- [ ] **Step 2: Full gates:** `npm run lint` → `npm test` → `npm run build` → `npm run dev` and click through: landing → login → seeker portal → employer portal → admin; compare against the Next app running side-by-side (`npm --prefix ../peso_project-next-upgrade dev` on port 3000). Screenshot each portal at 1440px + 390px wide.
- [ ] **Step 3: Commit: `Remove legacy theme and retire old chrome components`.**

---

## Dependency order

```
Task 1 → Task 2 → Task 3 → Task 4 → (Task 5 → Task 6 → Task 7 → Task 8 → Task 9 in any order) → Task 10
```

Tasks 5–9 can run in parallel after Task 4, but the shells they mount (`PortalShell`/`PublicShell`) must be complete first. Task 10 is terminal and sequential.

## Explicit non-goals (rejected — YAGNI)

- **No routing migration to App-Router-style file routes** — the react-router structure stays.
- **No SWR/demo-data port** — use-demo/use-action/demo JSON never leave the Next app.
- **No dark-mode port** — the source design ships no dark palette; a dark pass is a separate future request.
- **No TypeScript** — plan converts copies with types erased; staying JS per the target AGENTS.md.
- **New dependencies accepted as material tradeoff:** `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`, `recharts`, `tw-animate-css` — each is already installed in the design source and is what makes a byte-level design copy work; hand-rolling them would fork the design contract.
