# ADR-030 — Shared header/footer for job-seeker & employer portals; drop sidebar [ACCEPTED 2026-10-18]

## Context
Job-seeker and employer portals currently render through `PortalLayout`, which
puts navigation in a left sidebar (desktop) + hamburger drawer (mobile) and uses
a tiny `h-6` footer placeholder. The public landing page (`Landing.jsx`) has a
sticky header + full footer that is the site's shared chrome. The two portal roles
should reuse that chrome instead of the sidebar; **super-admin keeps `PortalLayout`**
(its dense nav + sidebar is intentional).

## Decision
1. **Extract shared chrome** from `Landing.jsx`:
   - `src/shared/components/SiteHeader.jsx` — sticky white header (logo + text logo).
     Accepts `center` (portal nav) and `right` (actions) slots; public pages pass
     the "How It Works / LOG IN / SIGN UP" actions, portals pass their nav + bell +
     user menu.
   - `src/shared/components/SiteFooter.jsx` — the landing footer, unchanged content.
2. **New layout** `src/shared/components/TopNavLayout.jsx` for job-seeker & employer:
   - `SiteHeader` (with horizontal nav links + NotificationBell + user menu with
     profile/logout) → main content (`Outlet`, `p-[5%]`, scroll) → `SiteFooter`.
   - No sidebar, no mobile drawer. Horizontal nav wraps on small screens.
   - Retain AFK timer + warning dialog and the accreditation banner (employer).
3. **`EmployerLayout` / `JobSeekerLayout`** switch from `PortalLayout` to
   `TopNavLayout`, passing their existing `navItems` and user info.
4. `PortalLayout` stays for super-admin only; do not delete it (still imported by
   `SuperAdminLayout`).

## Consequences
- Portal pages gain the site footer and consistent header; sidebar removed for two
  roles only.
- `SidebarAccount` logic (profile link + logout) moves into the header user menu.
- Super-admin unaffected; no DB/schema changes.
- Landing.jsx shrinks (header/footer become imports) — verify no class drift.

## Hand-off
Implementation: frontend-developer. Tests: tester (layout smoke + a11y). Review: review.