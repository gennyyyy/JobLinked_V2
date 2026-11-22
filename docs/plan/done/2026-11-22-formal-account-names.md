# Formal Names for Test / Root / Dummy Accounts

**Status:** approved by user 2026-11-22 (display names only).

**Goal:** Every seeded, benchmark, and administrative test account shows a formal Title Case person name. Emails, logins, passwords, company names, job titles, and real-user rows stay untouched. No schema changes.

## Mapping

| Table | Current name | New first | New last | New full_name |
|---|---|---|---|---|
| job_seekers | smoke seeker | Maria | Santos | Maria Santos |
| employers | smoke employer | Jose | Dela Cruz | Jose Dela Cruz |
| employers | smoke pending | Ana | Reyes | Ana Reyes |
| super_admins | smoke admin | Elena | Cruz | Elena Cruz |
| super_admins | super admin (admin@joblinked.ph) | Ramon | Reyes | Ramon Reyes |
| super_admins | peso admin (e2e.admin@joblinked-spike.test) | Liza | Mendoza | Liza Mendoza |
| super_admins | a11y probe super-admin (a11y-probe.admin.1792140975930@gmail.com) | Anna | Villanueva | Anna Villanueva |
| super_admins | a11y probe super-admin (a11y-probe.admin.1792140995963@gmail.com) | Bea | Villanueva | Bea Villanueva |

Spike cohort: `spike.seeker.001..100@joblinked-spike.test` and `spike.employer.001..050@joblinked-spike.test` — title-case `first_name`, `middle_name`, `last_name`, `full_name` (they are already formal names, just lowercase). Use `initcap()`.

## Repo edits

1. `db/seed-dev.sql` — the four smoke rows (values above; same UUIDs/emails).
2. `scripts/system-check.mjs` — update matches that reference the old display names (`'Smoke Seeker'`, `'smoke seeker'`, `PENDING_COMPANY_HINT` stays because it matches the company name, not a person).
3. `server/scripts/seed-registration-spike.mjs` — emit Title Case names (title-case the generated first/middle/last), so fresh benchmark seeds match.
4. `server/scripts/verify-live.mjs` — `'bench admin'` → `'Rafael Santos'`; `first_name: 'Bench'`/`last_name: role` → formal name; `'Bench'`/`'Invite'` invite literal → `'Rafael'`/`'Santos'`.
5. `server/src/__tests__/integration/db.integration.test.js` — ephemeral row `'Root'`, `root@it.local` → `'Rafael Santos'`, keep `root@it.local` email (login untouched).

Do not touch read-only UI mock literals in `src/**/__tests__` (`Test User`, `PESO Admin`, etc.) — they are test doubles, not accounts.

## Live database

Apply one idempotent data-only UPDATE (no migration file, no schema change) against `DATABASE_URL` from `server/.env`:

- explicit `UPDATE ... SET first_name/last_name/full_name` for the eight mapping rows;
- `UPDATE ... SET first_name = initcap(first_name), middle_name = initcap(middle_name), last_name = initcap(last_name), full_name = initcap(full_name)` for the two spike cohorts.
- Check which name columns each table actually has before writing the SQL (`\d` via information_schema).

## Acceptance (must be shown, not assumed)

1. SQL check returns **zero** rows where any display name, company name, or job title/office matches `(test|dummy|root|probe|smoke|fixture)` case-insensitively across `job_seekers`, `employers`, `super_admins`, `job_vacancies`.
2. Spot-check output shows the eight mapped rows + three sample spike rows Title Cased.
3. `npm test` passes (report any suite that self-skips).
4. `npm run lint` passes.

## Extension: smoke posts and companies (approved 2026-11-22)

| Field | Current | New |
|---|---|---|
| `employers.company_name` (5eed…0002) | smoke test company | Santa Maria Food Services |
| `employers.company_name` (5eed…0003) | smoke pending fixture co. | Bulacan Retail Supply Co. |
| `job_vacancies.title` (5eed…0011) | Smoke Test Service Crew | Service Crew |
| `job_vacancies.office` (5eed…0011) | smoke test company | Santa Maria Food Services |
| `job_vacancies.description` (5eed…0011) | Fixture vacancy driven by scripts/system-check.mjs… | Serve customers, prepare orders, and keep the store clean. Entry-level applicants welcome. |

Same values in `db/seed-dev.sql`; `scripts/system-check.mjs` constants update to `JOB.title = 'Service Crew'` and `PENDING_COMPANY_HINT = 'Bulacan Retail Supply'` (must still match the pending company row). Leave the real-user post `Jollibee Crew` (description `test`) untouched.

## Out of scope

Emails, passwords, auth users (no `auth` schema in this DB), real-user rows (`hans…`, `jarvit…`, `levie…`, `jean…`), real-user job posts (`Jollibee Crew`), schema.

## Verification commands

```
node <temp script using pg + server/.env>   # read-only name audit
npm test
npm run lint
```
