# Required vocabulary picker: real placeholder instead of "Not set"

**Status:** approved by user 2026-11-26 (screenshot: required Field select showing "Not set").

## Problem

`VocabularyPicker` (`src/shared/components/VocabularyPicker.jsx:178`) always renders
`<option value="">Not set</option>` as the empty choice. `JobPostFormDialog` passes
`required={!editingId}` for Field, so a new posting shows a required select whose empty option
reads "Not set" — it looks like a valid value, and users can select it.

## Change

1. `VocabularyPicker` accepts `placeholder` (default `"Select an option"`).
2. Single-select empty option:
   - `required` → `<option value="" disabled>{placeholder}</option>` (cannot be re-selected;
     the native `required` attribute already blocks submit).
   - not required → keep `<option value="">Not set</option>` (profile and registration steps rely
     on "Not set" meaning "leave blank").
3. `JobPostFormDialog` passes `placeholder="Select a field"` on the Field picker.

Legacy editing is unchanged: `required` is false when `editingId` is set, so an existing posting
can still keep "Not set" (the existing help text already says so).

## Test

`src/shared/components/__tests__/VocabularyPicker.test.jsx`:
- Keep the optional "Not set" test.
- Add: with `required`, the empty option is the disabled placeholder (`Select a field`), and
  `Not set` is not present.

## Amendment — fill the bordered container (2026-11-26)

The bordered box in the screenshot is full-width but the select inside is content-width, so the
chevron sits mid-box and the rest is dead space.

- `src/shared/components/FormSelect.jsx`: change the wrapper from `relative` to `relative w-full`
  so the native select fills its container in flex layouts (block layouts already filled).
- No other change; all existing FormSelect usages are full-width form fields.

## Done when

- `npx vitest run src/shared/components/__tests__/VocabularyPicker.test.jsx src/features/employer/__tests__/JobPostFormDialog.vocabulary.test.jsx`
  and `npm run lint` pass.
