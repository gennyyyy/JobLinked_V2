# ADR-051: Letter-reveal heading animation — system-wide, alongside parallax

**Status:** Accepted (planned 2026-11-13)
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
  itself remains public-site-only per ADR-045. Dialog content (session-expiring
  modal, job-post detail dialog) opts out with `animated={false}`: repeated
  modal entrances must not re-play a letter cascade.
- **Safety**: reduced motion renders static (JS guard + CSS override; text can
  never be invisible); no IntersectionObserver → static; >160-char strings →
  unsplit; per-letter blur is small (6 px, 500 ms, letters only) so filter cost
  stays trivial; no `will-change`.

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
