# Super-Admin Count-Up Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every super-admin card that displays numeric data animates its number from 0 to the real value on first visibility, using the existing `CountUp` primitive (600 ms, ease-out, exact final value).

**Architecture:** Reuse `CountUp` from `src/shared/components/design.jsx` (already used by the landing stats: one-shot in-view observer, 0 → value, reduced-motion safe, `toLocaleString`, no re-count after the first run). `StatCards` gains an opt-in `countUp` prop (default off) so the job-seeker and employer dashboards are untouched; the four super-admin pages swap their bespoke number paragraphs for `CountUp` directly. No CSS changes; no new dependencies.

**Tech Stack:** React 19 (JSX), Tailwind v4, Vitest + Testing Library.

**Spec:** User request (2026-11-15): "every card that display number data" on the super-admin route animates the zero-to-value concept. Precedent: ADR-051 amendments (count-up for community stats; immediate visibility trigger; 600 ms).

## Global Constraints

- No new npm dependencies; JS/JSX only.
- Do NOT touch `src/index.css`, the letter-reveal system, triggers, timings, `.parallax-*`, footer, `db/`, or `server/`.
- `CountUp` behavior is fixed: 600 ms, ease-out, 0 → value, one-shot on first visibility (`rootMargin: "0px"`), runs under reduced motion, exact final frame, later value changes render instantly.
- Non-numeric or null values must render exactly as today (`—` / raw string) — never `NaN`.
- Other portals (job-seeker, employer) must render identically: `StatCards` behaves as before unless `countUp` is passed.
- Accessibility: labels/titles remain the accessible name; no `aria-live`; no per-frame announcements.
- Presentation-only. No API, data, or query changes.

## Review Focus

1. **Loading order** — all five pages render `PageSkeleton` until data resolves, so stat cards mount with final numbers (verified: Dashboard:33, Applications:77, Employment:61, UserManagement:153, Reports renders only when a report exists). A card must never show a "real 0" that was a loading placeholder; keep the skeletons.
2. **Shared-component blast radius** — `StatCards` is used by job-seeker (`Dashboard.jsx:133`) and employer (`Dashboard.jsx:60`) dashboards. Default `countUp=false` must leave their DOM/values unchanged (their tests must stay green).
3. **Non-numeric values** — `StatCards` values could be strings in future; `countUp` must fall back to the plain paragraph.
4. **Live-updating counts** — UserManagement counts change after an invite (list refresh). CountUp counts once per mount; later changes render instantly (accepted; no re-count).
5. **Test compatibility** — jsdom has no `IntersectionObserver`, so `CountUp` renders the final value immediately; existing super-admin tests that assert numbers must stay green without stubs.

## Inventory — every super-admin card with numeric data (27 cards)

| Route | File | Cards |
|---|---|---|
| `/super-admin` | `Dashboard.jsx:66` (`StatCards`) | Registered job seekers · Local employers · Pending accreditations · Active vacancies (4) |
| `/super-admin` | `Dashboard.jsx:74-91` (bespoke row) | applications · accepted · Recorded referrals · placements (3–4, placements conditional) |
| `/super-admin/applications` | `Applications.jsx:93` (`StatCards`) | Applications in view · Recorded referrals · placements · Interview stage (4) |
| `/super-admin/reports` | `Reports.jsx:146` (`StatCards`) | Published vacancy records · applications · Recorded referrals · placements (4) |
| `/super-admin/employment` | `Employment.jsx:64-85` (Panels) | Total hired · Currently active · Resigned or separated · Employers represented · Barangays represented (5) |
| `/super-admin/users` | `UserManagement.jsx:299-306` (Panels) | Total system users · Job seekers · Employers · PESO administrators · Active accounts · Suspended accounts (6) |

**Explicitly excluded** (not cards): chart axes/tooltips (`EmploymentActivityChart`, `EmploymentTypeChart`, `BarangayVacancyChart`), table cells, `Pager` ranges ("1–8 of 26 records"), inline prose numbers in the Reports definitions panel, the unused `StatCard` in `dashboard.jsx:53`, and other portals' stat cards.

---

### Task 1: `StatCards` opt-in count-up

**Files:**
- Modify: `src/shared/components/design.jsx` (`StatCards`)
- Test: `src/shared/components/__tests__/StatCards.test.jsx` (new)

**Interfaces:**
- Produces (consumed by Tasks 2–3): `StatCards({ stats, countUp = false })` — when `countUp` is `true` and a stat's `value` is a finite number, the value renders through `CountUp` with the existing value classes; otherwise it renders exactly as today.

- [ ] **Step 1: Write the failing tests**

```jsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StatCards } from '../design'

afterEach(() => { vi.unstubAllGlobals(); cleanup() })

describe('StatCards', () => {
  it('countUp defaults off: renders plain values', () => {
    const { container } = render(<StatCards stats={[{ label: 'Users', value: 42 }]} />)
    expect(container.querySelector('[data-letter-reveal]')).toBeNull()
    expect(container.textContent).toContain('42')
  })

  it('countUp=true routes numeric values through CountUp (no IO → final value)', () => {
    const { container } = render(<StatCards countUp stats={[{ label: 'Users', value: 42 }]} />)
    expect(container.textContent).toContain('42')
  })

  it('countUp=true leaves non-numeric values as plain text', () => {
    const { container } = render(<StatCards countUp stats={[{ label: 'State', value: '—' }]} />)
    expect(container.textContent).toContain('—')
  })
})
```

- [ ] **Step 2: RED** — `npx vitest run src/shared/components/__tests__/StatCards.test.jsx` (the `countUp` prop is ignored today; test 2 still passes trivially — assert instead that the *same DOM value classes* are produced and that a `CountUp`-rendered `<p>` carries `toLocaleString` output; if the implementer needs a stronger RED signal, assert the count-up element includes `toLocaleString` formatting for `1234` → `1,234`).

- [ ] **Step 3: Implement**

In `StatCards`, accept `countUp = false`. For each stat, replace the value paragraph with:

```jsx
{countUp && typeof value === 'number' && Number.isFinite(value)
  ? <CountUp value={value} className="text-[29px] font-semibold leading-none tracking-tight text-navy" />
  : <p className="text-[29px] font-semibold leading-none tracking-tight text-navy">{value}</p>}
```

`CountUp` renders a `<p>`, so layout and classes are unchanged. Import ordering stays alphabetical.

- [ ] **Step 4: GREEN** — focused test PASS; `npm run lint` clean.

- [ ] **Step 5: Commit** — `feat(stats): opt-in count-up for StatCards`.

### Task 2: Dashboard cards

**Files:**
- Modify: `src/features/super-admin/Dashboard.jsx:66` (pass `countUp`), `:82-90` (bespoke row)
- Test: existing `src/features/super-admin/__tests__/Dashboard.test.jsx` stays green (jsdom fallback renders final values)

**Interfaces:**
- Consumes `StatCards({ countUp })` from Task 1 and `CountUp` from `@/shared/components/design`.

- [ ] **Step 1:** `<StatCards countUp stats={[…]} />` on the first row.
- [ ] **Step 2:** In the bespoke row, replace `<p className="text-xl font-semibold text-navy">{value}</p>` with `<CountUp value={value} className="text-xl font-semibold text-navy" />` (value is always a number here; keep `Icon` markup).
- [ ] **Step 3:** Run `npx vitest run src/features/super-admin/__tests__/Dashboard.test.jsx` → PASS; lint clean.
- [ ] **Step 4:** Commit — `feat(super-admin): count-up on dashboard stat cards`.

### Task 3: Applications + Reports stat cards

**Files:**
- Modify: `src/features/super-admin/Applications.jsx:93`
- Modify: `src/features/super-admin/Reports.jsx:146`

- [ ] **Step 1:** Pass `countUp` to both `StatCards` call sites.
- [ ] **Step 2:** `npx vitest run src/features/super-admin/__tests__/Applications.test.jsx src/features/super-admin/__tests__/ReportsCsv.test.jsx` → PASS; lint clean.
- [ ] **Step 3:** Commit — `feat(super-admin): count-up on application and report cards`.

### Task 4: Employment + UserManagement panel cards

**Files:**
- Modify: `src/features/super-admin/Employment.jsx:80-84`
- Modify: `src/features/super-admin/UserManagement.jsx:299-306`
- Test: existing `Employment.test.jsx`, `UserManagement.*.test.jsx` must stay green

- [ ] **Step 1:** Employment: `<p className="break-words text-lg font-semibold text-navy">{value}</p>` → `<CountUp value={value} className="break-words text-lg font-semibold text-navy" />` (values are numbers from `records`).
- [ ] **Step 2:** UserManagement: each of the six `<Panel title="…"><p className="text-2xl font-semibold text-navy">{count}</p></Panel>` → `<CountUp value={count} className="text-2xl font-semibold text-navy" />`.
- [ ] **Step 3:** `npx vitest run src/features/super-admin/__tests__/Employment.test.jsx src/features/super-admin/__tests__/UserManagement.pagination.test.jsx src/features/super-admin/__tests__/UserManagement.a11y.test.jsx` → PASS; lint clean.
- [ ] **Step 4:** Commit — `feat(super-admin): count-up on employment and user panels`.

### Task 5: ADR + whole-system verification

**Files:**
- Modify: `docs/arch/adr-051-letter-reveal-system-wide.md` (Consequences bullet)

- [ ] **Step 1:** Append: "**Amendment (2026-11-15):** super-admin numeric cards (dashboard, applications, reports, employment, user management — 27 cards) use the count-up on first visibility. The shared `StatCards` exposes an opt-in `countUp` prop; job-seeker and employer dashboards are unchanged."
- [ ] **Step 2:** `npm test` → full suite PASS; `npm run lint` clean; `npm run build` completes.
- [ ] **Step 3:** Manual check (authenticated, for the user or a browser session with credentials): open `/super-admin`, `/super-admin/applications`, `/super-admin/reports` (generate a report), `/super-admin/employment`, `/super-admin/users` — every numeric card counts 0 → value once; entering the page with reduced motion ON still counts; no console errors.
- [ ] **Step 4:** Commit — `docs(motion): record super-admin count-up scope`.

## Verification notes

- jsdom has no `IntersectionObserver`, so all component tests see final values — existing assertions stay valid.
- Each card owns one observer + one rAF loop; 27 cards across five routes (max 8–10 per page) is negligible.
- If a future card needs a formatted value (currency, percent), extend `CountUp` with a `format` prop rather than pre-formatting strings (pre-formatted strings cannot count).
