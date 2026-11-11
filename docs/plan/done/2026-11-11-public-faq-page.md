# Plan: Public `/faq` page

**Status:** APPROVED — signed off 2026-11-11
**Owner:** Lead Architect → hand off to `frontend`

## Decision

"Explore all FAQs" promised a destination that did not exist; it pointed at `/#faq`, the section it already sits in, so clicking visibly did nothing. Add a real public page at `/faq` listing all six entries from the existing `FAQS` constant, and point the landing link there. Informational page → **not** wrapped in `PublicRoute` (same rationale as `/privacy`, `/terms`: do not destroy a live session for reading a page).

## Changes

### Create `src/features/public-site/Faq.jsx`
- `PublicShell` wrapper; `page-container py-16`; centred `max-w-[720px]` column.
- `p.eyebrow` "A little clarity goes a long way" (landing copy), `h1.section-heading` "Frequently asked questions", `p.section-copy` one line: "Everything job seekers and employers ask us most, in one place."
- `<Accordion>` (same Base UI wrapper, no `type` prop) mapping **all** `FAQS` with `value={`faq-${i}`}`, `AccordionItem className="border-b"`, `AccordionTrigger className="min-h-16 text-sm font-medium text-navy"`, `AccordionContent className="text-xs leading-7 text-muted-foreground"`. Reuse the exact markup pattern from `CommunitySections.jsx`, minus `.slice(0, 4)`.

### Modify `src/shared/lib/routeLoaders.js`
- Add `'/faq': () => import('../../features/public-site/Faq'),` beside `'/jobs'`.

### Modify `src/App.jsx`
- `const Faq = route('/faq')` with the other public pages.
- `<Route path="/faq" element={<Faq />} />` after the `/jobs/:jobId` route. No `PublicRoute`.

### Modify `src/shared/lib/usePageTitle.js`
- `'/faq': 'Frequently asked questions — JobLinked',`.

### Modify `src/features/public-site/CommunitySections.jsx`
- `<Link to="/faq" className="text-link text-xs">Explore all FAQs…` (was `to="/#faq"`).

### Tests
- Create `src/features/public-site/__tests__/Faq.test.jsx`: mock `../../../shared/hooks/useAuth` (`{ user: null, loading: false }`), render inside `MemoryRouter`, assert the `h1` "Frequently asked questions" and that every `FAQS` question renders (`FAQS.forEach(f => screen.getByText(f.question))`).
- `Landing.routing.test.jsx`: add `['Explore all FAQs', '/faq']` to `expected`.

## Out of scope

Header/footer FAQ links (keep `/#faq`), landing accordion count, new FAQ copy, `PublicRoute` behaviour.

## Verification

- `npx vitest run src/features/public-site/__tests__/Landing.routing.test.jsx src/features/public-site/__tests__/Faq.test.jsx`
- `npm run lint`
