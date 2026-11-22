# TermsModal consent gate fix

Date: 2026-11-16
Status: approved for implementation
Owner: frontend

## Reported defects

- The loading bar jumps to full / does not track reading.
- The Close button shows before the notice is read.
- Backdrop click (and Escape) closes the modal without reading, bypassing the gate.

## Root causes

1. **Read effect measures the loading skeleton.** While `getLegal` is pending, `body` is
   `null` and only the `h-4` skeleton renders. It cannot scroll, so
   `scrollHeight - clientHeight < 24` calls `markRead()`; `readRef` latches before the
   notice renders. Close and 100% progress appear immediately.
2. **Scroll area cannot scroll.** The body div is `flex-1 overflow-y-auto` inside a
   `max-h-[80vh] flex flex-col` panel but lacks `min-h-0`. The flex item's automatic
   minimum height keeps it content-sized, the panel overflows instead of the body
   scrolling, and `max <= 0` auto-marks read even after content loads.
3. **Dismissal is ungated.** The overlay `onClick` and `useDialog`'s Escape handler call
   `onClose` directly. Only the Close button is gated.

## Behavior contract

- While `body == null` (loading): skeleton, progress 0, no Close, backdrop and Escape inert.
- After the body renders:
  - scrollable: progress = `scrollTop / (scrollHeight - clientHeight)`, capped at 99 until
    the bottom (24px grace); `read` and 100% at the bottom.
  - non-scrollable: read immediately (existing contract for short content).
- `onRead` fires at most once per mount.
- After `read`: Close, backdrop click, and Escape all close the modal (a11y unchanged
  post-consent).
- `useDialog` is not modified; other dialogs keep their current behavior.
- No API or database changes.

## Files

- `src/shared/components/TermsModal.jsx`
- `src/shared/components/__tests__/TermsModal.test.jsx`

## Implementation

- Add `closeIfRead = useCallback(() => { if (readRef.current) onClose?.(); }, [onClose])`.
  Pass it to `useDialog(closeIfRead, open)` and call it from the overlay self-target click.
  The Close button keeps `onClick={onClose}`.
- Gate the measurement effect on loaded content: if `body == null`, set progress 0 and
  return; measure and auto-read only once actual content exists.
- Add `min-h-0` to the scrollable body div's classes.

## Acceptance

- New regression test: deferred `getLegal`; while pending, no Close, `aria-valuenow="0"`,
  Escape and backdrop click do not call `onClose`. Resolve with scrollable text (mock
  heights): still no Close at the top, progress 0; scroll to bottom => Close appears,
  progress 100.
- Existing tests that encode the bypass are updated only to reach `read` first.
- `npx vitest run src/shared/components/__tests__/TermsModal.test.jsx` passes.
- `npm run lint` passes.
- No other files changed.
