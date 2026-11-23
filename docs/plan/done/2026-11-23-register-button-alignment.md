# Align the two registration buttons

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** on the registration chooser (`/signup`), the “Join as a job seeker” and
  “Join as an employer” buttons must be the same width/height and sit on the same
  horizontal line.
- **Cause:** both cards stretch to the same height, but the employer's accreditation
  note under its button consumes footer space, so `mt-auto` positions that button
  higher than the seeker's. Button labels also differ in length, so intrinsic widths
  differ.
- **How:** make both `LinkButton`s full-width (`w-full`) and reserve the same note slot
  beneath both buttons. The employer slot shows the note; the seeker slot is empty but
  keeps the height.
- **Done when:** both buttons fill the card content width, share the same height, and
  start at the same vertical position; the note still appears only under the employer
  button; tests/lint pass.
- **Out of scope:** card copy, icons, routes, the employer form, other pages.

## Changes (`src/features/auth/Register.jsx`)

- `<LinkButton href={href} className="mt-auto w-full">` (add `w-full`, keep `mt-auto`).
- Replace the conditional note with an always-rendered slot after the button:
  `<p className="mt-3 min-h-5 text-center text-[11px] leading-5 text-muted-foreground">{note}</p>`
  where `note` is undefined for the job-seeker entry, so the element is empty but
  reserves the same height in both cards.
- No other layout or copy changes.

## Tests (`src/features/auth/__tests__/Register.test.jsx`)

- Keep the existing note-placement test.
- Add: both journey links carry `w-full`; each card contains its note slot
  (`min-h-5`), the employer's with the accreditation text and the seeker's empty.

## Acceptance

`npx vitest run src/features/auth/__tests__/Register.test.jsx`, then `npm test` and
`npm run lint`, all passing. Report counts.
