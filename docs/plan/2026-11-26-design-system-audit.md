# Design system audit — full web app

- **Date:** 2026-11-26
- **Status:** audit complete; remediation **not approved**
- **Scope:** every page archetype and every shared shell in `src/` — public site, auth, job seeker, employer, super admin, UI primitives, `src/index.css`
- **Method:** static review. All JSX files were scanned for spacing, type, radius, shadow, and max-width utilities; each page archetype and shell was read; cascade behaviour of the unlayered rules in `index.css` was verified against the Tailwind v4 utilities. No browser session was run, so no pixel screenshots back these findings. Line numbers reflect the worktree at audit time and will drift with in-flight edits.
- **Database / API:** no changes. This audit proposes no schema or contract change.
- **Coordination:** the worktree contains uncommitted auth/profile required-field work by another agent. Phase 2 must build on that work, not revert it.
- **Progress:** Phase 0 implemented and verified 2026-11-26 — `npm run lint` exit 0, `npm run build` exit 0, `npm test` 264 files / 1853 tests passed (7 skipped). Phase 1 implemented and verified 2026-11-26 — lint/build exit 0, 264 files / 1848 tests passed (7 skipped; the 5 fewer are the removed legacy-header/footer tests). Phase 2a implemented and verified 2026-11-26 — lint/build exit 0, 264 files / 1848 tests passed (7 skipped); one TermsModal mobile-inset fix applied. Phase 2b implemented and verified 2026-11-26 — lint/build exit 0, 263 files / 1846 tests passed (7 skipped; 2 fewer from the removed dead TagInput suite); chip remove targets are 24 px. Phase 3a implemented and verified 2026-11-26 — 170 arbitrary text sizes under `src/features` + `src/shared` reduced to 0; one stale StatCards class assertion updated to `text-3xl`. Phase 3b implemented and verified 2026-11-26 — lint/build exit 0, 263 files / 1846 tests passed; two `StatCards` on the super-admin dashboard, flattened UserManagement, `surface` profile/auth cards, `SectionCard` removed.
- **Final automated state:** `npm run lint` exit 0; `npm run build` exit 0; `npm test` 263 files passed / 1 skipped, 1846 tests passed / 7 skipped.
- **Remaining before done:** the 360/768/1280 visual pass (Phase 4). This environment has no browser tool, so the visual check must be run before the plan moves to `docs/plan/done/`. Intentional exceptions are recorded in Phase 4.

## Brief (for sign-off)

- **What:** make spacing, type, radius, and elevation behave as one system across every surface, starting with the primitives and shells rather than a page-by-page patch.
- **Out of scope:** copy, routing, data, API contracts, database schema, dependency additions.
- **Done when:** the values in the spacing contract below are the only ones in use; `npm run lint` and `npm test` pass; one page per feature has been visually checked at 360 / 768 / 1280 px; no new arbitrary `text-[…px]`, one-off panel padding, or bespoke modal shell remains.
- **Assumptions:** keep the current navy / blue / teal palette, Geist, and the 16 px panel radius; keep 44 px default control height; no dark mode requested.

## Verdict

The visual language is coherent — one font, a disciplined palette, and a set of shared primitives (`PageHeading`, `Panel`, `SearchInput`, `EmptyState`) that most portal pages already use. The problem is enforcement: **four different mechanisms set vertical rhythm, and a block of unlayered global CSS overrides the size variants of the primitives.** Pages that should match differ by 4–16 px in gaps, padding, and control geometry.

The five root causes:

1. Page rhythm is set by `space-y-8`, component margins (`mb-4/5/6/7`), local `gap-6`, and page-owned `space-y-6` wrappers — all at once.
2. `index.css` forces every button to `min-height: 44px` and every input to 44 px **outside a cascade layer**, so icon buttons and size variants cannot render their intended geometry.
3. Two panel languages coexist: `.surface` (20 px radius, 20/24 px padding) and `Card` (16 px radius, 24 px padding), plus ad-hoc cards at 16/20/24 px.
4. The public shell overrides the page gutter to 12/16 px while page content uses 20/32/40 px, so header, content, and footer edges do not line up on every public and auth page.
5. Modals, flash messages, empty states, and tag inputs each have several hand-rolled versions with different radii, shadows, and padding.

## What is already consistent (reuse these)

- `PageHeading` for portal page titles (`src/shared/components/design.jsx:76`).
- `Panel` / `Card` for portal content blocks; skeletons already reuse `surface` and `Card` to keep CLS at zero (`src/shared/components/Skeletons.jsx:24`).
- The filter bar pattern is identical on 8 list pages: `mb-5 flex flex-col gap-3 sm:flex-row sm:items-end` (employer and super-admin list pages).
- `SearchInput` + `SelectField` pair.
- `portal-grid` (20 px gap) and `job-grid` (20 px gap).
- One font, one focus-visible baseline, 44 px default controls, status colours.
- Status vocabulary and badge tones (`design.jsx:49`).

The audit below is about the exceptions to these primitives, not a redesign.

## Findings

### F1 — Vertical rhythm is produced by four competing mechanisms (High)

**Where:** `src/shared/components/TopNavLayout.jsx:312-313`, `src/shared/components/design.jsx:76-88`, `design.jsx:133`, `src/index.css:736`, `src/features/super-admin/UserManagement.jsx:404`, `src/features/super-admin/RoleManagement.jsx:181`, `src/shared/components/NotificationsPage.jsx:176`.

**Evidence:**

- The portal main wrapper is `p-5 sm:p-7 lg:p-8` with `space-y-8` → page blocks are **32 px** apart.
- `PageHeading` adds its own `mb-7` (**28 px**) or `mb-4` (**16 px** with `compact`).
- `StatCards` adds `mb-6` (**24 px**).
- `portal-grid` uses `gap-5` (**20 px**) and its columns use `gap-6` (**24 px**).
- `UserManagement`, `RoleManagement`, and `NotificationsPage` wrap everything in `space-y-6 pb-12` → their page blocks are **24 px** apart, unlike the other portal pages.
- Heading to first block therefore lands at 16 / 24 / 28 / 32 px depending on the page; block to block is 24 or 32 px; inside a dashboard column it is 24 px.

**Why it reads as a flaw:** pages of the same type have visibly different breathing room, and an implementer cannot fix it from the page file because `space-y` and the component's own `mb-*` both apply.

**Direction:** one page-level stack only. Remove margin from `PageHeading` and `StatCards`; let the page wrapper own the gap. Delete page-owned `space-y-6 pb-12` wrappers. `compact` becomes a type/spacing variant on the heading, not a margin switch.

---

### F2 — Unlayered global CSS breaks primitive size variants (High)

**Where:** `src/index.css:742-756`, `src/components/ui/button.jsx:15-22`, `src/components/ui/card.jsx:3`, `src/components/ui/badge.jsx:5`, `src/components/ui/dialog.jsx:23`, `src/shared/components/JobsBrowser.jsx:250-264`.

**Evidence:**

- `[data-slot='button'] { min-height: 44px; padding-inline: 17px }` is unlayered, so it beats every layered size utility. 24 icon-size `<Button>` usages in the app render 28–36 px **wide** but 44 px **tall**; the dialog close button (`size="icon-sm"`, `dialog.jsx:23`) is 28×44, not square.
- Any custom `px-*` on a `<Button>` is also overridden to 17 px (e.g. the AFK dialog buttons at `TopNavLayout.jsx:371-372`, `ConfirmationModal` buttons).
- `[data-slot='input']` / `[data-slot='input-group']` force 44 px min-height. `JobsBrowser` tries to build a 36 px search row (`h-9` at lines 250-256); the 44 px input overflows the 36 px row by 4 px top and bottom.
- `[data-slot='card'] { --card-spacing: 24px }` beats the `size="sm"` utility, so every `Panel size="sm"` (profile tabs, user management, account settings) is still 24 px padded. The size prop is visually dead.
- `[data-slot='badge'] { font-size: 10px; padding: 4px 7px; border-radius: 5px }` beats the badge's own `h-5 rounded-4xl text-xs`. The badge box is 20 px tall but needs ~23 px (8 px padding + 15 px line box) and is `overflow-hidden`; it is also visually a different species from the hand-rolled pill chips used beside it.

**Why it reads as a flaw:** the design system has variants on paper that the cascade silently erases. Fixing a page in JSX cannot work until these overrides are moved into the component variants.

**Direction:** delete the unlayered sizing overrides. Put the 44 px target on `size="default"`/`size="lg"` and give icon sizes square 36/40/44 px targets. Use component paddings, not global padding. Remove the card-spacing override so `size` works. Rebuild the badge from its variants.

---

### F3 — Two panel languages, three paddings, two radii (High)

**Where:** `src/index.css:726` (`.surface`), `src/components/ui/card.jsx:3`, `src/index.css:746`, `src/shared/components/design.jsx:132-149`, `src/features/super-admin/Dashboard.jsx:74-91`, `src/shared/components/SeekerProfileCard.jsx`, `src/features/employer/JobPostFormDialog.jsx`.

**Evidence:**

- `.surface` = `rounded-2xl` (**20 px**) + `p-5 sm:p-6` (**20/24 px**) + near-invisible custom shadow.
- `Card` / `Panel` = `rounded-xl` (**16 px**) + 24 px padding.
- `.surface` is used 15 times across public and portal pages, including `JobsBrowser`'s filter sidebar, job detail cards, and public job cards.
- Ad-hoc cards exist at 16 px, 20 px, and 24 px padding: admin stat rows `px-5 py-4` (20/16), `SeekerProfileCard` `p-4 md:p-5` (16/20), job post dialogs `p-5 md:p-6`.
- **The super-admin dashboard shows two different stat-card languages on one screen:** `StatCards` (surface, 29 px number, icon right) followed by custom row cards (`px-5 py-4`, `text-xl` number, teal icon tile).
- `UserManagement` nests six `Panel` stat cards inside another `Panel` (`UserManagement.jsx:426-441`) — a card inside a card.

**Why it reads as a flaw:** the eye reads surface, padding, and corner radius as hierarchy. Two values for the same role makes the hierarchy ambiguous, and nested cards add visual noise.

**Direction:** one `Panel` primitive with explicit variants (`default`, `stat`, `tile`). Delete `.surface` and point its callers at `Panel`. Do not nest panels; a stat row is a grid of tiles, not a panel of panels.

---

### F4 — Public shell gutters do not line up with page gutters (High)

**Where:** `src/index.css:720`, `src/shared/components/PublicShell.jsx:22`, `PublicShell.jsx:66`, `src/shared/components/PublicHeader.jsx:42`, `src/shared/components/PublicFooter.jsx:40`.

**Evidence:**

- `.page-container` = `max-w-[1240px] px-5 sm:px-8 lg:px-10`.
- `PublicShell`'s header and footer add `px-3 sm:px-3 lg:px-4`, **overriding** the container padding. The logo, nav, and footer start 8 px (mobile), 16 px (sm), and 24 px (lg) outside the content edge below them. This affects every public page and every auth page, because auth also uses `PublicShell`.
- `PublicHeader` (28 px) and `PublicFooter` (42 px) are **unused legacy components** with two more gutter values. Nothing imports them.

**Why it reads as a flaw:** the header reads as if it belongs to a wider page than the hero and footer beneath it.

**Direction:** let `page-container` own the gutter; remove the shell overrides. Delete `PublicHeader.jsx` and `PublicFooter.jsx` or rebuild them on `PublicShell`. One header, one footer.

---

### F5 — Six modal shells, four overlay treatments (Medium-High)

**Where:** `src/components/ui/dialog.jsx:16-23`, `src/shared/components/ConfirmationModal.jsx:9-31`, `src/shared/components/TermsModal.jsx`, `src/features/employer/JobPostFormDialog.jsx`, `JobPostDetailDialog.jsx`, `src/shared/components/HelpChat.jsx`, `TopNavLayout.jsx:366-372`, `RoleManagement.jsx`, `UserManagement.jsx`.

**Evidence:**

| Shell | Overlay | Panel |
|---|---|---|
| `Dialog` | `bg-black/10` + blur | `rounded-xl`, ring, no shadow |
| `ConfirmationModal` | `bg-black/60` + blur | `rounded-lg`, **border-primary**, `shadow-2xl` |
| Job post dialogs | `bg-black/60` + blur | `rounded-2xl`, `shadow-2xl` |
| `TermsModal` | `bg-black/60` + blur | `rounded-lg`, border-primary |
| `HelpChat` | `bg-navy/60` + blur | `rounded-2xl`, ring |
| AFK warning | `bg-black/60` | `rounded-lg`, border-primary, `shadow-xl` |
| Role/user overlays | `bg-foreground/60` | `rounded-xl` |

**Why it reads as a flaw:** the same interaction (a blocking modal) has three radii, three kinds of edge treatment, and four overlay darknesses. The navy overlay looks like a different product.

**Direction:** one modal primitive built on the existing `Dialog`; one overlay token; one radius and elevation. `ConfirmationModal` becomes a composition of the primitive.

---

### F6 — Two form-field languages (Medium)

**Where:** `src/features/auth/JobSeekerBackgroundStep.jsx:14-38` (same pattern in the other four registration step files), `src/shared/components/design.jsx:150-187`, `src/components/ui/input.jsx`, `src/index.css:737`, `src/components/ui/field.jsx:9`.

**Evidence:**

- Auth steps use raw `<Input>` with a repeated class string: `px-4 py-2.5 rounded-xl text-sm bg-muted border …`. Portal pages use `TextField` / `SelectField` → `rounded-lg` (12 px), `px-2.5`, transparent background.
- Labels: auth steps use `mb-1 text-xs text-muted-foreground`; the field primitive uses a 13 px `FieldLabel` with an 8 px gap.
- The same step mixes `px-4` and `px-3` inputs (`JobSeekerBackgroundStep.jsx:34/38`).
- Four chip-input implementations with different padding/min-height: shared `TagField` (`py-2`), feature `TagField` (`py-1`), `TagInput` (`min-h-[44px] px-4 py-2`), `VocabularyPicker` (`min-h-[44px] px-4 py-2`).
- `src/features/job-seeker/TagField.jsx` duplicates `src/shared/components/TagField.jsx` with a one-pixel padding difference.

**Why it reads as a flaw:** registration and the portal feel like two products; the same “skills” input looks different depending on which screen you are on.

**Direction:** one field primitive. If the auth design intentionally uses a filled input, that is a variant of `TextField`, not a raw class string. One `TagInput`; delete the feature copy.

---

### F7 — The type scale leaks into 175 arbitrary values (Medium)

**Where:** all features. Highest concentrations: `job-seeker/Dashboard.jsx` (14), `SeekerProfileCard.jsx` (12), `UserManagement.jsx` (11), `RoleManagement.jsx` (10), `JobCard.jsx` (10), `TopNavLayout.jsx` (7).

**Evidence:**

- `text-xs` 410 uses, `text-sm` 172, `text-[10px]` 83, `text-[11px]` 68, `text-[9px]` 6, plus one-offs at 15/17/23/28/29/30/36/38/46/52/58 px → **~175 arbitrary type sizes**.
- Six page-title treatments: `PageHeading` 24/30, auth 29, `.display-heading` 36/44, home hero 36/52/58, legal 24/30 without a hero, public job detail 24/30.
- Body copy is 12 px in portals but 14 px (sometimes 15 px) on public pages; card titles are 16 px; table cells are 13 px; badges are 10 px; captions 9 px.
- Section headings on the public site are 32/36/40 via `.section-heading`, but the How It Works page uses `text-2xl sm:text-[28px]` for the same role.

**Why it reads as a flaw:** “small” means four different sizes depending on file, and the micro sizes (9–10 px) drift into content that is not purely meta.

**Direction:** one semantic scale: display 36/44 (home hero may add a 52/58 token), page 24/30, section 32/36/40, card 16, body 14, small 12, micro 10 (non-essential meta only), eyebrow 11 uppercase. Ban new arbitrary sizes; allow only the documented hero token.

---

### F8 — Public pages have no single vertical archetype (Medium)

**Where:** `About.jsx:11-19`, `Faq.jsx:13-21`, `HowItWorks.jsx:82-92`, `PesoServices.jsx:12-20`, `PublicJobs.jsx:11-21`, `PublicJobDetail.jsx:64`, `Legal.jsx`, `CommunitySections.jsx:35-90`, `CommunityStats.jsx:61`, `HomeHero.jsx:25`.

**Evidence:**

- Hero: `py-14 md:py-16` (56/64) on all five marketing pages.
- Content below the hero: About `pt-6` (**24 px**), PublicJobs `py-10` (**40 px**), Faq/HowItWorks/PesoServices `py-12 md:py-16` (**48/64**), legal `py-14` (**56**), detail pages `py-8` (**32**).
- Landing sections: first `py-20` (80), stats `py-14 md:py-16` (56/64), the rest `py-16 md:py-20` (64/80).
- The hero markup is copy-pasted five times (same gradient, same background image, same inner spacing), which is why the discrepancy exists.
- Legal is the only public page with no hero and a 24/30 title, so it reads as a different site.

**Why it reads as a flaw:** the gap between hero and content doubles between About and its siblings; Stats is the only landing band that tightens.

**Direction:** one `PageHero` component and one page archetype: hero 56/64, content top 48/64, bottom 56/64. Decide whether legal is inside the archetype or an explicitly documented exception.

---

### F9 — Empty states and flash messages are hand-rolled per page (Medium)

**Where:** `design.jsx:99` (`EmptyState`), `UserManagement.jsx:420/502/842/893/909/925/955`, `Settings.jsx:96`, `TopNavLayout.jsx:358`, `HelpChat.jsx:101`, `NotificationsPage.jsx:278`, `JobDetail.jsx:53`, `CompanyProfile.jsx:161`, `PublicJobDetail.jsx:52`, `PublicEmployerProfile.jsx:51`.

**Evidence:**

- `EmptyState` is `min-h-56 rounded-xl border bg-card`.
- Ad-hoc empty messages use `py-6`, `py-8`, `py-10`, or `py-14` with `text-xs` centre alignment in seven files.
- Success/error flash banners are repeated with `px-4 py-3` and **two radii**: `rounded-lg` in `ForgotPassword.jsx:81` and `TabbedProfileLayout.jsx:31`, `rounded-xl` in `ChangePassword.jsx:53-54`, `JobPosts.jsx:367-379`, `UserManagement.jsx:443`, `RoleManagement.jsx:190/310`, `NotificationsPage.jsx:203`.
- `Notice` exists for informational alerts but is not used for action feedback.

**Why it reads as a flaw:** the same state has different height, radius, and icon alignment on every page.

**Direction:** one `EmptyState` (allow a compact variant) and one `Flash`/`Alert` for success/error. Both already exist in spirit; consolidate rather than add.

---

### F10 — Radius and elevation have no role semantics (Low-Medium)

**Where:** `src/index.css:679-685`, plus usage across features.

**Evidence:**

- Radii in use: 12 px `rounded-lg` (55), 16 px `rounded-xl` (88), 20 px `rounded-2xl` (17), 8 px `rounded-md` (13), 6 px `rounded-sm` (1), plus full and 5 px badges. Same-role surfaces split between 16 and 20; secondary modal buttons are `rounded-xl` while primary buttons are `rounded-lg`.
- Shadows: `xs` 2, `sm` 4, `md` 5, `lg` 4, `xl` 8, `2xl` 5, plus two custom hex shadows (`0 2px 5px #12325b03`, JobCard hover `0 8px 24px #12325b08`). The toast floats with `shadow-xs` while a dropdown uses `shadow-lg`.
- `--radius-sm/md/lg/xl/2xl` are redefined from Tailwind defaults, so every primitive's radius changes at once — but the call sites do not share intent.

**Why it reads as a flaw:** elevation communicates layering; when everything between 8 and 32 px exists, it communicates nothing.

**Direction:** radius roles (control 12, panel/overlay 16, pill 999, badge 6) and elevation roles (flat border/ring, raised menus `md`, overlays `xl`). One overlay colour.

---

### F11 — Token drift and dead code (Low)

**Where:** `src/index.css:687-708`, `PublicHeader.jsx`, `PublicFooter.jsx`, tag inputs, page heroes.

**Evidence:**

- `bg-white` 17 uses vs `bg-card` 30; `bg-black` 10 overlay uses; `text-white` 58 (on primary/navy, legitimate) but no single surface token.
- `danger` and `destructive` are aliases, as are `navy` and `dark-blue`; `primary-hover` and the soft palette are hardcoded hex in the theme while the rest is variable-driven.
- `PublicHeader` / `PublicFooter`: 0 imports.
- Three tag inputs, two `TagField` files, five copies of the page-hero markup.
- Content widths in use: 720, 940, 960, 1020, 1240, plus `max-w-[460px]`, `[470px]`, `[490px]`, `[240px]`.

**Why it matters:** every future page copies whichever variant it finds first.

**Direction:** delete dead components and duplicate inputs; alias the colour names; use a small set of content widths by role (narrow prose 720, marketing column 960, shell 1240).

---

### F12 — Accessibility carried by the spacing/type system (Medium)

**Where:** `src/index.css:714`, `742-756`, colour tokens `687-708`, `PublicShell.jsx`, `design.jsx:79`, feature banners.

**Evidence (computed):**

- `teal #0d9488` on white = **3.74:1**. The `.eyebrow` is 11 px uppercase teal, and `text-teal` is used for links/labels — below 4.5:1.
- `success #168255` on `#edf9f1` = **4.46:1**; `danger #c6413b` on `#fef0ef` = **4.48:1**. Both are used at 12 px in flash banners. They miss AA for normal text by a hair.
- Double focus indicator: global `:focus-visible { outline: 3px solid }` plus component `focus-visible:ring-3`. Inputs and buttons get both.
- Hit targets: default buttons/inputs are 44 px (good), but icon buttons are 28–32 px wide (see F2), so icon-only controls miss the 44 px target on one axis.
- Content text at 9/10 px (dropdown captions, badges, notifications) is below a comfortable reading size; reserve those for non-essential meta.

**Direction:** darken teal for text (keep the brand fill), nudge success/danger one step darker, keep one focus ring, square icon hit areas, and set a 12 px floor for content.

## Spacing contract to adopt in Phase 0

These values are chosen from what the code already uses most, so migration is mostly deletion, not redesign.

| Role | Value |
|---|---|
| Page-level block stack (portal) | 32 px, one owner; the page heading is a normal block in this stack and carries no margin |
| Panel padding | 24 px default; 16 px compact; no other values |
| Panel internal stack | 16 px |
| Panel grid gap | 20 px |
| Form field stack | 16 px |
| Label → control | 8 px |
| Public section vertical | 64 px mobile / 80 px desktop |
| Public hero → content | 48 px mobile / 64 px desktop |
| Control height | 44 px default; 36 px sm; 28 px xs |
| Icon hit area | square: 40 px default, 32 px sm, 24 px xs |
| Table head / cell | 48 px / 16 px vertical |

Type roles: display 36/44 (home hero 52/58 token), page 24/30, section 32/36/40, card 16, body 14, small 12, micro 10, eyebrow 11 uppercase.

## Remediation plan

Sequencing matters: page sweeps before Phase 0 will fight the cascade and be redone.

### Phase 0 — tokens and primitives (blocking)

**Owner:** `frontend` (build), reviewed by `review` and signed off by `arch`.

- Move button/input/card/badge sizing out of unlayered `index.css` into the component variants. Restore real size variants; make icon sizes square.
- Make `size="sm"` panels actually smaller (16 px vs 24 px) instead of the dead global override.
- Re-point `.surface` at the panel geometry (16 px radius, panel shadow); keep its current responsive padding until call-site migration in Phase 3, because auth call sites are being edited concurrently. Do not delete the class while callers still use it.
- Remove margins from `PageHeading` / `StatCards`; the page wrapper owns the 32 px stack.
- Add semantic tokens: `--text-micro`, `--text-eyebrow`, `--radius-control`, `--radius-panel`, `--radius-badge`, `--shadow-surface`.
- Fix the badge box so a 10 px label fits a 20 px pill without clipping.

**Phase 0 geometry decisions**

| Primitive | Decision |
|---|---|
| Button default / lg | 44 px tall; default `px-4` |
| Button sm / xs | 36 px / 28 px |
| Icon buttons | square 40 px default, 32 px sm, 24 px xs |
| Input / input-group | 44 px; inner input fills the group; compact overrides may shrink the group |
| Card / Panel | 24 px default padding, 16 px `size="sm"`; 16 px radius; one surface shadow |
| Badge | 20 px tall, 10 px type, 7 px horizontal padding, 6 px radius, no vertical padding |
| Focus | keep the single component ring; do not add a second outline |

**Acceptance:** `npm run lint`, `npm test`, and `npm run build` pass; no button/input/card/badge sizing override remains in `index.css`; icon buttons are square; compact panels are 16 px; the compact search row in `JobsBrowser` is 36 px tall without overflow.

**Database:** none.

### Phase 1 — shells and public rhythm

**Owner:** `frontend`.

- `PublicShell`: remove the header/footer `px-3 sm:px-3 lg:px-4` overrides so `page-container` owns the gutter; delete `PublicHeader` and `PublicFooter` and trim the dead blocks in `PublicChrome.test.jsx` (keep the `PublicShell` footer tests).
- Introduce `src/features/public-site/PageHero.jsx` and replace the five copies (About, Faq, HowItWorks, PesoServices, PublicJobs).
- Public rhythm decisions:
  - Standard marketing pages: hero `py-14 md:py-16`, content `py-12 md:py-16`. About changes from `pt-6` to `py-12 md:py-16`; PublicJobs changes from `py-10` to `py-12 md:py-16`.
  - Landing bands: every section uses `py-16 md:py-20`, including the first band and Stats.
  - Legal stays a documented exception (no hero, 24/30 title) but uses `py-12 md:py-16`.
  - Job/employer detail pages stay a documented dense exception at `py-8`.
- Portal rhythm: remove the page-root `space-y-6 pb-12` wrappers in `UserManagement` and `NotificationsPage` and the extra wrapper around the `PageHeading`; keep the embedded `RoleManagement` stack and inner `TabsContent` stacks. Update `PageSkeleton`/`StatRowSkeleton` to mirror the new 32 px stack and 20 px stat gap.

**Acceptance:** `npm run lint`, `npm test`, `npm run build` pass; `page-hero` appears only inside `PageHero`; no `PublicHeader`/`PublicFooter` references; no page-root `space-y-6 pb-12`; all landing bands use `py-16 md:py-20`; header, hero, content, and footer share one gutter at every breakpoint.

### Phase 2 — forms, modals, feedback

Split into two reversible dispatches. The modal pieces keep their proven focus/scroll behaviour (`useDialog`) and adopt one visual contract; replacing every implementation with the base `Dialog` is deferred until behaviour is covered by tests.

#### Phase 2a — modal chrome + feedback

**Owner:** `frontend` (no API work).

- Add `.modal-overlay` and `.modal-panel` in `index.css`: one overlay (`bg-black/60` + `backdrop-blur-xs` + `p-4`), one panel (`rounded-panel`, `border-border`, `bg-card`, `p-6`, `shadow-xl`).
- Adopt them in `ConfirmationModal`, `TermsModal`, `HelpChat`, the AFK warning, both job-post dialogs, the role/user dialogs, and align the base `Dialog` overlay/panel classes. Keep each component's z-index, focus trap, scroll lock, and close rules.
- Add `Flash` for success/error/warning/info with optional dismiss; replace the hand-rolled banners. Update `Toast` to the semantic success/danger tokens and the same control radius.
- Keep `Notice` for informational content.

**Acceptance:** one overlay colour/blur, one panel radius/elevation/padding; no `border-primary` modal panels; every action banner uses `Flash`; Toast uses tokens.

#### Phase 2b — form controls

**Owner:** `frontend` (no API work).

- Auth steps: remove the repeated raw `rounded-xl bg-muted px-4 py-2.5` classes so inputs/selects use the shared control geometry (44 px, 12 px radius, outlined). Keep labels, error text, and required markers.
- Move the live `features/job-seeker/TagField.jsx` to `shared/components/TagField.jsx`; delete the unused shared `TagField` and `TagInput`, then update the three imports.
- Align `TagField` and `VocabularyPicker` to one 44 px `rounded-control` box; chip remove buttons become 24 px targets (not a default-size `Button`).

**Acceptance:** one field geometry across auth and portals; one chip input; no dead tag components; auth and portal fields match at the same viewport.

### Phase 3 — typography and structure sweeps

Implemented in two dispatches (2026-11-26):

- **3a — typography:** replaced all 170 arbitrary text sizes under `src/features` + `src/shared` with the standard scale and tokens; centralized the home hero as `.hero-heading`; updated the one stale StatCards class assertion to `text-3xl`.
- **3b — structure:** one `StatCards` language on the super-admin dashboard; flattened User Management (no panel around tabs, one surface stat row); `surface` profile/auth cards; `rounded-panel` dropdowns and error card; removed the unused `SectionCard`.

**Acceptance:** arbitrary text sizes in features/shared = 0; no nested card wrapper in User Management; two `StatCards` on the admin dashboard; feature tests pass.

### Phase 4 — verification (remaining)

**Owner:** `review` + `ui-ux-designer`; `tester` where behaviour changed.

- Automated checks are green: `npm run lint`, `npm test` (1846 passed / 7 skipped), `npm run build`.
- **Still required:** visual pass at 360 / 768 / 1280 on every page archetype. This environment has no browser tool, so this pass has not been claimed.
- Compare against the contract table; log intentional exceptions in this file.

**Intentional exceptions to verify, not “fix”:**

- Legal pages have no marketing hero and keep the 24/30 title; they use the standard vertical padding.
- Job/employer detail pages keep the dense `py-8` rhythm.
- Small inline “No X records” messages stay compact inside tables/dialogs; full-page empties use `EmptyState`.
- `src/components/ui` keeps its own control token (`text-[0.8rem]` in button/toggle); feature/shared code does not.
- `.display-heading`, `.section-heading`, and `.hero-heading` keep their px declarations centralized in `index.css`.
- Table cells keep the global 13 px size.

## Guardrails

- New code may not add arbitrary `text-[…px]`, `p-[…]`, or a new overlay shell.
- A page uses `Panel`, `PageHeading`, `EmptyState`, `Flash`, and `TagField` rather than local versions.
- Any intentional exception is recorded here with a reason.
- No new dependency is needed; every primitive already exists.

## Risks

- Removing the unlayered overrides changes many screens at once; the app has no visual-regression tests (jsdom only), so the manual width pass is mandatory.
- Enforcing 44 px on icon buttons will increase header/dialog heights unless those controls deliberately use 40 px square targets. Decide once, in Phase 0.
- Raising micro text to 12 px may reflow dense tables; tables should keep 13 px and use truncation, not smaller type.
- Legal pages are intentionally plain; confirm whether that is an exception before forcing the public archetype.

## Approval

- [x] Spacing contract accepted (user: “okay go”)
- [x] Phase 0 authorized and verified
- [x] Phase 1 authorized and verified
- [x] Phase 2a/2b authorized and verified
- [x] Phase 3a/3b authorized and verified
- [ ] Phase 4 visual pass at 360/768/1280

The audit itself changed no implementation files. Remediation was implemented by dispatched `frontend` agents in Phases 0–3b; the plan file is the only direct edit by the architect.
