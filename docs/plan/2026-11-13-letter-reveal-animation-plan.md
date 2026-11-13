# Letter-Reveal Heading Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every `h3` heading in the system renders through one shared `H3` component whose text animates letter-by-letter (fade in + slide up + blur→sharp), coexisting with the native-CSS scroll parallax (ADR-045) without touching it.

**Architecture:** One shared React component (`H3` in `src/shared/components/design.jsx`) splits string children into word/letter spans and reveals them with a time-based, IntersectionObserver-triggered one-shot animation. The animation lives as its own `letter-reveal` keyframes + `[data-letter-reveal]` selectors in `src/index.css`, deliberately separate from the scroll-driven parallax utilities (ADR-045): different keyframe names, different trigger model, no shared selectors. Dialogs opt out via `animated={false}`.

**Tech Stack:** React 19 (JSX, no TypeScript), Tailwind CSS v4 utilities, native `IntersectionObserver` + `matchMedia`, plain CSS keyframes in `src/index.css`. No new dependencies.

**Spec:** Source of truth = user request (2026-11-13): *"complex animation that fades in, slides up, and reduces blur for each letter… implemented all throughout the entire system… must not overwrite the current parallax animation but work alongside it."* Context constraints from ADR-045 (`docs/arch/adr-045-native-css-scroll-parallax.md`). Task 1 records the decision as ADR-051.

## Global Constraints

Every task implicitly includes these:

- JavaScript/JSX only — no TypeScript (repo rule).
- No new npm dependencies; `tw-animate-css` is installed but must NOT be used for the letters (see Review Focus #5).
- Do not modify: `.parallax-bg` / `.parallax-reveal` markup or markers, the `scroll-fade` / `scroll-fade-y` utilities, `.hero-enter`, `.hero-float`, or `@keyframes enter` (`src/index.css:763`).
- The letter keyframes must be named `letter-reveal` — never `enter` or `exit` (name collision with `src/index.css:763` and `tw-animate-css`).
- Reduced motion: heading text must NEVER be invisible. JS skips the animation path entirely under `prefers-reduced-motion: reduce`, and a CSS override un-hides letters even if `data-state="hidden"` is somehow set.
- One-shot per mount: no scroll-synced scrubbing, no infinite loops, no `will-change`.
- Strings longer than 160 characters render unsplit (no letter spans).
- Per-letter delay: `Math.min(index * 25, 600)` ms. Duration: 500 ms. Easing: `cubic-bezier(0.22, 1, 0.36, 1)`. From-state: `opacity: 0; transform: translateY(0.35em); filter: blur(6px)`. To-state: all neutral.
- Presentation-only: no changes to `db/`, `server/`, API contracts, or state management.
- Tests: Vitest + Testing Library, `*.test.jsx` near the code (repo rule). Run `npm test` and `npm run lint` before each commit.

## Review Focus

Failure modes the spec implies but that component tests alone don't fully exercise:

1. **Coexistence with parallax** — animated H3s sit inside `.parallax-reveal` sections (CommunitySections) and near `.parallax-bg`/`.hero-enter` (Landing hero). Expected: markers untouched, both effects compose (section reveal + letter cascade). Pinned by the *existing, unmodified* `src/features/public-site/__tests__/Landing.parallax.test.jsx` staying green (Task 3) and the git diff never touching parallax classes (Task 6).
2. **Long headings in lists** (role names, job titles) — delay must cap at 600 ms and strings >160 chars must render unsplit. Pinned: Task 2 (delay-cap test, length test in the >160 assertion).
3. **Reduced-motion users** — text visible immediately, no hidden-state flash. Pinned: Task 2 reduced-motion test + CSS override (verify selector present in built CSS, Task 6).
4. **Multi-line/wrapped headings** — words break only between words (word wrappers), spaces preserved, `text-wrap: balance` (base layer `h1–h4` rule) still applies. Pinned: Task 2 word-structure test.
5. **`enter` keyframe shadowing** — `src/index.css:763` redefines `@keyframes enter` after the `tw-animate-css` import, so its simplified keyframe wins the name; any tw-animate `animate-in`+`blur-in` usage would silently lose blur/translate. The letter animation must therefore use its own `letter-reveal` keyframes. Pinned: Task 1 verification (grep built CSS).

---

### Task 1: `letter-reveal` CSS + ADR-051

**Files:**
- Modify: `src/index.css` (insert immediately after `@keyframes enter`, currently line 763)
- Create: `docs/arch/adr-051-letter-reveal-system-wide.md`

**Interfaces:**
- Produces (consumed by Task 2): selectors `[data-letter-reveal][data-state='hidden'] .ltr`, `[data-letter-reveal][data-state='run'] .ltr`, keyframes `letter-reveal`.

- [ ] **Step 1: Append the CSS block to `src/index.css` after `@keyframes enter { … }` (line ~763), before the `prefers-reduced-motion` global block at 764**

```css
/* Letter reveal — one-shot staggered heading entrance (ADR-051). Time-based and
   deliberately separate from the scroll-driven parallax (ADR-045): no shared
   keyframes; .parallax-* and scroll-fade utilities untouched. */
[data-letter-reveal][data-state='hidden'] .ltr { opacity: 0; }
[data-letter-reveal][data-state='run'] .ltr {
  animation: letter-reveal 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes letter-reveal {
  from { opacity: 0; transform: translateY(0.35em); filter: blur(6px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@media (prefers-reduced-motion: reduce) {
  [data-letter-reveal] .ltr {
    animation: none !important; opacity: 1 !important;
    transform: none !important; filter: none !important;
  }
}
```

The hidden state lives only on the JS-applied `data-state="hidden"` attribute (never a base class), so a browser without JS-driven state, without IO, or under reduced motion shows the heading.

- [ ] **Step 2: Write `docs/arch/adr-051-letter-reveal-system-wide.md`**

```markdown
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
```

- [ ] **Step 3: Verify uniqueness of the keyframe name**

Run: `npx vite build 2>$null; Select-String -Path dist\assets\*.css -Pattern "@keyframes letter-reveal" -List | Measure-Object | % Count`
Expected: `1` (exactly one definition in the built bundle; `enter` still defined twice is expected and untouched).

- [ ] **Step 4: Commit**

```bash
git add src/index.css docs/arch/adr-051-letter-reveal-system-wide.md
git commit -m "feat(motion): add letter-reveal keyframes and ADR-051"
```

### Task 2: Shared `H3` component (test-first)

**Files:**
- Modify: `src/shared/components/design.jsx` (add export at end of file)
- Test: `src/shared/components/__tests__/H3.test.jsx` (new)

**Interfaces:**
- Consumes: Task 1 CSS selectors; existing `cn` from `@/lib/utils` (already imported in design.jsx).
- Produces (consumed by Tasks 3–5): `H3({ children, className, animated = true, size = 'plain', ...props })` exported from `@/shared/components/design` (relative path `../../shared/components/design` also valid). Renders `<h3>` with base classes `font-semibold text-navy tracking-[-0.03em] transition-colors duration-300` merged under `className` (tailwind-merge; caller classes win).
- **Size must NOT be in the base classes.** Base includes no `text-*` size: tailwind-merge drops a caller's `text-xs` (same group) but keeps an un-paired `sm:text-2xl` from the base, which would win at ≥640px and blow up every small portal heading. All 13 rollout call-sites pass explicit sizes, so default `size='plain'` (no size classes); `size='display'` opt-in adds `text-xl sm:text-2xl` — the responsive display look for hero/section headings described in the brief.

Pinned behavior:

- **Static path** (no animation): string children with `animated={false}`, non-string children, strings >160 chars, reduced motion (`window.matchMedia('(prefers-reduced-motion: reduce)').matches` — guard with `?.`), or missing `IntersectionObserver` → `<h3 className={cn(BASE, className)} {...props}>{children}</h3>`. No `aria-label`, no `data-*`.
- **Animated path**: `<h3 aria-label={text} data-letter-reveal data-state={state} …>` containing one `<span aria-hidden="true">` split container. Text split on `/\s+/` into words; between word spans a plain `' '` text node; each word `<span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>`; each letter `<span className="ltr" style={{ display: 'inline-block', animationDelay: `${Math.min(i * 25, 600)}ms` }}>` where `i` is the global letter index (continuous cascade across words).
- **State machine** (only in animated path): `state` starts `'hidden'`; `useEffect` creates `new IntersectionObserver(([entry], obs) => { if (entry.isIntersecting) { setState('run'); obs.disconnect(); } })`, observes the h3 element, cleans up with `disconnect()` on unmount. Wrap the observe call in try/catch; on error `setState('run')` (never trap text invisible).

- [ ] **Step 1: Write the failing tests**

```jsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { H3 } from '../design'

let reduced = false
class IOStub {
  static instances = []
  constructor(cb) { this.cb = cb; IOStub.instances.push(this) }
  observe() { this.cb([{ isIntersecting: true }], this) }
  unobserve() {}
  disconnect() { this.disconnected = true }
}
class IOStubSilent extends IOStub { observe() { /* stays hidden until scrolled */ } }

beforeEach(() => {
  window.IntersectionObserver = IOStub
  IOStub.instances = []
  vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce') && reduced }))
})
afterEach(() => { reduced = false; vi.unstubAllGlobals(); delete window.IntersectionObserver; cleanup() })

describe('H3', () => {
  it('renders static when IntersectionObserver is missing', () => {
    delete window.IntersectionObserver
    const { container } = render(<H3 className="text-xs">Qualifications</H3>)
    const h3 = container.querySelector('h3')
    expect(h3).toHaveTextContent('Qualifications')
    expect(h3).not.toHaveAttribute('data-letter-reveal')
    expect(h3).not.toHaveAttribute('aria-label')
  })

  it('splits animated text into staggered letter spans with a11y labels', () => {
    const { container } = render(<H3>Apply today</H3>)
    const h3 = container.querySelector('h3')
    expect(h3).toHaveAttribute('aria-label', 'Apply today')
    expect(h3).toHaveAttribute('data-letter-reveal')
    const split = h3.querySelector('span[aria-hidden="true"]')
    expect(split).not.toBeNull()
    expect(split.textContent).toBe('Apply today') // spaces preserved as text nodes
    const letters = split.querySelectorAll('.ltr')
    expect(letters.length).toBe('Apply today'.replace(' ', '').length)
    expect(letters[0].style.animationDelay).toBe('0ms')
    expect(letters[1].style.animationDelay).toBe('25ms')
  })

  it('caps the stagger delay at 600ms', () => {
    const { container } = render(<H3>{'a'.repeat(40)}</H3>)
    const letters = container.querySelectorAll('.ltr')
    expect(letters[29].style.animationDelay).toBe('600ms')
  })

  it('renders unsplit for strings over 160 characters', () => {
    const { container } = render(<H3>{'word '.repeat(40)}</H3>)
    expect(container.querySelector('h3')).not.toHaveAttribute('data-letter-reveal')
    expect(container.querySelectorAll('.ltr')).toHaveLength(0)
  })

  it('renders static under reduced motion even with IO available', () => {
    reduced = true
    const { container } = render(<H3>Session Expiring</H3>)
    expect(container.querySelector('h3')).not.toHaveAttribute('data-letter-reveal')
    expect(container.querySelectorAll('.ltr')).toHaveLength(0)
  })

  it('stays hidden until observed, then reveals once', () => {
    window.IntersectionObserver = IOStubSilent
    const { container } = render(<H3>Journey</H3>)
    expect(container.querySelector('h3')).toHaveAttribute('data-state', 'hidden')
    IOStub.instances[0].cb([{ isIntersecting: true }], IOStub.instances[0])
    expect(container.querySelector('h3')).toHaveAttribute('data-state', 'run')
  })

  it('animated={false} renders plain text even with IO', () => {
    const { container } = render(<H3 animated={false}>Plain</H3>)
    expect(container.querySelector('h3')).not.toHaveAttribute('data-letter-reveal')
  })

  it('non-string children render unchanged', () => {
    const { container } = render(<H3><span data-testid="x">JobLinked</span></H3>)
    expect(container.querySelector('h3').contains(container.querySelector('[data-testid="x"]'))).toBe(true)
    expect(container.querySelector('h3')).not.toHaveAttribute('data-letter-reveal')
  })

  it('merges className with tailwind-merge (caller wins)', () => {
    const { container } = render(<H3 className="text-xs">X</H3>)
    expect(container.querySelector('h3').className).toContain('text-xs')
    expect(container.querySelector('h3').className).not.toContain('text-2xl') // no size leaks from base
  })

  it('size="display" adds the responsive display scale', () => {
    const { container } = render(<H3 size="display">Head</H3>)
    const cls = container.querySelector('h3').className
    expect(cls).toContain('text-xl')
    expect(cls).toContain('sm:text-2xl')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/components/__tests__/H3.test.jsx`
Expected: FAIL — `H3` is not exported from `../design`.

- [ ] **Step 3: Implement `H3` at the end of `src/shared/components/design.jsx`**

Signature and pinned behavior as specified above in **Interfaces**. The splitter, delay math, guards, and state machine are fully determined by the pinned values and the tests; write the body from those.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/components/__tests__/H3.test.jsx`
Expected: PASS (10/10).

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/design.jsx src/shared/components/__tests__/H3.test.jsx
git commit -m "feat(design): shared H3 heading with staggered letter reveal"
```

### Task 3: Public-site rollout + parallax coexistence proof

**Files:**
- Modify: `src/features/public-site/CommunitySections.jsx:5,40,68`
- Modify: `src/features/public-site/HowItWorks.jsx:5,123`

**Interfaces:**
- Consumes: `H3` from Task 2.

- [ ] **Step 1: Swap the three public-site h3s**

`CommunitySections.jsx` line 5 → `import { H3, LinkButton } from '../../shared/components/design';`
Line 40 → `<H3 className="mt-3 text-base font-semibold">{title}</H3>`
Line 68 → `<H3 className="text-sm font-semibold">{title}</H3>`

`HowItWorks.jsx` line 5 → `import { H3, LinkButton } from '@/shared/components/design'`
Line 123 → `<H3 className="mt-2 text-base font-semibold text-navy">{item.title}</H3>`

Note: CommunitySections' first h3 lives inside the `section … parallax-reveal` (`id="how-it-works"`). Change nothing on the section element.

- [ ] **Step 2: Prove parallax coexistence — existing test stays green, unmodified**

Run: `npx vitest run src/features/public-site/__tests__/Landing.parallax.test.jsx`
Expected: PASS — `.parallax-bg` layer count and `.parallax-reveal` markers unchanged.

- [ ] **Step 3: Run public-site tests and lint**

Run: `npx vitest run src/features/public-site; npm run lint`
Expected: PASS, 0 lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/public-site
git commit -m "feat(public): letter-reveal H3 on landing section headings"
```

### Task 4: Portal + shared-chrome rollout (animated)

**Files:**
- Modify: `src/features/super-admin/Accreditation.jsx:13,119`
- Modify: `src/features/super-admin/JobPosts.jsx:11,93`
- Modify: `src/features/super-admin/UserManagement.jsx:656` (+ new import)
- Modify: `src/features/super-admin/RoleManagement.jsx:254` (+ new import)
- Modify: `src/features/job-seeker/ResumeAutofill.jsx:78` (+ new import)
- Modify: `src/features/job-seeker/Applications.jsx:12,52`
- Modify: `src/features/job-seeker/Dashboard.jsx:14,163`
- Modify: `src/shared/components/PublicShell.jsx:78` (+ new import)

**Interfaces:**
- Consumes: `H3` from Task 2.

- [ ] **Step 1: Add `H3` to the existing design import in files that already import from it** (Accreditation, JobPosts, Applications, Dashboard).

- [ ] **Step 2: Add a new import line** `import { H3 } from '@/shared/components/design'` to UserManagement, RoleManagement, ResumeAutofill, PublicShell.

- [ ] **Step 3: Swap the eight h3s** (keep every className; change only the tag):

| File | Line | Old |
|---|---|---|
| Accreditation.jsx | 119 | `<h3 className="text-sm font-semibold text-navy">Accreditation documents</h3>` |
| JobPosts.jsx (super-admin) | 93 | `<h3 className="text-xs font-semibold">Qualifications</h3>` |
| UserManagement.jsx | 656 | `<h3 className="text-xs font-semibold text-navy">Resumes</h3>` |
| RoleManagement.jsx | 254 | `<h3 className="truncate text-sm font-semibold text-navy">{role.name}</h3>` |
| ResumeAutofill.jsx | 78 | `<h3 className="text-sm font-medium">Autofill from your resume</h3>` |
| Applications.jsx | 52 | `<h3 className="text-xs font-semibold text-navy">Your application journey</h3>` |
| Dashboard.jsx (job-seeker) | 163 | `<h3 className="text-xs font-semibold leading-5">{application.job?.title \|\| 'Unavailable vacancy'}</h3>` |
| PublicShell.jsx | 78 | `<h3 className="mb-2 text-xs font-semibold">{group.title}</h3>` |

- [ ] **Step 4: Run affected tests and lint**

Run: `npm test; npm run lint`
Expected: full suite PASS, 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/super-admin src/features/job-seeker src/shared/components/PublicShell.jsx
git commit -m "feat(portals): letter-reveal H3 across admin, seeker, and footer headings"
```

### Task 5: Motion-hostile surfaces opt out (`animated={false}`)

**Files:**
- Modify: `src/shared/components/TopNavLayout.jsx:353` (+ new import)
- Modify: `src/features/employer/JobPostDetailDialog.jsx:92` (+ new import)

**Interfaces:**
- Consumes: `H3` from Task 2.

- [ ] **Step 1: Swap both dialog h3s with the opt-out**

`TopNavLayout.jsx` line 353 →
`<H3 animated={false} id="afk-title" className="mb-2 text-lg font-bold text-foreground">Session Expiring</H3>`
(The `id="afk-title"` hook used by the AFK dialog must be preserved.)

`JobPostDetailDialog.jsx` line 92 →
`<H3 animated={false} className="mb-2 text-xs font-semibold text-navy">{label}</H3>`

Rationale (from ADR-051): modals mount on open; a letter cascade on every open is hostile in a task-focused dialog.

- [ ] **Step 2: Run tests and lint**

Run: `npm test; npm run lint`
Expected: PASS, 0 lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/TopNavLayout.jsx src/features/employer/JobPostDetailDialog.jsx
git commit -m "feat(dialogs): opt dialog headings out of letter reveal"
```

### Task 6: Whole-system verification

**Files:** none modified.

- [ ] **Step 1: Full suite + lint + build**

Run: `npm test; npm run lint; npm run build`
Expected: all PASS; build completes.

- [ ] **Step 2: Parallax untouched**

Run: `git diff <commit Task 1 branched from — currently 9bade51> -- src/features/public-site/HomeHero.jsx src/features/public-site/__tests__/Landing.parallax.test.jsx`
Expected: no output (files untouched). CommunitySections' `parallax-reveal` class on line 28 remains (visible in its diff context).

Run: `Select-String -Path dist\assets\*.css -Pattern "parallax|scroll-fade|hero-enter"`
Expected: non-empty — the parallax and hero styles are still in the bundle.

- [ ] **Step 3: Reduced-motion CSS survived the build**

Run: `Select-String -Path dist\assets\*.css -Pattern "prefers-reduced-motion"`
Expected: matches include the letter-reveal override block (opacity forced to 1).

- [ ] **Step 4: Manual smoke (dev server)**

Run: `npm run dev` (one server; check port 5173/4173 per `.env` first and reuse a running one). Verify visually:
1. Landing hero: background + `.hero-enter` H1 behave exactly as before; h1 has NO letter cascade (it is not an h3 — out of scope by design).
2. Scroll to "how-it-works": section reveals while the three step titles cascade once.
3. Scroll further: PESO services card titles cascade once.
4. Portals (employer/job-seeker/super-admin): headings cascade once on first view; navigating back re-runs once per mount (accepted behavior).
5. OS reduced-motion on → all headings fully visible instantly, no hidden flash.

- [ ] **Step 5: Commit any straggler fixes; final state clean**

```bash
git status --short
```
Expected: empty (or only intentional leftovers approved by the user).
