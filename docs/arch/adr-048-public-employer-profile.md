# ADR-048 — Public employer profile + published jobs listing

Job browsing now links a vacancy to its employer: a visitor can open an
employer's public profile and see that company's published postings beneath
it. We reuse the existing `employers` row (no schema change) and expose a
filtered public projection; the employer's jobs endpoint is opened to
anonymous callers but pinned to `published` for everyone except the owner
or a super-admin.

- **Status:** accepted
- **Considered options:** (a) a new `company_profiles` table duplicating
  employer fields; (b) reusing `employers` with a public projection. Chose (b)
  — one source of truth, no migration, no sync drift.
- **Consequences:** public responses must never include PII (representative
  name/email/phone, full street address, email); only company-facing fields
  (name, industry, description, website, city/province/barangay, accreditation
  status, logo). The jobs endpoint's auth guard changes from "owner or admin"
  to "optional auth; non-owner sees published only", so anonymous traffic now
  hits it — rate-limited by the existing `apiLimiter`. No new dependency.