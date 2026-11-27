# Sidebar Collapse Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop sidebar collapse/expand feel smooth — labels, badges, and paddings fade and ease in sync with the width transition instead of popping in and out.

**Architecture:** All three portals (job-seeker, employer, super-admin) render the same shared `TopNavLayout.jsx`, so this is one component's two edits: (1) keep the nav label/badge group mounted and animate `max-width` + `opacity` instead of unmounting it, (2) pin a matching duration/easing on the existing width/margin transitions. CSS/Tailwind only; the mobile `Sheet` already animates and is untouched. The global `prefers-reduced-motion` reset in `src/index.css` (line ~814) automatically disables all of this for reduced-motion users.

**Tech Stack:** React (JSX), Tailwind CSS v4 utilities in class names. No new dependencies. No new CSS file changes needed.

**Spec:** Confirmed in-chat brief, 2026-11-28: "Smooth the collapse/expand in TopNavLayout.jsx — eased width transition, labels/badges/logo fade+slide instead of hard-popping. CSS/Tailwind only, no new dependency. Out of scope: entrance staggers, hover micro-interactions, mobile Sheet changes."

## Global Constraints

- JavaScript/JSX only — TypeScript is not used in this repo.
- Tailwind classes in JSX; theme tokens from `src/index.css`. Do not add a new dependency.
- Do not touch the mobile `Sheet` (lines 240-248) — its slide-in comes from shadcn and is already animated.
- Accessibility must not regress: every `NavLink` already carries `aria-label={title}` (line 202), so keeping labels visually hidden while collapsed is safe. Do not remove `aria-label`.
- Reduced-motion behavior: rely on the existing global reset in `src/index.css`; add no per-component reduced-motion code.
- Verification commands: `npm test` and `npm run lint` must both pass.

## Review Focus

- **Collapsed label width:** if the label wrapper still occupies width when collapsed, text bleeds outside the 82px sidebar (nav has `overflow-y-auto` only). Expect: collapsed sidebar shows icon only, nothing overflowing. Test pins this via `max-w-0` + `overflow-hidden` classes in Task 1.
- **Expanded label clipping:** if the wrapper's expanded `max-w` is set too small, long labels get truncated in the expanded state. Expect: no clipping for existing nav labels ("User management" is the longest). Test asserts no `max-w-0`/clip classes when expanded.
- **Centered icon when collapsed:** `gap-3` between icon and a zero-width wrapper shifts the icon ~6px off-center. Expect: `gap-0` applied when collapsed. Test asserts the collapsed logo row still has `justify-center` (existing test, line 71-77) and Task 1 asserts `gap-0` on the collapsed NavLink.
- **Timing desync:** content margin transition must match sidebar width transition (same duration + easing) or the content visibly "catches up" after the sidebar. Both pinned to `duration-300 ease-out` in Task 2.
- **Test oracle drift:** class-name assertions (`opacity-0`, `max-w-0`) are the deliberate smallest check for a visual change; if Tailwind class generation changes, these tests fail loudly rather than silently passing.

---

### Task 1: Fade nav labels and badges during collapse

**Files:**
- Modify: `src/shared/components/TopNavLayout.jsx:194-223` (the `sidebar()` render's `NavLink` block)
- Test: `src/shared/components/__tests__/PortalLayout.test.jsx` (inside `describe('Portal shell navigation')`)

**Interfaces:**
- Consumes: existing `collapsed`, `small`, `active`, `badge` locals in `sidebar()` — no signature changes.
- Produces: label/badge group is always mounted; its visibility is driven by classes `max-w-0 opacity-0` (collapsed) vs `max-w-[200px] opacity-100` (expanded). Task 2 depends on nothing from this task, but both must land for the motion to read as smooth.

- [ ] **Step 1: Write the failing test**

Add to `describe('Portal shell navigation')` in `src/shared/components/__tests__/PortalLayout.test.jsx`:

```jsx
it('keeps nav labels mounted but visually hidden when collapsed', () => {
  renderLayout('/super-admin')
  const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i })

  // Expanded: label group is the NavLink's first span child, visible, no clip classes.
  const overview = screen.getByRole('link', { name: 'Overview' })
  const group = overview.querySelector('span')
  expect(group).not.toHaveClass('max-w-0')
  expect(group).not.toHaveClass('opacity-0')

  fireEvent.click(collapseBtn)

  // Collapsed: label group still mounted (nav textContent keeps 'Overview'),
  // but clipped and faded instead of unmounted.
  const collapsedLink = screen.getByRole('link', { name: 'Overview' })
  expect(screen.getByRole('navigation', { name: 'PESO Admin navigation' })).toHaveTextContent('Overview')
  const collapsedGroup = collapsedLink.querySelector('span')
  expect(collapsedGroup).toHaveClass('max-w-0')
  expect(collapsedGroup).toHaveClass('opacity-0')
  expect(collapsedLink).toHaveClass('gap-0')
})
```

Note: query by role (`getByRole('link', { name: 'Overview' })`), not `getByText` — the breadcrumb also renders the page label, so text queries can match multiple elements. `overview.querySelector('span')` is the label/badge wrapper: the icon renders as an `<svg>`, so the wrapper is the first `span` child of the NavLink.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PortalLayout`
Expected: FAIL — when collapsed the label span is unmounted, so `getByText('Overview')` throws (unable to find element).

- [ ] **Step 3: Implement in `TopNavLayout.jsx`**

Two edits inside the `sidebar()` function's `NavLink`:

Edit A — NavLink `className` (line ~204): replace `transition-colors` with an all-property transition so padding and gap ease alongside width, and add `gap-0` to the collapsed variant:

```jsx
className={cn(
  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-xs text-muted-foreground transition-all duration-300 ease-out hover:bg-muted hover:text-navy',
  active && 'bg-blue-soft font-medium text-primary',
  collapsed && !small && 'justify-center gap-0 px-1',
)}
```

Edit B — replace the conditional label/badge unmount (lines ~211-220):

```jsx
{(!collapsed || small) && (
  <>
    <span className="flex-1">{title}</span>
    {badge > 0 && (...)}
  </>
)}
```

with an always-mounted group that clips and fades:

```jsx
<span
  className={cn(
    'flex min-w-0 flex-1 items-center gap-3 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out',
    collapsed && !small ? 'max-w-0 opacity-0' : 'max-w-[200px] opacity-100',
  )}
>
  <span className="flex-1 truncate">{title}</span>
  {badge > 0 && (
    <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md text-micro', path.endsWith('/accreditation') ? 'bg-warning-soft text-warning' : 'bg-primary/10 text-primary')}>
      {badge}
    </span>
  )}
</span>
```

Keep the existing `title={collapsed && !small ? title : undefined}` tooltip line and `aria-label={title}` exactly as they are. `max-w-[200px]` is deliberately larger than any label's natural width (~171px available) so it never clips when expanded; `min-w-0` + `overflow-hidden` + `whitespace-nowrap` guarantee zero bleed when collapsed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PortalLayout`
Expected: PASS — all tests in the file, including the new one and the pre-existing `centers the compact logo when collapsed`.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/TopNavLayout.jsx src/shared/components/__tests__/PortalLayout.test.jsx
git commit -m "feat: fade sidebar labels during collapse"
```

---

### Task 2: Sync width, margin, and logo-row timing

**Files:**
- Modify: `src/shared/components/TopNavLayout.jsx` — three className tweaks (lines ~186, ~237, ~249)

**Interfaces:**
- Consumes: Task 1's `duration-300 ease-out` on nav content — the shell transitions must match it.
- Produces: nothing consumed downstream; this completes the motion.

- [ ] **Step 1: Apply the three edits**

Logo row (line ~186) — animate the padding change so the logo row doesn't snap while the sidebar eases:

```jsx
<div className={cn('flex h-[85px] items-center px-6 transition-[padding] duration-300 ease-out', collapsed && !small && 'justify-center px-0')}>
```

Desktop aside (line ~237) — pin duration/easing on the existing width transition:

```jsx
<aside className={cn('fixed inset-y-0 left-0 z-30 hidden border-r bg-white transition-[width] duration-300 ease-out lg:block', collapsed ? 'w-[82px]' : 'w-[248px]')}>
```

Content wrapper (line ~249) — same timing so the margin tracks the width exactly:

```jsx
<div className={cn('flex min-h-screen flex-col transition-[margin] duration-300 ease-out', collapsed ? 'lg:ml-[82px]' : 'lg:ml-[248px]', fixedContent && 'h-screen min-h-0 overflow-hidden')}>
```

Leave the `Logo compact={...}` prop swap as-is — the hard swap is masked by the 300ms width ease (deliberate simplification; a crossfade needs JS or double-mounting and isn't worth it).

- [ ] **Step 2: Run tests and lint**

Run: `npm test`
Expected: PASS — full suite, including the existing `centers the compact logo when collapsed` assertion.

Run: `npm run lint`
Expected: PASS, no new warnings.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/TopNavLayout.jsx
git commit -m "feat: sync sidebar width and margin timing"
```

---

## Manual check (both tasks done)

`npm run dev`, sign in to any portal, toggle the collapse button on desktop (≥ lg viewport):

- Labels and badges fade out while the width eases — no text visible at rest when collapsed, no text bleeding past the 82px edge mid-transition.
- Content column margin moves in lockstep with the sidebar edge.
- Icon-only collapsed state: icons centered, badges/icons not clipped.
- OS reduced-motion enabled: everything snaps instantly (global reset working).
- Mobile (< lg): Sheet slide-in unchanged.
