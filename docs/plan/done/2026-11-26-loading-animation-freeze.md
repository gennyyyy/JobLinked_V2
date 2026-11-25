# Loading animation freezes during load

**Status:** Done & verified 2026-11-26 (implemented by `frontend`).

## Confirmed brief

**Problem.** On this machine Chrome reports `prefers-reduced-motion: reduce`
(Windows animation effects are off). The global reset at the end of
`src/index.css` (`* { animation: none !important; ... }`) therefore disables
every animation, including functional loading indicators. A live probe with the
session call delayed 2.5 s showed the spinner with `animation-name: none`,
`animation-duration: 0s`, and no running animations — it is frozen for the whole
wait until the page renders. Skeleton `animate-pulse` and `Loader2` button
spinners are frozen the same way.

**What.** Functional loading indicators keep animating until page content
renders, even under reduced motion. Everything decorative stays still.

- In scope: `.animate-spin`, `.animate-pulse` keep their theme animation inside
  the existing `@media (prefers-reduced-motion: reduce)` block.
- Out of scope: shortening the session/API wait; pre-React blank screen;
  decorative animations; component changes.

**How.** CSS only. In the existing reduced-motion block in `src/index.css`,
after the universal reset, re-enable the two loading utilities with `!important`
(the reset uses `!important`, so the exemption needs it too):

```css
/* Functional progress indicators stay alive so a slow load never looks frozen. */
.animate-spin { animation: var(--animate-spin, spin 1s linear infinite) !important; }
.animate-pulse { animation: var(--animate-pulse, pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite) !important; }
```

`@keyframes spin` / `@keyframes pulse` are emitted by Tailwind because both
utilities are used in JSX. No new dependency, no other file.

**Done when.**

1. Browser probe (`probe-spinner.mjs`, reduced-motion emulated, session call
   delayed 2.5 s) reports `animationName: "spin"` and the running animation's
   `currentTime` advances across a 400 ms sample.
2. An element with `animate-pulse` reports `animation-name: pulse`.
3. `npm test` and `npm run lint` pass.

**Assumptions.** The 2–3 s is real session/API wait; this change makes the wait
visibly alive, not shorter. Reduced motion still disables all non-loading
animations and transitions.

**Verification probe.** `probe-spinner.mjs` (repo root, scratch, untracked)
against the already-running dev server at `http://localhost:5173/`.

## Verification (2026-11-26)

- `node probe-spinner.mjs`, reduced motion on, session call delayed 2.5 s:
  `animationName: "spin"`, `pulseAnimationName: "pulse"`, `running` at 1 s,
  `currentTime` advancing, and `transform` changing between samples
  (`matrix(1,0,0,1,0,0)` → rotation matrix) — the spinner visibly rotates.
- `npm run lint`: pass.
- `npm test`: 266 files passed, 1 skipped; 1868 tests passed, 7 skipped.
