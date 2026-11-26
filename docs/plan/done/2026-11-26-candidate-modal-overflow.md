# Candidate modal: stop card content overlapping

**Status:** approved by user 2026-11-26 (screenshot: phone value spilling out of its card).

## Cause

`SeekerProfileCard` contact cells sit in `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
Grid items default to `min-width: auto`, so the unbreakable phone string forces the track past
`1fr` and draws over the neighbouring card. Only the email cell had `break-all`; the phone and
the remaining values had no wrapping, and the education/experience lists and the resume button
can overflow the same way.

## Change — `src/shared/components/SeekerProfileCard.jsx`

1. Replace the six repeated contact `<div>` cells with one local `InfoCard({ label, value,
   breakAll })` renderer so every cell gets the same guards:
   `min-w-0 rounded-xl border border-border bg-muted p-3`,
   `dd` = `mt-1 text-xs text-muted-foreground break-words` (email and phone `break-all`),
   `value || "—"`.
2. Section header row: `min-w-0` on the text container and `break-words` on the
   "Credentials — <name>" line.
3. Education/Work Experience cards: add `min-w-0` to both cards and `break-words` to each
   `li` (long school/company names).
4. Resume button: `max-w-full whitespace-normal break-all text-left` so a long file name wraps
   inside the card instead of pushing it wide.
5. Skills already wrap via `flex-wrap`; leave them.

## Audit the whole Review candidate modal — `src/features/employer/Applicants.jsx`

Confirm and fix if needed:
- `CandidateDetail` header (`DialogTitle`/`DialogDescription`) — long candidate/job names wrap.
- Candidate profile email/barangay row — email already `break-all`; add `min-w-0` handling if the
  row can overflow.
- Application history remarks — add `break-words` to the remark paragraph.
- The form column and `Notice` wrap naturally.
Report each card you checked and whether it needed a change.

`SeekerProfileCard` is shared with the Employees modal, so the fix covers both.

## Test

Extend `src/shared/components/__tests__/SeekerProfileCard.test.jsx`: render a long phone and
assert the phone value carries `break-all` (regression guard for the unbreakable-string case).

## Done when

- No value, name, list item, or button inside the Review candidate modal can widen its card past
  the grid track.
- Focused test + `npm run lint` pass; report the card-by-card audit.
