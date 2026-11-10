# Plan: Remove filler badges

**Status:** DONE — implemented 2026-11-10, verified
**Owner:** Lead Architect → hand off to `frontend`

## Decision

Visual-only change. No API contract, database schema, state-management, or migration impact. No ADR required (reversible UI copy/structure removal).

## Scope

Remove non-informative decorative badges/pills:

1. `src/shared/components/TopNavLayout.jsx` — remove the `"{role} workspace"` badge block and its wrapper div (affects desktop sidebar and mobile sheet, collapsed shield variant included). Remove now-unused `Badge` and `ShieldCheck` imports. In the collapsed state, add `justify-center px-0` to the logo row so the compact logo stays centered (currently centered by the badge wrapper being removed). `label` remains used for nav aria-label and the account subtitle.
2. `src/features/public-site/HomeHero.jsx` — remove the "A brighter future, closer to home" hero pill.
3. `src/features/public-site/PublicJobDetail.jsx` — remove the "Local opportunity" badge. Keep the `Badge` import (job tags still use it).
4. `src/features/super-admin/Broadcast.jsx` — remove the "In-app notice" badge. Keep the `Badge` import (Published/Expired stays).

## Explicitly kept

Functional/data badges: `StatusBadge`, `VerifiedBadge`, unread notification counts, sidebar accreditation count, job category/experience badges, job tags, hero step numbers.

## Tests / verification

- `src/shared/components/__tests__/PortalLayout.test.jsx`: delete the "shows the role workspace badge" case; retarget "centers the shield logo when collapsed" to assert `justify-center` on the logo row (`nav.previousElementSibling`).
- Run `npm test` and `npm run lint`.

## Acceptance criteria

- No badge renders the workspace role.
- No "Local opportunity", "In-app notice", or hero-pill text remains.
- Collapsed sidebar still centers the compact logo.
- Status/verification/count badges unchanged; tests and lint pass.

## Rollback

Revert the touched lines; no data or schema changes.
