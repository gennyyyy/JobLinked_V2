# Eyebrow headings for Field and Skills in step 3

Status: approved 2026-11-23 — implement via `frontend`.

## Confirmed brief

- **What:** in job-seeker registration step 3, the “Field” and “Skills” picker labels
  should match the small muted labels above Education Level / School Name / Course /
  Graduation Year.
- **How:** add an optional `labelClassName` prop to `VocabularyPicker` and `TagField`
  (defaults preserve today's look everywhere else), and pass
  `"mb-1 text-xs text-muted-foreground"` from `JobSeekerBackgroundStep` only.
- **Done when:** Field and Skills labels look like the education field labels (small,
  muted, above the control), no other screen changes, tests/lint pass.
- **Out of scope:** changing global label styles, other forms, picker behaviour.

## Changes

### `src/shared/components/VocabularyPicker.jsx`

- Accept `labelClassName`; apply it with `cn(...)` to the multiple-select group label
  (`<p id={labelId}>`) and the single-select `<Label>` (keeping their default classes).

### `src/features/job-seeker/TagField.jsx`

- Accept `labelClassName`; import `cn` and merge it into the `<label>` classes.

### `src/features/auth/JobSeekerBackgroundStep.jsx`

- Define the eyebrow string used locally:
  `"font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold"` and pass
  it as `labelClassName` to the Field `VocabularyPicker` and the Skills `TagField`.
- Leave all other markup unchanged.

## Tests

- `src/features/auth/__tests__/JobSeekerRegister.test.jsx`: existing label queries must
  keep passing. No new visual assertion (class-only change).

## Acceptance

`npx vitest run src/features/auth/__tests__/JobSeekerRegister.test.jsx`, then `npm test`
and `npm run lint`, all passing.
