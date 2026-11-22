# TermsModal footer reflow + bottom threshold fix

Date: 2026-11-16
Status: approved for implementation
Owner: frontend

## Reported symptom

The notice is ~95% visible when the Close button appears; the last line(s) stay cut off
even when the scrollbar reaches the bottom.

## Measured evidence (headless Chrome, 1366x768, real dev server)

Before read:
- body `clientHeight` 487, `scrollHeight` 2220, `max` 1733, footer height 16px.
- Scrolled to the exact bottom: `hiddenPx = 0`, last line fully visible, Close absent.

After the read state renders:
- footer height 16 → 44px (hint replaced by the button),
- body `clientHeight` 487 → 459 (panel is capped at `max-h-[80vh]`),
- `max` 1733 → 1761, `hiddenPx = 28`, progress 100, Close visible.

Root cause: the footer grows when the conditional Close button replaces the hint, which
shrinks the scroll body and re-hides the last 28px. The 24px grace makes it worse: Close
can appear with up to ~52px still unseen.

## Behavior contract

- The body's height must not change when `read` flips. Reserve the footer height from the
  first render so swapping hint -> Close cannot reflow the scroll area.
- Read requires the true bottom: `scrollHeight - clientHeight - scrollTop <= 1` (fractional
  scroll tolerance). No 24px grace.
- Non-scrollable content (overflow <= 1px) still auto-reads.
- All other behavior from `docs/plan/done/2026-11-16-terms-modal-consent-gate-fix.md` stays.

## Files

- `src/shared/components/TermsModal.jsx`
- `src/shared/components/__tests__/TermsModal.test.jsx`

## Implementation

- Footer row: `flex h-11 shrink-0 gap-3 items-center justify-end` (the button measures 44px = h-11).
  `shrink-0` is required: the panel's height is indefinite (`max-h` only), so the body's
  `flex-basis: 0%` resolves as content and the resulting negative free space otherwise
  compresses the footer to 16px.
- Progress track: add `shrink-0` for the same reason; otherwise `h-1.5` is compressed to 1.2px.
- Hint span: add `truncate` so it cannot grow the fixed 44px row.
- Replace both 24px checks (`handleScroll` and the measurement effect) with one helper:
  `const atBottom = (el) => el.scrollHeight - el.clientHeight - el.scrollTop <= 1;`
- Keep `progress = Math.min(99, scrollTop / max * 100)` until `atBottom`.

## Verified in Chrome after the fix

- footer 44px, progress track 6px, fill 470px blue at 100%.
- body `clientHeight` 454 both before and after `read`; `max` 1766 both times.
- at the true bottom: `hiddenPx = 0`, progress 100, Close visible; screenshot shows the
  final line "…office handling your registration." in full.

## Acceptance

- jsdom: with mocked `scrollHeight 1000` / `clientHeight 300` (max 700), `scrollTop 690`
  (10px short) does NOT read and shows no Close; `scrollTop 699` (1px) reads and shows Close.
- jsdom: footer row carries `h-11` and the hint carries `truncate` (reflow guard).
- Real browser (verification by architect, not the agent): open `/register/employer` ->
  View terms; before/after read body `clientHeight` identical (459), footer 44 both times;
  at bottom `hiddenPx = 0`, progress 100, Close visible; screenshot shows the final line
  "…office handling your registration." fully.
- `npx vitest run src/shared/components/__tests__/TermsModal.test.jsx` passes; `npm run lint -- --quiet` clean.
- No other files changed.
