# Plan: Dedicated public pages for About and PESO Services

Status: APPROVED — signed off 2026-11-13
Owner: Lead Architect → hand off to `frontend`

## Decision

Follow the existing `/faq` and `/how-it-works` pattern. Create `/about` and
`/peso-services` public pages, wire routes + loaders + titles, and repoint the
public nav bar (and the landing "Explore" CTAs) at the dedicated routes.

## Changes

### Create `src/features/public-site/About.jsx`
- `PublicShell` wrapper; `page-container py-16`; centred-ish `max-w` column.
- `p.eyebrow` "One platform. A stronger community.", `h1.section-heading` "Built around people, not paperwork.", `p.section-copy` one line.
- Reuse the audience cards (job seekers / employers / PESO personnel) from the
  landing `#about` section, with their CTAs.

### Create `src/features/public-site/PesoServices.jsx`
- `PublicShell` wrapper; `page-container py-16`.
- `p.eyebrow` "Support beyond the job search", `h1.section-heading` "You don't have to take the next step alone.", `p.section-copy` one line.
- Reuse the four PESO service cards, plus the "Program information only…" note.

### Modify `src/shared/lib/routeLoaders.js`
- Add `'/about': () => import('../../features/public-site/About'),`
- Add `'/peso-services': () => import('../../features/public-site/PesoServices'),`

### Modify `src/App.jsx`
- `const About = route('/about')` and `const PesoServices = route('/peso-services')`.
- `<Route path="/about" element={<About />} />` and `<Route path="/peso-services" element={<PesoServices />} />` (no `PublicRoute`).

### Modify `src/shared/lib/usePageTitle.js`
- `'/about': 'About JobLinked',`
- `'/peso-services': 'PESO services — JobLinked',`
- (also add `'/faq': 'Frequently asked questions — JobLinked'` and `'/how-it-works': 'How JobLinked works — JobLinked'` for completeness.)

### Modify `src/shared/components/PublicShell.jsx`
- nav `links`: 'PESO Services' → `/peso-services`, 'About' → `/about`, 'FAQ' → `/faq`.

### Modify `src/features/public-site/CommunitySections.jsx`
- "Explore PESO services" link → `/peso-services` (was `/#peso-services`).

### Tests
- Create `About.test.jsx` and `PesoServices.test.jsx` mirroring `Faq.test.jsx`.
- Update `Landing.routing.test.jsx`: nav PESO Services href `/peso-services`; add About/FAQ dedicated if asserted.

## Out of scope

Footer links (keep anchors), landing section anchors, new copy beyond mirroring.

## Verification

- `npm test`
- `npm run lint`