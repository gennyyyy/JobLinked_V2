# Phase 3 — UX Consistency Audit (layout & patterns)

Scope: 10 files in `employer`, `job-seeker`, `super-admin`, `shared`. Accessibility excluded (separate pass).
Reference implementation for good practice in this scope: **`employer/JobPosts.jsx`** (feedback + confirmation) and **`shared/components/dashboard.jsx`** (visual blocks).

## Findings

| file:line | issue | sev | fix |
|---|---|---|---|
| `super-admin/SuperAdminLayout.jsx:18` | `homeTo` defaults to `/` → admin logo exits the portal; job-seeker passes `/job-seeker` | med | Pass `homeTo="/super-admin"` and `/employer` explicitly, or make the default portal-relative |
| `employer/EmployerLayout.jsx:77` | eyebrow `"SANTA MARIA, BULACAN"` omits `PESO ·` prefix used by the other two portals | low | Use `PESO · SANTA MARIA, BULACAN` everywhere |
| `employer/JobPosts.jsx:469-495` | page header has no dark-blue panel — only page in scope with a light-bg header | med | Use `PageHeader` (consistent with all 3 dashboards + `Jobs.jsx`) |
| `job-seeker/Jobs.jsx:144-154` | hand-rolled dark-blue header duplicating `PageHeader` (and carries dead `justify-between`/`md:flex-row` for one child) | low | Replace with `<PageHeader eyebrow title subtitle>` |
| `employer/JobPosts.jsx:551-555` | metric counter hand-rolls `StatCard` (different border, no icon, smaller label) and declares `xl:grid-cols-5` for **one** card | low | Use `<StatCard>`; drop the unused `xl:` breakpoint |
| `employer/JobPosts.jsx:558` | `p-5 md:p-5` — no-op responsive class | low | `p-5` |
| `employer/JobPosts.jsx:209-217` (`Jobs`) | third distinct error treatment: bespoke `rounded-2xl` + custom `shadow-[...]` + rose tokens | med | Extract one shared `InlineError` (icon + message); reuse in `Jobs`, `JobPosts` |
| `employer/Dashboard.jsx:38`, `job-seeker/Dashboard.jsx:68`, `super-admin/Dashboard.jsx:25` | three different error presentations: bare `text-danger` one-liner vs. the two richer ones | med | Adopt the shared `InlineError` with a Retry affordance |
| `employer/JobPosts.jsx:449-464` (`loadError`) | error state uses `rose-*` while dashboards use the `danger` theme token | low | Switch to `danger` token so light/dark theming stays in one place |
| `job-seeker/Jobs.jsx:206-207` | **CONFIRMED**: `LoadingScreen` (`min-h-screen`) rendered inline mid-card; re-fires on every filter/page change (deps at `:74`) so the results area jumps to a full-screen spinner | med | Replace with an inline skeleton/`opacity-50` overlay on the grid; keep the spinner only for the first load |
| `employer/JobPosts.jsx:447` + all 3 `Dashboard.jsx:37/:67/:24` | full-page `<LoadingScreen />` early-return is consistent — but it replaces the `<Outlet/>` inside an already-scrolled `main`, resetting scroll position on every mount | low | Acceptable; note as known, not a divergence from sibling pages |
| `job-seeker/Jobs.jsx:172` | `flex-nowrap` search row leaves the input ~150px wide at 360px (no overflow, but cramped) | low | Let the `Filters` label collapse to the icon under `sm`, freeing ~60px |
| `super-admin/Dashboard.jsx:64-65` | empty state is bare grey text — no icon, no guidance link; the other two dashboards do better | low | Match `employer/Dashboard.jsx:66-70` pattern (icon + deep link) |
| `job-seeker/Jobs.jsx:280`, `employer/Dashboard.jsx:67` | empty-state body copy uses `text-gray-500` while `job-seeker/Dashboard.jsx:126,153` and `super-admin/Dashboard.jsx:65` use `text-gray-400` | low | Standardise on `text-gray-500` |
| `employer/JobPosts.jsx:770-794` | empty state tells the user to click "+ Post a Vacancy" but, when accreditation ≠ approved, `loadData` empties the list (`:144-147`) and `handleOpenCreate` rejects (`:202-205`) — dead-end advice | med | Branch the copy on `accreditationStatus` and link to the accreditation page |
| `employer/Dashboard.jsx:60` | hardcodes `highlight={false}`, discarding the `highlight` prop the other two dashboards pass through — amber "attention" dot never renders for employer | low | Pass `highlight={stat.highlight}` |
| `employer/JobPosts.jsx:706-762` | row action order is Edit → Duplicate → Archive → **Delete** → Close/Reopen; destructive isn't isolated and the common toggle is farthest right | low | Reorder to …Archive, Close/Reopen, Delete (destructive last) |
| `shared/components/PortalLayout.jsx:141-154` | AFK modal puts primary "Stay Signed In" on the **left**; every other modal in scope puts the primary on the right | low | Move primary to the right for parity |
| `employer/JobPosts.jsx:1246` | `flex-col-reverse sm:flex-row` → on mobile the primary "Publish Job" sits at the *top*, Cancel at the bottom | low | Use `flex-col` so the primary stays bottom-most on mobile |
| `employer/JobPosts.jsx:498-526` | success/error feedback is hand-rolled per page (state + 5s auto-dismiss + dismiss button) | low | Extract to a shared `Toast`/`Banner`; other pages will need it |
| `employer/JobPosts.jsx:1249-1266` | the only in-scope pending-state implementation (`disabled` + "Saving…"/"Publishing…") — no other page has save actions to compare, so the pattern is not yet reusable | low | Keep; promote to a `PendingButton` when the 2nd caller appears |
| `employer/JobPosts.jsx:602` | table correctly wrapped in `overflow-x-auto` — no fixed widths elsewhere; 360px is safe | ok | none |
| `shared/components/PortalLayout.jsx:127` | `p-[3%]` + `min-h-[calc(100vh-56px)]` matches the `h-14` mobile header — correct | ok | none |
| `super-admin/SuperAdminLayout.jsx:3-14` | 10 nav items scroll in `nav.overflow-y-auto` — no overflow | ok | none |
| `employer/JobPosts.jsx:348-365, 728-745, 1438-1473` | destructive archive/delete/discard all guarded by `ConfirmationModal` with applicant-count warning; close/reopen (reversible) is not — correctly calibrated | ok | none |

## Consistency matrix

| Pattern | Employer | Job Seeker | Super Admin |
|---|---|---|---|
| Shell | `PortalLayout` | `PortalLayout` | `PortalLayout` ✅ consistent |
| Nav source | `navItems` array | `navItems` array | `navItems` array ✅ |
| Badge | `EMPLOYER` | `SEEKER` | `ADMIN` ✅ |
| Eyebrow | `SANTA MARIA, BULACAN` ⚠️ | `PESO · SANTA MARIA` | `PESO · SANTA MARIA` ⚠️ divergent |
| `subhead` | fn(user) | fn(user) | static string (same output) ⚠️ impl. only |
| `homeTo` (logo target) | default `/` ⚠️ | `/job-seeker` | default `/` ⚠️ divergent |
| Extra chrome outside layout | accreditation banner | `HelpChat` float | none ✅ each legitimately unique |
| Page header | ⚠️ light bg, no `PageHeader` | ⚠️ hand-rolled dark-blue | `PageHeader` ✅ |
| Stat cards | `StatCard` | `StatCard` | `StatCard` vs. `JobPosts` hand-rolled ⚠️ |
| Section container | `SectionCard` | `SectionCard` | `SectionCard` ✅ (Jobs/JobPosts bypass it) |
| Spacing scale | `space-y-6` / `gap-3` | `space-y-6` / `gap-3` | `space-y-6` / `gap-3` ✅ |
| Mobile stat grid | 1col→4 | 1col→4 | **2col**→3→6 ⚠️ divergent mobile density |
| Loading | full-page `LoadingScreen` | inline mid-page `LoadingScreen` ⚠️ | full-page `LoadingScreen` |
| Error state | `rose-*` card + retry | `rose-*` card, no retry ⚠️ | bare `text-danger` ⚠️ three ways |
| Empty state | icon + link | icon + link (+ clear filters) | bare grey text ⚠️ |
| Action feedback | inline banner + pending | n/a (no mutations) | n/a (no mutations) ✅ |
| Destructive guard | `ConfirmationModal` ✅ | n/a | n/a ✅ |
| Primary-button side | right (modals) | right | right, but AFK modal left ⚠️ |

**Bottom line:** the shared `PortalLayout` + `dashboard.jsx` primitives have already solved shell, spacing and card consistency — the remaining divergence is *not* structural but **adoption drift**: `Jobs.jsx` and `JobPosts.jsx` predate the shared blocks and re-implement them (headers, stat cards, error cards). Highest-value fixes: `Jobs.jsx:206` inline spinner, three-way error-state split, the accreditation dead-end in `JobPosts`, and `homeTo` escaping the admin portal.
