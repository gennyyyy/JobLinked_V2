# ADR-064: Reduced motion suppresses animations, not functional transitions

**Status:** Accepted (signed off 2026-11-28 by Lead Architect; implemented same day)
**Date:** 2026-11-28
**Owner:** Lead Architect

## Context

The global reduced-motion reset in `src/index.css` was:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```

On Windows machines with **Settings → Accessibility → Visual effects → Animation effects** off (a common configuration), Chromium reports `prefers-reduced-motion: reduce`, so every transition in the app snapped instantly. That included the sidebar collapse/expand animation implemented 2026-11-28 (commits `1c4e159`, `ed02c87`): users on those machines could not see it without changing their OS or browser settings. Extremely few users should ever have to alter an accessibility setting to receive ordinary UI state feedback.

WCAG 2.3.3 (Animation from Interactions, AAA) permits motion **essential to the information being conveyed**; a sidebar collapse communicates a layout state change. The motion guidance category that matters is continuous, decorative, parallax, or attention-seeking animation — not a 300ms, user-initiated, one-shot layout transition.

Audit of all `transition` declarations in the app (2026-11-28): sidebar width/margin/padding (300ms), nav-link colors/padding/gap (300ms), job-card hover lift (200ms), terms progress width (150ms), plus Tailwind `transition-colors` hover feedback. All are short, one-shot, state- or feedback-conveying. No looping, parallax, or large-distance transition exists. Long/continuous motion in this app is implemented exclusively as keyframe `animation`s (scroll parallax, shimmer, letter reveal, page entrances, Sheet slide, dialog zoom).

## Decision

Narrow the global reset: under `prefers-reduced-motion: reduce`, suppress **`animation` and `scroll-behavior` only**; let short, functional `transition`s run.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; scroll-behavior: auto !important; }
  /* animate-spin / animate-pulse stay alive (unchanged). */
}
```

Rejected alternatives:

- **Sidebar-only exemption** (re-declare its transition properties with `!important` inside the media query) — duplicates Tailwind values in a second place that drifts whenever the JSX changes; five rules of maintenance debt for one visible effect; rejected.
- **Status quo + documentation** — requires users to flip an OS accessibility setting to see intended feedback; rejected as the product behavior.
- **Reduced motion = opacity-only crossfade for the sidebar** — requires per-element media-query overrides and a second motion design to maintain; the 300ms width ease is already mild and one-shot; deferred unless feedback says otherwise.

## Consequences

- Reduced-motion users see: sidebar collapse/expand (width, margin, padding, label fade), hover/focus color feedback, job-card hover lift — all one-shot, user-initiated, ≤300ms.
- Still suppressed for reduced-motion users: scroll parallax, scroll-fade, shimmer, letter reveal, page entrance, Sheet slide, dialog zoom (all keyframe animations). Mobile sidebar motion remains unchanged/instant — acceptable; revisit only on request.
- **Guardrail:** any transition introduced from now on must stay ≤300ms, one-shot, and functional/feedback in nature. Continuous, looping, parallax, or attention-seeking motion must be implemented as `animation` so the reduced-motion reset suppresses it.
- Pure presentation change: no API, database, or state-management impact.
- Implements the policy for the 2026-11-28 sidebar animation; supersedes the implicit "kill all motion" policy of ADR-045 for transitions only (ADR-045's animations remain covered).
