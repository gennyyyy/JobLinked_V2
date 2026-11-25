# Public-site heading animation parity

**Status:** approved by user 2026-11-26
- About: animate the audience-card headings on both surfaces.
- PESO services: numbered, blue, animated treatment on `/peso-services` only.

## Scope

### A. Audience card headings (About + homepage About section)

`src/features/public-site/AudienceCards.jsx` renders a raw `<Heading>` tag, so the three
titles ("For job seekers", "For local employers", "For PESO personnel") never animate.

- Import `RevealText` from `@/shared/components/design`.
- Render `<RevealText as={Heading} className="text-lg font-semibold">{title}</RevealText>`.
- Keep the `headingTag` prop contract: `h2` on `/about`, `h3` on the homepage.
- Reuses the existing letter-reveal from `design.jsx` (ADR-051); no new keyframes.

### B. PESO services page (`src/features/public-site/PesoServices.jsx`)

Follow the How It Works step design:

- Map with the index; render the eyebrow
  `<p className="text-xs font-semibold tracking-[0.16em] text-primary tabular-nums">01</p>`
  (zero-padded `String(index + 1).padStart(2, '0')`).
- Title becomes `<RevealText as="h2" className="text-lg font-semibold">{title}</RevealText>`
  so it gets the same letter-reveal. Keep it an `h2` — `PesoServices.test.jsx` asserts
  heading level 2 and `RevealText` takes an `as` prop.
- Match the step list rhythm: `className="grid gap-x-10 gap-y-8 sm:grid-cols-2"` and
  `className="border-t border-border pt-5"` per item.
- Keep the three `What it is / Who it's for / How to get it` rows and their classes as-is.
- Homepage PESO Services section (`CommunitySections.jsx`) is out of scope.

## Out of scope

- New animation primitives, stagger changes, or CSS edits in `index.css`.
- Copy changes on either page.
- Homepage PESO Services section; it already uses animated `H3` + `RevealText`.
- Any employer, auth, or super-admin surface.

## Done when

- `/about` audience headings and the homepage audience headings split into animated letters
  (`data-letter-reveal`) and keep their heading levels and accessible names.
- `/peso-services` shows `01`–`04` in `text-primary` above each service, titles animate, and
  the three description rows are unchanged.
- `npx vitest run src/features/public-site` and `npm run lint` pass with real output shown.
  Existing tests should pass without edits; if a level/name assertion genuinely needs updating,
  report it rather than weakening it.
