# ADR-051: Letter-reveal heading animation — system-wide, alongside parallax

**Status:** Accepted (signed off 2026-11-13; implemented 2026-11-14)
**Date:** 2026-11-13
**Owner:** Lead Architect

## Context

A signature heading effect was requested system-wide: each letter of an H3
heading fades in, slides up, and un-blurs, staggered left-to-right. ADR-045
established the motion language for the app: native CSS scroll-driven
animations, compositor-only, fallback = static, and — critically — motion
scoped to the public marketing surface while portals stayed static.

## Decision

- **Effect class is different from parallax**: the letter reveal is a one-shot,
  time-based entrance (opacity + translateY + blur→0, staggered 25 ms/letter,
  capped at 600 ms), triggered once by IntersectionObserver — not scrubbed by
  scroll. It therefore does not amend ADR-045's parallax implementation in any
  way: no shared keyframes (named `letter-reveal`, never `enter`), no shared
  selectors, no changes to `.parallax-bg` / `.parallax-reveal` / `scroll-fade`.
- **Delivery**: one shared `H3` component in `src/shared/components/design.jsx`
  plus `[data-letter-reveal]` CSS in `src/index.css`. All h3 headings render
  through it (string children get the reveal; non-string children and
  `animated={false}` render as plain styled headings).
- **Scope**: system-wide per product decision (2026-11-13), which supersedes
  ADR-045's "portals stay static" line for one-shot text reveals only. Parallax
  itself remains public-site-only per ADR-045. Dialog content opts out with
  `animated={false}`: dialog libraries unmount content on close, so every open
  would replay the cascade — this applies to ALL dialog-hosted headings,
  blocking/expiring modals included.
- **Safety**: reduced motion keeps the letter cascade as a fade-only animation
  (no translate, no blur; 320 ms); print renders static and fully visible; no
  IntersectionObserver → static; >160-char strings → unsplit; per-letter blur
  is small (6 px, 500 ms, letters only) so filter cost stays trivial; no
  `will-change`.

Rejected: framer-motion / GSAP split-text (dependency + main-thread cost,
contra ADR-045's reasoning); scroll-driven `view()` timelines for letters
(per-letter staggering is not expressible across wrapped lines, and Firefox
support is absent); reusing tw-animate-css `animate-in`+`blur-in` (the local
`@keyframes enter` at src/index.css:763 shadows tw-animate's `enter`, silently
dropping blur/translate variables).

## Consequences

- One heading primitive for the whole app; portals gain one short entrance
  motion while remaining task-focused (plays once per mount, ~0.5–1.1 s).
- Parallax and letter reveal compose visually where nested (section reveals
  while its headings cascade) — both are entry-triggered, never competing for
  the same properties on the same element.
- Pure presentation: no database, API, or state-management impact.
- In this checkout `.parallax-bg` / `.parallax-reveal` exist as marker classes
  only; no scroll-timeline CSS is present yet (ADR-045 is the intended design).
  Coexistence is therefore structural today — the markers and their test are
  untouched.
- **Amendment (2026-11-14):** reduced-motion visitors previously got no
  animation; product feedback was that requiring an OS setting change to see
  any effect is unacceptable. The fade-only variant keeps the effect for every
  visitor while removing vestibular-triggering motion (slide/blur).
- **Amendment (2026-11-14):** the landing hero `<h1>` now uses the same reveal.
  Rich heading children are supported — text is split per segment while `<br>`
  and inline `<span>` wrappers (including color classes) are preserved; the
  accessible name is the flattened plain text.
- **Amendment (2026-11-14):** the landing page now reveals its marketing copy —
  section eyebrows, h2 headings, intro/description paragraphs, PESO card
  descriptions, FAQ questions, the "Explore all FAQs" label, and the community
  stat numbers (labels excluded). The footer group headings are explicitly
  excluded per product direction.
- **Amendment (2026-11-14):** timing is now two-tier — display (hero H1, h2
  headings, eyebrows, stat numbers) at 320 ms / 20 ms per letter / 480 ms cap,
  and body (card titles, paragraphs, card descriptions, FAQ questions, link
  labels) at 400 ms / 25 ms / 600 ms — body is exactly 25% slower. All five
  landing eyebrows are display tier; the About section's "One platform. A
  stronger community." eyebrow and "Built around people, not paperwork."
  heading joined the reveal. Footer remains excluded.
- **Amendment (2026-11-15):** community stat numbers use a count-up (0 → value,
  800 ms ease-out) instead of the letter reveal, triggered by the same one-shot
  in-view observer; it runs regardless of `prefers-reduced-motion` (a changing
  value is not vestibular motion), and only environments without
  IntersectionObserver render the final value immediately; the 30 s data
  refresh updates the number without re-counting.
- **Amendment (2026-11-15):** every timing was scaled ×0.75 — display 240 ms /
  15 ms per letter / 360 ms cap; body 300 ms / 18.75 ms / 450 ms cap (still
  exactly 1.25× display); count-up 600 ms; reduced-motion fades 195 ms / 244 ms.
- **Amendment (2026-11-15):** super-admin numeric cards (dashboard,
  applications, reports, employment, user management — 27 cards) use the
  count-up on first visibility. The shared `StatCards` exposes an opt-in
  `countUp` prop; job-seeker and employer dashboards are unchanged.
