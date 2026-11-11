# ADR-045: Native CSS scroll-driven parallax — perceptual responsiveness layer

**Status:** Accepted (signed off 2026-11-11 by Lead Architect; implemented same day)
**Date:** 2026-11-11
**Owner:** Lead Architect

## Context

The public landing page should *feel* fast and alive. Parallax — background layers drifting slower than content, sections rising as they enter the viewport — is a perceptual trick: motion constantly synchronized to the user's own scroll input reads as "this app responds instantly," even though it does no real work. It must cost nothing where it counts: no main-thread JS per frame, no re-renders, no layout shift, and zero impact on reduced-motion users and browsers lacking support.

## Decision

Implement parallax with **native CSS scroll-driven animations** (`animation-timeline: scroll()/view()`), built as Tailwind v4 `@utility` definitions in `src/index.css`, following the exact pattern already established by the `scroll-fade` utilities in the same file (keyframes in `@theme inline`, `animation-timeline` inside `@supports`, silent static fallback inside `@supports not`).

Rejected alternatives:

- **framer-motion (`useScroll`/`useTransform`)** — ~30–50 KB new dependency and JS-transform work on the main thread. A motion layer whose justification is perceived speed must not add main-thread cost; rejected.
- **GSAP ScrollTrigger** — same cost class, heavier API surface than needed for two effects; rejected.
- **`position: fixed` / `background-attachment: fixed` hero** — breaks on iOS Safari and hijacks compositor strategy; rejected.

## Consequences

- **Compositor-only**: utilities animate only `transform` and `opacity`; the browser runs the animation off the main thread, frame-synced to scroll. No JS listeners, no React state, no re-renders.
- **Fallback = static**: browsers without scroll-driven animations get today's design exactly; elements are never left invisible (base styles are visible; keyframes only live under `@supports`).
- **Reduced motion**: the global kill-switch in `src/index.css` (`@media (prefers-reduced-motion: reduce) { * { animation: none !important } }`) disables everything automatically; utilities additionally gate on `(prefers-reduced-motion: no-preference)` for explicitness, matching the `shimmer` precedent.
- **Pre-shift pitfall avoided**: the hero background uses the `scroll(root)` timeline (starts at 0 at page load), not `view()`, so the hero is not already offset at first paint.
- **Scope discipline**: motion is limited to the public marketing surface (Landing: hero + community sections). Auth screens, employer/job-seeker/super-admin portals stay static — motion subtracts from task-focused UI.
- No database, API, or state-management impact (pure presentation).
