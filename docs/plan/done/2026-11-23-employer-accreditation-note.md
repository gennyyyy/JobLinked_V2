# Employer accreditation note on the registration chooser

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** on the registration selection page (`/signup`, `src/features/auth/Register.jsx`),
  show the note “Requires PESO accreditation” directly under the employer card's
  “Join as an employer” button.
- **How:** add an optional `note` field to the employer journey entry and render a small
  muted paragraph beneath the `LinkButton` only when `note` exists.
- **Done when:** the note appears under the employer button, not under the job-seeker
  button, and lint/full tests pass.
- **Out of scope:** the employer registration form, the job-seeker card, routing,
  server changes.

## Changes (`src/features/auth/Register.jsx`)

- Employer journey object: add `note: 'Requires PESO accreditation'`.
- In the card map, destructure `note` and render after `<LinkButton>`:
  `<p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">{note}</p>`
  (only when present). Do not move the existing `mt-auto` button alignment.
- No other copy or layout changes.

## Acceptance

`npm test` and `npm run lint`, all passing. Report counts.
