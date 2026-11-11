# Plan: Point the PESO service cards at real routes

**Status:** APPROVED — signed off 2026-11-11 (revised after implementation finding)
**Owner:** Lead Architect → hand off to `frontend`

## Decision

Public routes are `/`, `/jobs`, `/jobs/:id`, legal, auth, and the three portals. No job-fairs, guidance, or training pages exist. Therefore:

- **Job matching & placement** (featured card) → `/jobs`.
- The other three cards → `/#peso-services` until their pages exist.
- Left-column "Explore PESO services" link unchanged in destination.

**Finding:** `react-router-dom` `Link` takes `to`, not `href`. Every raw `<Link href=...>` in `CommunitySections.jsx` and `HomeHero.jsx` renders `href="/"` — the cards never navigated. Fixing the prop is required for the approved destinations to exist at all. `LinkButton` is correct (`href` in its API, maps to `to` internally).

## Changes

### `src/features/public-site/CommunitySections.jsx`
- Featured card: `<Link to="/jobs" className="flex flex-col gap-4 rounded-2xl border border-primary/20 ...">` (already applied).
- Convert the remaining raw `<Link ... href=...>` to `to=` (4 attributes, no markup change):
  - About-section card link `<Link className="text-link mt-auto text-xs" href={href}>`
  - Left column `<Link href="/#peso-services" className="text-link mt-5">`
  - Service tiles `<Link href="/#peso-services" key={title} ...>`
  - FAQ `<Link href="/#faq" className="text-link text-xs">`

### `src/features/public-site/HomeHero.jsx`
- `<Link href="/jobs" className="hero-float ...">` → `to="/jobs"` (same defect, same page, dead CTA).

### `src/features/public-site/__tests__/Landing.routing.test.jsx`
- `expected` gains `['Job matching & placement', '/jobs']`, `['Community job fairs', '/#peso-services']`, `['Career guidance', '/#peso-services']`, `['Skills & livelihood training', '/#peso-services']`.
- Second test: assert **every** link matching `/peso services/i` has `href="/#peso-services"` (currently only `[0]`, which matches the header link and never checked the section).

## Out of scope

New pages/routes, footer `href="#"` program links, other landing sections.

## Verification

- `npx vitest run src/features/public-site/__tests__/Landing.routing.test.jsx`
- `npm run lint`
