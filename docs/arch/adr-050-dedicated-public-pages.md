# ADR-050: Dedicated public pages for About and PESO Services (and FAQ nav)

Date: 2026-11-13
Status: Accepted

## Context

The landing nav bar lists six items. Three of them — "PESO Services", "About", "FAQ" —
are in-page anchors (`/#peso-services`, `/#about`, `/#faq`) rather than routes, so a
visitor on another public page cannot reach those sections without first returning to `/`.
"How It Works" already has a dedicated route (`/how-it-works`), making the nav
inconsistent. FAQ already has a dedicated route (`/faq`) but its nav link still points
at the anchor.

## Decision

- Add dedicated public routes `/about` and `/peso-services`, mirroring the existing
  `/faq` and `/how-it-works` pattern (not wrapped in `PublicRoute`, so a live session
  is not destroyed by reading).
- Point the public nav bar links at the dedicated routes: "PESO Services" →
  `/peso-services`, "About" → `/about`, "FAQ" → `/faq`.
- Keep the landing page sections and their anchor ids (`#peso-services`, `#about`,
  `#faq`) as previews; the in-page "Explore …" CTAs point at the dedicated routes.
- Footer links stay as anchors (out of scope, matches the prior `/faq` decision).
- Page titles added to `usePageTitle` for the new routes.

## Consequences

- Landing.routing tests that assert the nav PESO Services href must move from
  `/#peso-services` to `/peso-services`; the frontend agent updates them.
- Two new page components under `src/features/public-site/`.
- No schema or API changes.

Implementation plan: docs/plan/2026-11-13-dedicated-public-pages.md