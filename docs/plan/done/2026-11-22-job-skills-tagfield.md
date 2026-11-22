# Job Post Skills → TagField (like Profile)

## Problem
JobPostFormDialog uses VocabularyPicker (checkbox chips for every skill) for "Skills required", bombarding employers with all skill tags. User wants a tag text box (TagField) like the profile page.

## Design
- In `JobPostFormDialog.jsx`, replace the skills `VocabularyPicker` (category="skill") with `TagField`.
- Load skill vocabulary via `useVocabulary('skill')`; pass `suggestions={skillVocabulary.values}`.
- Normalize casing on change like Profile: `updateSkills(chips)` maps each chip to `skillByLower.get(chip.toLowerCase()) ?? chip`.
- Show loading/error/retry feedback and unrecognized-skills note (mirror Profile).
- Keep `form.skills` as string[] (TagField arrayMode).
- Keep skills optional (no required validation), unlike profile.
- Field picker (VocabularyPicker single) stays.

## Tests
- Update `JobPostFormDialog.vocabulary.test.jsx` to match TagField interaction (type + Enter / comma, remove chip) instead of checkboxes. Update expectations accordingly.

## Done when
- Skills input renders as tag box with suggestions.
- Existing vocabulary tests updated and passing.
- Lint clean.
