# Remove Job-Seeker Dashboard Hero Banner

**Status:** Confirmed by user 2026-11-28. Bounded change.

## What

Remove the navy hero banner on the job-seeker dashboard — the "Opportunities close to home / Your skills belong somewhere great." block including its "See my matches" button.

## Exact change

File: `src/features/job-seeker/Dashboard.jsx`

Delete the JSX block currently at lines 131–138:

```jsx
<div className="mb-6 flex flex-col justify-between gap-5 rounded-2xl bg-navy p-6 text-white sm:flex-row sm:items-center">
  <div>
    <p className="mb-2 text-micro font-medium uppercase tracking-[.14em] text-white/65">Opportunities close to home</p>
    <h2 className="text-xl font-semibold tracking-tight text-white">Your skills belong somewhere great.</h2>
    <p className="mt-2 max-w-lg text-xs leading-6 text-white/70">Explore verified employers across Santa Maria’s 24 barangays. Your next connection could be just around the corner.</p>
  </div>
  <LinkButton href="/job-seeker/jobs" variant="secondary">See my matches<ArrowRight data-icon="inline-end" /></LinkButton>
</div>
```

## Constraints

- Do NOT touch the `PageHeading` above it (its "Explore jobs" button covers the same `/job-seeker/jobs` destination).
- Do NOT remove `ArrowRight` or `LinkButton` imports — both are used elsewhere in the file.
- No other sections, copy, or tests change. No test currently references this banner copy.

## Done when

- Dashboard renders without the banner (no "Opportunities close to home", no "See my matches").
- `npm run lint` passes.
- `npx vitest run src/features/job-seeker` passes (and full `npm test` if time permits).
