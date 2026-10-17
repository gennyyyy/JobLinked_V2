# Dark Mode — Design Spec

**Date:** 2026-10-18
**Status:** Draft — pending user review
**Scope:** Frontend only. No API, schema, or server change.

## Goal

Add a user-controllable dark mode to the entire application, toggled from a
switch in every header surface (SiteHeader, PublicHeader, PortalLayout), with
persistence and no flash of unstyled content. Every page renders coherently
in dark mode without per-page edits, via global CSS-variable overrides.

## Non-goals

- No per-page visual polish beyond shared components.
- No new runtime dependency.
- No server, schema, or API change. `db/schema.sql` untouched.
- No real photo avatars (out of scope, per ADR-032).

## Architecture

### Mechanism

Tailwind v4 class-based dark variant:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Dark mode is active when `<html>` has the `dark` class. All `dark:` variants
and the global overrides below key off that class.

### Theme state

New `src/shared/context/ThemeProvider.jsx` exposes a `useTheme()` hook:

- `theme`: `'light' | 'dark' | 'system'` (user preference, persisted).
- `resolved`: `'light' | 'dark'` (what is actually applied).
- `setTheme(value)`: update preference, persist, apply.

Persistence: `localStorage` key `'theme'` (UI preference only — not data,
compliant with "Supabase is auth only"). Default when unset or invalid:
`'system'`, resolved via `window.matchMedia('(prefers-color-scheme: dark)')`.

Apply: add/remove `.dark` on `document.documentElement`; set
`document.documentElement.style.colorScheme = resolved`. Subscribe to
`matchMedia` changes only while `theme === 'system'`.

### No-FOUC

`index.html` gets an inline blocking script in `<head>` (before the module
script) that reads `localStorage('theme')` (or system pref) and adds
`dark` to `<html>` before first paint. Script must be tiny and not throw
(wrap in try/catch; default to system pref on any error).

### Provider wiring

`App.jsx` wraps `<BrowserRouter>` (inside `<ErrorBoundary>`) with
`<ThemeProvider>`. The provider must not break the existing `Suspense`/
`Routes` tree.

## Toggle

New `src/shared/components/ThemeToggle.jsx`:

- A real `<button type="button">` with `aria-pressed={resolved === 'dark'}`,
  `aria-label` describing the action ("Switch to dark mode" / "Switch to
  light mode"), and a visible focus ring.
- Renders Sun icon when dark (click → light), Moon icon when light (click →
  dark). Icons from `lucide-react` (already installed): `Sun`, `Moon`.
- Cycles `light ↔ dark` (sets explicit preference, not `system`). A
  three-state control is out of scope; the system default is only the
  initial state.
- Respects `prefers-reduced-motion` (global rule already clamps transitions).

Placement (all three header surfaces):

1. `SiteHeader.jsx` — render `<ThemeToggle />` inside the right cluster,
   before the `right` slot, so every caller (public pages, TopNavLayout)
   gets it without prop changes. Keep the existing `right` slot.
2. `PublicHeader.jsx` — add `<ThemeToggle />` to the right cluster before
   the LOG IN button.
3. `PortalLayout.jsx` — add `<ThemeToggle />` to the mobile header bar and
   to the sidebar top row (next to `NotificationBell`).

## Color strategy

### Fixed (never flip)

Brand tokens: `primary`, `primary-hover`, `primary-subtle`,
`primary-border`, `accent`, `accent-subtle`, `danger`, `danger-subtle`,
`dark-blue`, `dark`. Plus `white` and `black` (white stays white so
`text-white` on colored headers stays legible).

### Flipped via CSS variable redefinition under `.dark`

Neutral gray scale `gray-50` … `gray-950` is redefined under `.dark` to a
dark slate palette (page background dark, foreground light, borders dark).
This makes every raw `text-gray-*`, `border-gray-*`, `bg-gray-*` utility
flip without component edits.

### Global surface override

```css
.dark .bg-white { background-color: var(--color-gray-800); }
.dark .bg-gray-50 { background-color: var(--color-gray-900); }
```

This flips every `bg-white`/`bg-gray-50` surface (cards, modals, inputs,
dropdowns) across all feature pages without editing 200+ files. Opacity
variants (`bg-white/50`) are a minor edge case and are not overridden.

### Shared-component polish

Explicit `dark:` variants on: `PageHeader`, `SectionCard`, `StatCard`,
`InlineError`, `SiteHeader`, `PublicHeader`, `PortalLayout`,
`TopNavLayout`, `AccountMenu`, `NotificationBell`, confirmation modals,
and dropdown panels — for shadows, ring colors, and any `bg-white` not
covered by the global override. These are additive only; light-mode output
is byte-identical.

### `color-scheme`

`:root { color-scheme: light; }`; `.dark { color-scheme: dark; }`. This
fixes native form controls (scrollbars, date pickers) in dark mode.

## Accessibility

- Toggle is keyboard-operable, focus-visible, `aria-pressed`.
- `prefers-reduced-motion` already clamps transitions globally.
- Contrast: flipped gray scale chosen for WCAG AA on dark surfaces.
- No color-only meaning introduced.

## Testing

New tests:

1. `src/shared/context/__tests__/ThemeProvider.test.jsx` — resolves system
   pref, persists to localStorage, applies `.dark` to `<html>`, reacts to
   `matchMedia` changes while in `system` mode.
2. `src/shared/components/__tests__/ThemeToggle.test.jsx` — renders correct
   icon per resolved theme, toggles on click, `aria-pressed` correct,
   keyboard operable.
3. `src/App.test.jsx` (or a smoke test) — mounting the app with
   `localStorage.theme = 'dark'` results in `<html class="dark">` and the
   toggle reflects dark.

Existing tests must keep passing; the global CSS overrides must not change
light-mode rendered output (verified by re-running the full suite).

## Files

**Create:**
- `src/shared/context/ThemeProvider.jsx`
- `src/shared/hooks/useTheme.js` (re-export of context hook, matching
  `useAuth` pattern)
- `src/shared/components/ThemeToggle.jsx`
- `src/shared/context/__tests__/ThemeProvider.test.jsx`
- `src/shared/components/__tests__/ThemeToggle.test.jsx`

**Modify:**
- `index.html` (inline no-FOUC script)
- `src/index.css` (`@custom-variant`, gray-scale redefinition, global
  overrides, `color-scheme`)
- `src/App.jsx` (wrap in ThemeProvider)
- `src/shared/components/SiteHeader.jsx`
- `src/shared/components/PublicHeader.jsx`
- `src/shared/components/PortalLayout.jsx`
- Shared components listed under "Shared-component polish" (additive
  `dark:` classes only)

**Untouched:** all feature pages, all services, server, `db/schema.sql`,
all existing tests (no edits to assertions).

## Risks

- Global `.bg-white` override could affect an element that must stay white
  in dark mode (e.g., a logo container). Mitigation: use `!` important or
  a `dark:bg-white` override on that element if discovered.
- `matchMedia` mocking in jsdom: tests must mock `window.matchMedia`.
- Inline script in `index.html` must not break Vite dev/build; keep it
  self-contained with no imports.

## Hand-off

Implementation: **frontend** (all files above). Tests: **frontend** (new
tests) + **tester** (full suite run). Review: **review** (architectural
consistency + a11y). No subagent may modify `db/schema.sql` or server code.