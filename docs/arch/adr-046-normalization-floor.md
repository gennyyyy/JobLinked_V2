# ADR-046 — Normalization floor: 3NF/BCNF with four approved denormalizations

**Status:** SIGNED OFF 2026-11-11 (owner requested max normalization for efficiency, without diminishing returns; two independent audits reached the same verdict)
**Analysis:** `docs/plan/2026-11-11-db-normalization-analysis.md`

## Decision

1. **The schema stays at the 3NF/BCNF floor for all transactional tables.** No further structural decomposition. 4NF/5NF nor any later NF applies: no unenforced multivalued or join dependencies exist (every table has single-column PKs, or a second candidate key whose columns are all superkeys — `job_applications(job_id,seeker_id)`, `reference_data(category,value)`).
2. **Four denormalizations are approved and permanent until the trigger condition below fires:**
   - `employers.accreditation_status` / `accreditation_remarks` — trigger-maintained snapshot (`schema.sql:381-400`). Serves the publish guard (`jobs.js:224-228`), admin joins (`admin-jobs.js:22`), and dashboard filters (`admin.js:31`). Revisit only if per-company accreditation rows grow to many per read path.
   - `employment_history.employer_name` / `position` / `seeker_id` — historical snapshots from `record_accepted_employment` (`schema.sql:294-328`). These are placement *records*, not caches: with migration 008's `set null` FK they must survive job deletion. A live join would destroy the factual history.
   - `full_name` stored on the three role tables — kept because invite-only flows (`admin-users.js:248-249`) legitimately lack name components, and it indexes search/sort (`schema.sql:460-465`, `admin.js:88`, `admin.js:194`). Invariant: name components, when present, are the single source; `full_name` is derived from them and never written independently (enforced server-side, P2 in the analysis plan).
   - `skills`/`tags text[]` arrays — the native Postgres access path (`&&` overlap + GIN, `schema.sql:441`, `jobs.js:178`) for this access pattern; a join table would slow every profile read and add no integrity the app-boundary normalization doesn't already provide.
3. **Soft references without FK are approved** (`notifications.user_id`, `profile_images.owner_id`, `audit_logs.user_id`, both `*_status_history.changed_by`) — fan-out across three role tables and log-survival semantics. Safe because no server route deletes role rows. If user deletion is ever added, add archival/SET-NULL rules in the same change.
4. **Deliberately cut by design (confirmed, not reopened):** skills → join table, barangay/PSGC location tables, typed dictionaries for `reference_data`, unified `accounts` table, `employment_type`/`education.level` FKs. Each skipped by the analysis plan's cost/benefit table with citing access patterns (`gap-matrix.md:202` recorded the cuts).

## Consequences

- List values that gains a DB CHECK (e.g. `employment_type`) change only via a migration file plus its schema.sql sync — never live DDL, never an un-migrated append to the list in application code.
- All write paths for a denormalized attribute route through one location (trigger for accreditation; shared `buildFullName` helper, now applied at every profile PATCH; lowercase normalization helper for tags/skills). The interface for "where does X get written" is the ADR-046 table above.
- Known ceilings accepted and documented in the analysis plan: dormant `?skills=` search predicate is not index-served (expression-index DDL is in the plan, apply only when that filter carries traffic); accreditation trigger has no DELETE branch (no delete path exists); `education.level` is case-un-normalized (dictionary constraint deliberately NOT added — nothing queries it).
