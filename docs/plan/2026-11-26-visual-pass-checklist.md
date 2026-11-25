# Visual pass checklist — design system remediation (Phase 4)

- **Date:** 2026-11-26
- **Source plan:** `docs/plan/2026-11-26-design-system-audit.md`
- **Scope:** design-system Phases 0–3b plus the `/link-expired` page
- **Widths:** 360 / 768 / 1280 (Chrome DevTools responsive mode)
- **Status:** pending — no browser session has been run; this is the manual pass before the audit plan can move to `docs/plan/done/`.

Run `npm run dev`, then check every page at all three widths. The global pass applies to every page; page-specific items below cover only what the remediation touched. Record failures as page + width + short note, and log intentional exceptions in the audit plan.

## Global pass — fail on any page

- [ ] No horizontal scrollbar at 360.
- [ ] Public shell: header, hero/content, and footer share the same left/right edge at all three widths. No element starts outside `page-container`.
- [ ] Portal pages: one 32px gap between page blocks. No 16/24/28px outliers, no double margin under headings or stat rows.
- [ ] Panels/cards: 16px radius, 24px padding; compact panels actually 16px padding. No card inside a card.
- [ ] Buttons: default 44px tall, `sm` 36, `xs` 28. Icon-only buttons are square (40/32/24), not 28×44.
- [ ] Inputs/selects 44px, labels 8px above their control. No input overflowing its row by ~4px.
- [ ] Badges/pills: 20px tall, no clipped descenders; visually the same species as chips next to them.
- [ ] Keyboard-only pass: one focus ring per control (not outline + ring), tab order sane.
- [ ] Type: no content below 12px except metadata; table cells stay 13px; page titles 24/30.
- [ ] Modals: same `black/60` blurred overlay, 16px radius, 24px padding, no `border-primary` panels; close button square.
- [ ] Action banners all use the same `Flash` style; toasts use success/danger tokens.
- [ ] Empty states look the same across pages (full-page vs compact in-table is the documented exception).
- [ ] No console errors, no layout shift when skeletons are replaced.

## Public pages

- [ ] `/` — Home: hero uses the 52/58 token; every band is 64/80 (Stats no longer tighter); job cards hover cleanly; CTA buttons 44px.
- [ ] `/jobs` — `PageHero`; filter sidebar is the new panel language; compact search row is 36px with no input overflow; 20px grid gaps; empty result state.
- [ ] `/jobs/:jobId` — dense `py-8` exception; apply/back actions; sidebar cards.
- [ ] `/employers/:employerId` — dense `py-8` exception; logo, stats, cards.
- [ ] `/faq` — hero → content gap now 48/64; accordion open/close spacing.
- [ ] `/how-it-works` — hero; section headings no longer a one-off 28px.
- [ ] `/about` — content now has top padding (`py-12/16`), must match FAQ/PESO; this changed.
- [ ] `/peso-services` — hero and card grid.
- [ ] `/privacy`, `/terms` — documented exception: no hero, 24/30 title, normal section padding; still reads intentionally plain, not broken.
- [ ] Public nav at 360: drawer/menu, tap targets, no clipped labels.

## Auth (all changed by Phase 2b + the new page)

- [ ] `/login` — auth card, 44px controls, Turnstile widget fits 360, error banner.
- [ ] `/register`, `/signup` — chooser cards aligned, same gutter as the shell.
- [ ] `/forgot-password` — inputs, captcha, success/error `Flash`.
- [ ] `/reset-password?token=…` — form geometry, show/hide password hit area, inline invalid-token error after submit.
- [ ] `/reset-password` with no token → redirects to `/link-expired?type=reset`.
- [ ] `/link-expired` — check all four: `?type=reset`, `?type=verify`, `?type=invite`, no/unknown type. Copy, links, card centering at 360/768/1280.
- [ ] `/auth/callback?error=TOKEN_EXPIRED` → redirects to `/link-expired?type=verify`; a valid verification still shows “Email verified.”
- [ ] `/accept-invite` with no token → redirects to `/link-expired?type=invite`; with `?token=` still forwards to reset.
- [ ] `/register/job-seeker` — all three steps: inputs are now the shared outlined 44px geometry (no leftover filled `bg-muted` boxes), 8px label gap, selects, error text, stepper, mobile stacking.
- [ ] `/register/employer` — representative + company steps, same field checks; Terms modal overlay/panel.
- [ ] `/complete-registration`, `/employer/status` — cards, fields, banners.

## Job seeker portal

- [ ] `/job-seeker` — dashboard: 32px block stack; `StatCards`; charts/widgets align.
- [ ] `/job-seeker/jobs`, `/job-seeker/saved` — search/filter row, job cards, pagination, empty states.
- [ ] `/job-seeker/jobs/:jobId` — detail columns, apply dialog.
- [ ] `/job-seeker/applications` — `ApplicationTimeline`, status badges (no clipping), empty state.
- [ ] `/job-seeker/employment` — charts and table at 360/768.
- [ ] `/job-seeker/profile` — tabs; profile `surface` cards; `TagField`/`VocabularyPicker` both 44px with 24px chip-remove targets; save `Flash`; Change Password form.
- [ ] `/job-seeker/notifications` — rows, unread badge, empty state.

## Employer portal

- [ ] `/employer` — dashboard: stat cards, recent applicants/jobs, 32px rhythm.
- [ ] `/employer/job-posts` — filter bar, table, pagination; create/edit dialog: unified modal chrome, 44px fields, validation, footer buttons; detail dialog; delete confirmation.
- [ ] `/employer/applicants` — table/detail, status actions, badges, empty state.
- [ ] `/employer/employees`, `/employer/company` — forms, logo upload, panel padding.
- [ ] `/employer/accreditation` — document cards, upload state, `Flash`.
- [ ] `/employer/notifications` — same list language as seeker.

## Super admin

- [ ] `/super-admin` — dashboard: now one stat language (no custom row beside `StatCards`), chart/table alignment.
- [ ] `/super-admin/users` — flattened (no panel around tabs), stat row, filters, table, row-action dialogs, empty state at 360.
- [ ] `/super-admin/accreditation`, `/applications`, `/employment-tracking`, `/job-posts`, `/reports` — list archetype: filter bar, table, badges, pagination; table overflow scrolls inside, not the page.
- [ ] `/super-admin/broadcast` — form, recipient controls, success/error `Flash`.
- [ ] `/super-admin/notifications`, `/profile`, `/settings` — account forms, Change Password, toggles.
- [ ] `/super-admin/logs` — dense 13px table, horizontal scroll container, sticky header if present.

## Shared overlays and chrome (open from any page)

- [ ] `TopNavLayout`: header height, square icon buttons, notification dropdown, profile menu, mobile sidebar/drawer, AFK warning modal.
- [ ] `HelpChat`: unified overlay/panel, mobile sizing, z-index above content.
- [ ] `ConfirmationModal`, `TermsModal`, `Toast`, `NotificationBell`: one radius/elevation/overlay; dismiss and focus return work.

## Intentional exceptions — verify, don't “fix”

- Legal pages: no hero, 24/30 title.
- Job/employer detail pages: dense `py-8`.
- Small “No X records” lines inside tables/dialogs stay compact; only full-page empties use `EmptyState`.
- Table cells stay 13px; `src/components/ui` keeps its own `text-[0.8rem]` control token.
- `.display-heading`, `.section-heading`, `.hero-heading` px values remain centralized in `index.css`.

## Results log

| Page | Width | Finding | Owner | Status |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
