# Nationality Dropdown Implementation Plan

**Goal:** Replace the free-text nationality input with a required dropdown using a curated list, in job seeker registration and Profile.

**Architecture:** UI-only change. `job_seekers.nationality` stays `text not null default 'Filipino'`; sign-up and PATCH contracts are unchanged.

**Spec:** this file — user chose "Common nationalities + Other (~25)" on 2026-11-26.

## Global Constraints

- JavaScript/JSX only; tests `npm test`, lint `npm run lint`; all existing tests must pass.
- Do not edit `db/**`, `server/**`, or the shared auth service — server already stores arbitrary trimmed text.
- Stored values outside the list must stay visible and selectable (same fallback Profile uses for barangay), so no data is silently blanked.
- Required: blank selection must still block registration/save.

## Approved Option List

`NATIONALITIES` in `src/shared/constants.js`, in this order:

```js
export const NATIONALITIES = [
  'Filipino', 'American', 'Australian', 'Brazilian', 'British', 'Canadian', 'Chinese',
  'Dutch', 'Emirati', 'French', 'German', 'Indian', 'Indonesian', 'Italian', 'Japanese',
  'Korean', 'Malaysian', 'Nigerian', 'Pakistani', 'Saudi Arabian', 'Singaporean',
  'Spanish', 'Taiwanese', 'Thai', 'Vietnamese', 'Other',
];
```

## Files and Changes

| File | Change |
|---|---|
| `src/shared/constants.js` | Add `NATIONALITIES` |
| `src/features/auth/JobSeekerPersonalStep.jsx` | `Input` → `FormSelect` with the list; keep required label/error |
| `src/features/job-seeker/Profile.jsx` | `TextField` → `SelectField`; options include a `"Select nationality"` placeholder plus the stored value when it is not in the list |
| `src/features/auth/__tests__/JobSeekerRegister.test.jsx` | Nationality test asserts a `SELECT`, default `Filipino`, and edited value in the parked payload |
| `src/features/job-seeker/__tests__/Profile.required.test.jsx` | Nationality test asserts the control is a `SELECT`, prefilled `Filipino`, blank blocks save; add `Nationality` to the required-marker loop |

Registration keeps `nationality: "Filipino"` in `EMPTY_FORM` and the existing validation/payload. Profile keeps `user.nationality || 'Filipino'`, validation, and PATCH payload.

## Done When

- Both controls render as `<select>` with the approved options.
- `npm test -- src/features/auth/__tests__/JobSeekerRegister.test.jsx src/features/job-seeker` passes.
- Scoped ESLint on the five touched files is clean.
