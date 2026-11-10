# Plan: Native scroll parallax — perceptual responsiveness layer

**Status:** DRAFT — awaiting sign-off
**Owner:** Lead Architect → hand off to `frontend`
**ADR:** `docs/arch/adr-045-native-css-scroll-parallax.md`

## Decision (short version)

Parallax = a perceptual trick: motion synchronized to the user's own scroll input, run 100% on the compositor. We add **native CSS scroll-driven animations** as Tailwind v4 `@utility` definitions in `src/index.css`, mirroring the existing `scroll-fade` utilities (keyframes in `@theme inline`, `animation-timeline` inside `@supports`, static fallback inside `@supports not`). Scope: **Landing page only** (hero background + below-fold section reveals). No motion libraries, no JS listeners, no React state, no re-renders — nothing to make the page slower, everything to make it *feel* faster.

## Global constraints

- JavaScript + JSX only (no TypeScript). Tailwind tokens for any color reuse.
- Animate **only** `transform` and `opacity`. Never width/height/top/left.
- No new dependencies. No new files outside the three touched ones + one test file.
- `@supports (animation-timeline: view())` guards every timeline animation; `@supports not` path leaves content fully visible and static.
- Every new utility gates on `@media (prefers-reduced-motion: no-preference)` (belt over the global kill-switch already in `index.css`).
- No changes to `db/schema.sql`, `server/`, API routes, or state management — pure presentation.

## New interface (utilities in `src/index.css`, ~70 lines, added after the `scroll-fade` block)

**`parallax-bg`** — background drift layer.
- Consumed on: an absolutely-positioned layer div inside a `relative overflow-hidden` parent (section keeps its existing `overflow-hidden`).
- Timeline: `scroll(root y)` — starts at 0 at page load, so the hero is **not** pre-shifted at first paint.
- Behavior: translateY drift from `0` to `var(--parallax-bg-depth)` (default `80px`) across the first viewport of scroll; layer extends beyond the parent by that depth on both block edges so no edge ever exposes.
- Vars: `--parallax-bg-depth` (length; default 80px).

**`parallax-reveal`** — below-fold entrance reveal.
- Timeline: `view()`, range `entry 10%` → `cover 45%`, fill both.
- Behavior: `opacity 0 → 1`, `translateY(24px) → 0`.
- Applied only to content below the first viewport; hero keeps its existing `hero-enter` keyframe.
- Unsafe browsers / reduced motion: element renders fully visible (base styles), zero cost.

## Changes

### Task 1: Utilities in `src/index.css`
- Add `parallax-bg` and `parallax-reveal` `@utility` blocks + their `@theme inline` keyframes, copying the structural pattern of `scroll-fade-t` (lines 289–317): `@supports (…)` with the timeline animation, `@supports not (…)` fallback, explicit `prefers-reduced-motion: no-preference` gate.
- Keyframes animate `transform: translate3d(...)` (bg: drift; reveal: opacity + translateY) values only.
- Verify: `npm run lint`; visually the utilities exist after `npm run dev` rebuilds CSS.

### Task 2: Hero background layer in `src/features/public-site/HomeHero.jsx`
- The `<section>` keeps `relative overflow-hidden bg-[#f7faff]` but loses the inline `style={{ backgroundImage: … }}`; that exact gradient-over-image value moves to a new inner layer:
  `<div aria-hidden className="absolute inset-x-0 -inset-y-[80px] parallax-bg" style={{ backgroundImage: … }} />`
  (existing `page-container` content stays above it — it is already `relative`).
- Do **not** touch `hero-float` cards (`display: none` dead code).

### Task 3: Section reveals in `src/features/public-site/CommunitySections.jsx`
- Add `parallax-reveal` to the below-fold section wrappers: the `#how-it-works` step grid, the `#about` grid, and the communities section wrapper. One class per container; no per-card stagger.

### Task 4: Smoke test `src/features/public-site/__tests__/Landing.parallax.test.jsx`
- Render `Landing` in `MemoryRouter` (same mock shape as `Landing.routing.test.jsx`).
- Assertions: `.parallax-bg` exists inside the hero `<section>`; the hero section keeps `overflow-hidden`; at least one `.parallax-reveal` element renders.
- jsdom cannot exercise scroll timelines — this test pins structure and the fallback path (no animation applied → content still renders). Behavioral proof is the visual pass below.

## Review focus (failure modes → owning check)

1. Browser without scroll-driven animations → all content visible and static (Task 4 asserts render; structure test doubles as fallback proof).
2. Reduced-motion users → identical to today's static page (global kill-switch + utility gate; manual DevTools rendering-emulation check).
3. Exposed background edge at deep scroll → layer inset extends ±depth (manual scroll-to-bottom check on Landing).
4. Hero pre-shifted at first paint → `scroll(root)` not `view()` (manual load-at-top check).
5. Landing anchor-scroll regressions (`/#how-it-works`, `/#about`, `/#communities`) → `Landing.anchorScroll.test.jsx` stays green; smooth-scroll sweep of reveals verified visually once.

## Verification

- `npm test` — full suite green (Landing tests unaffected by the bg-layer extraction).
- `npm run lint`, `npm run build` — CSS-only delta (~3 KB).
- `npm run dev` manual pass, Chrome + mobile emulation: bg drifts visibly slower than content; sections fade-rise once each; DevTools Performance shows no long frames / no main-thread animation work; no CLS; reduced-motion emulation is static.

## Out of scope

- `hero-float` cards (dead code — `display: none`), resurrecting or animating them.
- Any page other than Landing (PublicJobs, portals, auth).
- Scroll-snapping, smooth-scroll changes, progress indicators.
- New motion dependencies (framer-motion/GSAP) — rejected in ADR-045.

## Handoff

On sign-off: `frontend` agent executes Tasks 1→3 in order, then Task 4; `review` agent for the branch review.
