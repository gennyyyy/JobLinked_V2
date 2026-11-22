# Employer profile console errors — duplicate key + file://

- Date: 2026-11-23
- Owner: frontend
- Status: approved for implementation

## Confirmed findings

1. **Duplicate React key** — `src/shared/components/PublicShell.jsx:81` keys footer
   items by `href`, but the "For employers" group contains two entries pointing
   at `/register/employer`:
   - `Post a job`
   - `Employer registration`

   Reproduced on `http://localhost:5173/` with a headless Chrome: the console
   emits `Encountered two children with the same key, /register/employer` on
   every footer render.

2. **`file:///` security error** — no app code or database value currently
   contains a `file:` URL. All 53 `public.employers` rows have `logo_path = null`
   and `profile_images` has no employer logos. The only frontend code path that
   can render an arbitrary URL from stored data is the legacy fallback in
   `src/features/employer/CompanyProfile.jsx:250`:

   ```jsx
   : (typeof company.logo_path === "string" && company.logo_path ? company.logo_path : null)
   ```

   A legacy row containing a Windows path (`C:\...`) or `file:///...` would be
   placed straight into `<img src>`, which is exactly the browser error reported.
   No such row exists in the database reachable from the running API, so this is
   hardened preventively rather than as a reproduced live failure.

3. The `Permissions Policy: Skipping unsupported feature name ... api.js:2:76707`
   lines come from a browser extension (`api.js` is not an app bundle), not this
   repository. `vercel.json` only sets camera/microphone/geolocation/payment/usb/
   interest-cohort. No app change.

## Changes

### 1. `src/shared/components/PublicShell.jsx`

In the footer group list, key each `<li>` by the link label (unique within each
group) instead of `href`. Keep both employer links and their destinations.

### 2. `src/features/employer/CompanyProfile.jsx`

Only accept an absolute `http:`/`https:` legacy `logo_path`; otherwise render the
company initials. Use a small local predicate (no new dependency, no shared util
for one call site). Trim the value before testing.

Rationale: `logo_path` is legacy ADR-040 data. `profile_images` is authoritative
when `has_logo` is true. A local path, `file:` URL, or any other scheme must never
reach `<img src>`.

## Tests (must be added/updated)

- `src/shared/components/__tests__/PublicChrome.test.jsx`
  - Render `PublicShell` and assert `console.error` is not called with a
    duplicate-key warning. Spy on `console.error`, render, assert no call whose
    first argument contains `same key`.
  - Keep the existing footer destination assertions.

- `src/features/employer/__tests__/CompanyProfile.address.test.jsx`
  (or a focused `CompanyProfile.logo.test.jsx` next to it)
  - `getEmployer` returns `{ company_name: 'Santa Maria Trading', has_logo: false,
    logo_path: 'file:///C:/Users/me/logo.png' }`.
  - Assert no `img` is rendered and the initials fallback is visible.
  - Add one positive case: `logo_path: 'https://cdn.example.com/logo.png'` still
    renders that URL (backward compatibility).

## Acceptance

Run from the repository root:

```powershell
npx vitest run src/shared/components/__tests__/PublicChrome.test.jsx src/features/employer/__tests__/CompanyProfile.address.test.jsx
npm run lint
```

Then re-run the headless probe against `http://localhost:5173/` and
`http://localhost:5173/employer/company` (spike employer login) and confirm zero
`same key` console errors.

## Out of scope

- Schema changes, `logo_path` removal, API contract changes.
- Browser-extension `Permissions-Policy` noise.
- Any change to upload, login, or accreditation flows.
