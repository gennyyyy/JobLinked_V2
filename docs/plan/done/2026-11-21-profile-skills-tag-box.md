# Profile Skills Tag Box — Confirmed Brief

**Status:** Approved 2026-11-21. Owner: frontend agent.
**Type:** Bounded UI change. No API, PATCH shape, or schema change.

## Goal

On `/job-seeker/profile` → **Education** tab, replace the skills checkbox-chip grid
(`VocabularyPicker`) with the same tag-box interaction already used by **Work experience**
(`TagField`): type a skill, Enter or comma creates a chip, X removes it. A native
autocomplete list (`<datalist>`) offers PESO's seeded `skill` vocabulary while typing.

## Behavior (user-confirmed)

- Any typed text becomes a chip.
- Chips matching PESO's list case-insensitively are saved in the vocabulary's canonical
  casing (server already canonicalizes; client should send canonical values).
- Unlisted chips are named in the existing note: "Unrecognized skills: … They are not in
  PESO's list, so they are not saved." They are excluded from the PATCH payload.
- Autofill appends every detected skill as a chip (recognized and unrecognized), so the
  same note covers it. Delete the autofill-only `unrecognizedSkills` state; derive the
  note from chips.
- Save is blocked with "Add at least one skill from PESO's list." when no chip matches the
  vocabulary. Payload cap is 20 recognized skills (server `MAX_SKILLS`).

## Files

- `src/features/job-seeker/TagField.jsx` — accept array values; keep comma-string mode for
  Work experience unchanged. Add optional `suggestions` (native `<datalist>`, unique id via
  `useId`) and `max` (cap chips; help text mentions the cap only when set).
- `src/features/job-seeker/Profile.jsx` — use `TagField` for skills with
  `useVocabulary('skill')`; canonicalize a chip when added if it matches; derive
  unrecognized chips; build the PATCH `skills` from recognized chips only; extend
  `validate()`. Keep `matchSkills` for autofill. If the vocabulary is still loading or
  failed, block save and show the load error with Retry (same wording class as
  `VocabularyPicker`'s feedback).
- `src/features/job-seeker/__tests__/Profile.skills.test.jsx` — retarget interactions to
  the tag input; add coverage for: canonical save, unrecognized chip shown in the note and
  excluded from the payload, save blocked when only unrecognized chips exist.
- Do not touch the employer "Skills required" picker (`VocabularyPicker` stays there).

## Acceptance

- `npx vitest run src/features/job-seeker/__tests__/Profile.skills.test.jsx src/features/job-seeker/__tests__/Profile.a11y.test.jsx` passes.
- `npm run lint` clean.
- Skills input still resolves via `getByLabelText(/your skills/i)`; each chip's remove button
  has an accessible name. Work experience tag field behavior is unchanged.
