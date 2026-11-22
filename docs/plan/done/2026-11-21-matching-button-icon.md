# Matching button icon → "AI"

Status: confirmed with user, dispatched.
Owner: frontend agent.

## Confirmed brief

- **What:** In the compact (Jobs sidebar) variant of the AI matching trigger, replace the `Sparkles` lucide icon with the literal text `AI`. The full-width variant keeps its `MessageCircle` icon.
- **How:** Render `<span aria-hidden="true">AI</span>` inside the existing native `<button>` in `src/shared/components/PreferenceMatching.jsx`. Accessible name must stay `Skills-based matching` (already supplied by `aria-label={MATCHING_NAME}`), so the span is decorative. Remove the now-unused `Sparkles` import. Preserve the button's size, padding, and active/hover classes exactly.
- **Done when:** `npm test` passes (in particular `src/features/job-seeker/__tests__/PreferenceMatching.ai.test.jsx`, `src/features/job-seeker/__tests__/OpportunityList.matching.test.jsx`, `src/shared/components/__tests__/JobsBrowser.layout.test.jsx`) and `npm run lint` is clean; the sidebar trigger visibly reads `AI`.
- **Out of scope:** product copy in `src/shared/content/matching.js` (the product is deliberately never called "AI" in text; this change is a visual mark only), the full-width matching button, and any other icon in the app.

## Files

- `src/shared/components/PreferenceMatching.jsx` (only)

## Notes

- Keep text small enough not to change button geometry: `size-8` / `lg:size-7` shell, text at `text-[10px]`–`text-xs`, semibold.
