# Plan: Emphasize the Job matching & placement card in `#peso-services`

**Status:** APPROVED — signed off 2026-11-11
**Owner:** Lead Architect → hand off to `frontend`

## Decision

In the landing-page section "You don't have to take the next step alone." (`src/features/public-site/CommunitySections.jsx`, `#peso-services`), the four PESO services are equal-weight 2×2 cards. Make **Job matching & placement** the hero: full-width tinted card above a row of three compact secondary tiles.

Visual only. No API, routing, schema, state, or copy changes.

## Changes

### `src/features/public-site/CommunitySections.jsx` (single minified line — surgical edit)

Replace the right-column block:

```jsx
<div className="grid gap-4 sm:grid-cols-2">{[{ icon: Handshake, ... }].map(...)}</div>
```

with:

1. **Featured card** — `<Link href="/#peso-services">`, `flex flex-col gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-blue-soft to-white p-6 transition-all hover:border-primary/40 hover:shadow-md sm:flex-row sm:items-center sm:gap-5`
   - Icon tile: `flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm sm:size-14`, `<Handshake className="size-6 sm:size-7" strokeWidth={1.5}/>`
   - Title: `text-lg font-semibold tracking-tight text-navy sm:text-xl` — "Job matching & placement"
   - Desc: `mt-2 max-w-xs text-xs leading-6 text-muted-foreground sm:text-sm` — "Connect with opportunities that fit."
   - Trailing `<ArrowRight className="ml-auto hidden size-5 shrink-0 text-primary sm:block"/>`
2. **Secondary tiles** — `grid gap-3 sm:grid-cols-3`; each `<Link href="/#peso-services">` with `flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30`; icon `size-5 text-teal`, title `text-[11px] font-semibold leading-snug`, desc `text-[10px] leading-relaxed text-muted-foreground`. Keep the three existing items and order (job fairs, career guidance, skills training).

Keep: `id="peso-services"`, every `href="/#peso-services"`, left column untouched, all existing imports (`Handshake`, `ArrowRight`, `CalendarDays`, `GraduationCap`, `Sparkles` already imported). Do not reformat the rest of the file.

## Out of scope

Section heading/copy, other landing sections, `Landing.jsx`, reference app, shared `surface` class.

## Verification

- `npx vitest run src/features/public-site/__tests__/Landing.routing.test.jsx` — anchor + CTA routes still pass.
- `npm run lint`
- Manual: featured card reads first at every breakpoint; 3 tiles stack on mobile.
