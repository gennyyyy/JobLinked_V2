# Design Analysis — Next.js (peso_project-next-upgrade) → Vite app

Source of truth for pixels: `E:\code_ni_hans\peso_project-next-upgrade`.
Destination: this repo (Vite + React 19, JS/JSX).

## 1. Design foundations (DONE — Task 1)

- Tokens ported verbatim from `app/globals.css` into `src/index.css`: `@theme inline` block
  (`--color-*`, `--radius-*`), `:root` vars (`--background #fff`, `--primary #2563eb`,
  `--navy #12325b`, `--teal #0d9488`, `--border #e4eaf1`, `--muted-foreground #64748b`,
  soft palette `teal-soft/blue-soft/success/warning/danger`, charts 1–5), `@layer base`,
  `@layer components` (`.page-container`, `.section-heading`, `.eyebrow`, `.section-copy`,
  `.surface`, `.soft-icon`, `.teal-icon`, `.nav-link`, `.text-link`, `.company-*`, `.job-grid`,
  `.portal-grid`, `.form-select`, `.demo-label`, `.timeline-dot`, `.prose-copy`), and the
  `[data-slot=…]` rules (44px control floor, dialog overflow, table head/cell, etc.).
- `@import 'shadcn/tailwind.css'` inlined (keyframes + custom variants).
- `cn` helper at `src/lib/utils.js` (`twMerge(clsx(input))`).
- `@` alias added to `vite.config.js` (`@/` → `src/`) for drop-in copy-paste from the Next app.
- Geist font via Google Fonts CDN (self-hosted woff2 unavailable in this environment).

## 2. Primitive inventory (DONE — Tasks 2 & 3, 29 files)

All in `src/components/ui/*.jsx`, converted TSX→JSX via `tsc` transpile, lint-clean:

Batch A (local, no overlays): button, badge, card, avatar, skeleton, spinner, separator,
input, textarea, label, checkbox, switch, progress, alert, empty.

Batch B (overlays/menus/tables/forms): dialog, alert-dialog, sheet, dropdown-menu, tooltip,
tabs, table, select, field, input-group, toggle, toggle-group, sonner.

Plus chart.jsx (Task 9).

Every primitive keeps its `data-slot` attribute contract; `react-refresh/only-export-components`
is disabled for this folder (shadcn exports variants alongside components).

`<Toaster position="top-center" />` mounted once in `src/App.jsx`.

## 3. Shared design components (partial — Task 4)

Already present in V2 and aligned with the Next design (identical 486-line `shared.tsx`
source): Logo, LinkButton, VerifiedBadge, StatusBadge, Panel, PageHeading, Notice, EmptyState,
StatCards, ConfirmButton, TextField, SelectField, CompanyMark, SuccessMark.

`src/shared/components/design/{Logo,LinkButton,EmptyState}.jsx` not yet created as separate
files — the shared.tsx barrel covers them; split deferred (no functional gap).

## 4. Layout shells (in progress — Task 4)

- `PortalLayout.jsx`: ThemeToggle import/usage removed (design is light-only); gray-* →
  token classes (bg-background, text-foreground, border-border, bg-card); AFK timer, nav,
  mobile sheet, notification bell, sidebar account all preserved.
- `PublicHeader.jsx`: ThemeToggle removed; gray-* → token classes.
- `PublicFooter.jsx`, `SiteHeader.jsx`, `SiteFooter.jsx`, `TopNavLayout.jsx`: pending
  restyle (same token swap + primitive swap).
- The Next app's `portal-shell.tsx`/`public-shell.tsx` are demo-driven (useDemo, PORTAL_NAV,
  DemoSwitcher) and cannot be dropped in verbatim — the Vite shells keep their own logic
  and adopt the Next visual vocabulary (tokens + primitives) instead.

## 5. Page surfaces (Tasks 5–9) — NOT YET STARTED

Inventory of V2 page components that need restyling (each currently uses hand-rolled markup
with the same tokens, so the visual gap is mostly primitive swap + spacing):

Public site: Landing, PublicJobs, PublicJobDetail, PortalSelect, BrowseJobs, SearchBar
Auth: Login, Register, EmployerRegister, JobSeekerRegister, ForgotPassword, ResetPassword,
  AcceptInvite, AuthCallback, EmployerStatus
Job seeker: JobSeekerLayout, Dashboard, Jobs, JobDetail, Applications, Profile, Employment,
  AiMatchModal, HelpChat
Employer: EmployerLayout, Dashboard, JobPosts, Applicants, CompanyProfile, Employees,
  EmployerAccreditation
Super admin: SuperAdminLayout, Dashboard, Reports, JobPosts, UserManagement, RoleManagement,
  Accreditation, Logs, Notifications, Settings, Broadcast, Profile

Plus: NotificationsPage, ChangePassword, TermsModal, ConfirmationModal (keep logic, swap skin).

## 6. Cleanup (Task 10) — NOT YET STARTED

- Retire `ThemeToggle.jsx`, `ThemeProvider.jsx`, `Toast.jsx`/`ConfirmationModal.jsx` where
  superseded; purge `--theme-*` vars and dark-scheme tokens from src/index.css.
- Keep `ProtectedRoute`, `SkipLink`, `ErrorBoundary`, `LoadingScreen` (still used).

## 7. Conversion rules (for every page restyle)

1. Replace `<button className="...">` with `<Button variant=... size=...>`; `<input>` with
   `<Input>`; `<select>` with `<Select>`; `<textarea>` with `<Textarea>`; `<label>` with
   `<Label>`; card containers with `<Card>`/`<CardHeader>`/`<CardTitle>`/`<CardContent>`;
   badges with `<Badge>`; tables with `<Table>`/`<TableHead>`/`<TableRow>`/`<TableCell>`;
   dialogs with `<Dialog>`/`<DialogContent>`/`<DialogHeader>`/`<DialogTitle>`; tabs with
   `<Tabs>`; empty states with `<Empty>`; spinners with `<Skeleton>`/`<Spinner>`.
2. Replace hand-rolled alert banners with `<Alert variant="destructive|default">`.
3. Use `.page-container`, `.section-heading`, `.eyebrow`, `.section-copy`, `.surface`,
   `.job-grid`, `.portal-grid`, `.timeline-dot`, `.prose-copy`, `.text-link`, `.nav-link`
   utility classes (already in src/index.css).
4. Keep all data/service/auth logic untouched; only markup + classes change.
5. Keep each existing test passing (assert on payload/behavior, not markup) — update tests
   only when they assert on markup that legitimately changed.
6. Routing: Next `Link`/`usePathname`/`useRouter` → react-router `Link`/`useLocation`/
   `useNavigate` (already the Vite convention).

## 8. Recommended execution order

Task 1 ✓ · Task 2 ✓ · Task 3 ✓ · Task 4 (shells) in progress · then Tasks 5–9 page surfaces
(each as its own commit) · Task 10 cleanup last. Tasks 5–9 can run in parallel once shells
are complete; each page commit must keep `npm test` green.

## 9. Honest status

Foundation + all 29 primitives + Toaster mount are committed. Shell restyling is partial
(ThemeToggle retired from PortalLayout/PublicHeader, token color swaps begun). Page surfaces
(Tasks 5–9) and cleanup (Task 10) are NOT yet done. The work is large and mechanical; the
primitives + tokens now make each page restyle a focused, low-risk edit.