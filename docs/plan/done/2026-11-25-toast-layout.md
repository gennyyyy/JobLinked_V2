# Toast: top-center, shorter, no dismiss button

Status: approved 2026-11-25 — implement via `frontend`.

## Confirmed brief

- **What:** the shared toast moves to the top center, becomes slightly shorter, and loses
  the X button (auto-dismiss only).
- **How:** update `src/shared/components/Toast.jsx` classes and markup; keep the existing
  success/error colors, icons, `role="status"`, `aria-live="polite"`, and auto-dismiss
  timer.
- **Done when:** toasts appear centered at the top, are shorter, show no close button, and
  still auto-dismiss; tests/lint pass.
- **Out of scope:** variant colors, duration, messages, other components.

## Changes (`src/shared/components/Toast.jsx`)

- Position: `fixed top-4 left-1/2 z-[9999] -translate-x-1/2` plus a mobile-safe
  `max-w-[calc(100%-2rem)]`; remove `right-4`.
- Height: replace `p-4` with `px-4 py-2.5`.
- Remove the dismiss `Button`, the `X` import, and the Button import; keep the icon +
  message row. Keep the `onClose` prop for the timer.
- Keep `role="status"` / `aria-live="polite"` and the green/red classes.

## Tests (`src/shared/components/__tests__/Toast.test.jsx`)

- Delete the “calls onClose when the dismiss button is clicked” test.
- Add: no button is rendered inside the status region.
- Keep the message/variant/auto-dismiss tests.

## Acceptance

`npx vitest run src/shared/components/__tests__/Toast.test.jsx`, then `npm test` and
`npm run lint`, all passing.
