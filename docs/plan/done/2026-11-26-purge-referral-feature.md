# Purge the retired referral feature

**Status:** approved by user 2026-11-26 ("purge everything connected to that feature").
**Nature:** destructive schema change (drops two columns). DB target is local
`127.0.0.1:5433/myapp_db`; referral data was never written by the app.

## 1. Database

New `db/migrations/021_drop_referral_columns.sql`:

```sql
-- Retire the referral feature: nothing in the app ever wrote these.
drop index if exists public.job_applications_referred_idx;
alter table public.job_applications drop column if exists referred_by;
alter table public.job_seekers drop column if exists referral_opt_in;
```

Apply it to the local DB with the PostgreSQL 18 binary, reading the URL from
`server/.env` (never echo it):

```powershell
$url = (Select-String -Path server/.env -Pattern '^DATABASE_URL=').Line.Substring(13)
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' $url -v ON_ERROR_STOP=1 -f db/migrations/021_drop_referral_columns.sql
```

Then verify `\d public.job_applications` has no `referred_by` and `\d public.job_seekers`
has no `referral_opt_in` (e.g. `... -c "\d public.job_seekers"`).

`db/schema.sql` (authority for fresh installs):
- remove `referral_opt_in` from the `job_seekers` create table and the
  `alter table ... add column if not exists referral_opt_in` line;
- remove `referred_by` from the `job_applications` create table;
- remove the `job_applications_referred_idx` create index;
- update the index comment that names `/admin/referrals`;
- update the seeded legal documents (see §4) so fresh installs match `legal.js`.

Do **not** edit `supabase/migration.sql` — the schema header explicitly forbids it. Historical
migrations 001/003 stay as history; 021 reverses them.

## 2. Server

- `server/src/routes/admin.js`: delete `GET /admin/referrals` (lines ~121-133).
- `server/src/routes/account.js`: drop `referral_opt_in = false,` from the erasure UPDATE (~158)
  and the `referral_opt_in` key from the export payload (~238).
- `server/src/routes/account.erase.test.js` / `account.export.test.js`: update the expected SQL
  and export object.
- `server/scripts/verify-live.mjs`: remove the `admin referrals list` check (~489).
- `docs/arch/specs/2026-11-26-account-compliance-api.md`: remove `"referral_opt_in": false` from
  the export example and fix the JSON comma.

## 3. Super-admin UI

- `src/features/super-admin/Applications.jsx`: remove the `referral` state, the referral filter
  condition and dependency, the description clause "and record referral markers. No external
  referral is sent." (→ "Monitor recruitment outcomes across every posted vacancy."), the
  "Recorded referrals" stat, the `applications-referral` SelectField, the Referral table header
  and its "Referred / Not referred" cell, and the `Referral` CSV column plus its value.
- `src/features/super-admin/Dashboard.jsx`: remove the "Recorded referrals" stat.
- `src/features/super-admin/Reports.jsx`: remove the `referrals` computation, its stat card, the
  "referrals" wording in the page description and footnote, and the referral definition entry.
- Update `Applications.test.jsx`, `Dashboard.test.jsx`, `ReportsCsv.test.jsx` accordingly
  (remove referral fixtures/assertions, don't weaken the rest).

## 4. Legal copy (both copies must match)

`src/shared/content/legal.js` and the seeded text in `db/schema.sql`:

- Privacy "Application records": drop ", referral records" →
  `the vacancies you applied to, and recruitment status updates.`
- Privacy purposes: `Process applications and facilitate PESO employment assistance.`
- Delete the sentence `Sharing your profile with other prospective employers for additional PESO
  referrals requires a separate legal basis, including your optional consent where applicable.`
- Terms: `JobLinked is a matching service. Registration and matching do not guarantee
  employment.`
- Terms: `Application records are retained as described in the Privacy Notice...`
- Keep the DPO sentence ("for referral to the Municipality's designated Data Protection
  Officer") — unrelated to this feature.

## Out of scope

- PESO services copy ("referral assistance", "announcements and referrals") — that is a PESO
  service description, not this feature.
- Historical ADRs/audits/plans and old migrations (they record history).
- `supabase/migration.sql` (explicitly frozen).

## Done when

- The local DB no longer has either column; fresh `schema.sql` no longer creates them.
- No live route/UI/test references `referred_by` or `referral_opt_in` outside historical
  migrations/ADRs.
- `npx vitest run src/features/super-admin server/src/routes` and `npm run lint` pass.
