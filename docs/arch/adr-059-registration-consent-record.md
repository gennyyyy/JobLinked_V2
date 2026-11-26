# ADR-059 — Server-recorded registration consent

- Status: Accepted
- Date: 2026-11-26
- Deciders: arch (sign-off), repo owner
- Related: ADR-053 (editable legal documents), ADR-060 (erasure)

## Context

The registration UI already locks the "agree to the municipal terms" checkbox
until the user opens the Terms (`src/features/auth/__tests__/termsGate.test.jsx`).
That acceptance is client state only: nothing in the database records that a user
accepted, when, or which version. Under RA 10173 the controller must be able to
demonstrate lawful basis; proof of consent is the weak point.

`/api/auth/provision` is the single place where a seeker/employer role row is
created (ADR-056). `pending_signups.profile` already carries the registration form
across email verification.

## Decision

Add `terms_accepted_at timestamptz` and `terms_version text` to
`job_seekers` and `employers` (migration 022).

At `/api/auth/provision`, for a **self-signup** (`job-seeker` or `employer`, no
admin invite):

- Accept `terms_accepted === true` from the provision body or from the user's
  `pending_signups.profile` (the registration form is parked there before email
  verification; both are the same user's assertion). Neither → `400
  CONSENT_REQUIRED`. The client cannot supply a timestamp or version.
- Server stamps `terms_accepted_at = now()` and
  `terms_version = (select updated_at from legal_documents where key = 'terms')`
  formatted ISO-8601. If the terms document is missing, store `'unknown'`.

Admin invites (`public.admin_invites` row present) are exempt: staff consent is
an HR/onboarding act, not a product checkbox.

The `/complete-registration` fallback form (an account with no pending row) shows
a required terms checkbox and sends the flag, so a failed pending write cannot
strand a user behind a permanent 400.

The former referral opt-in was retired by migration 021; no optional consent is
currently collected. Withdrawal of the terms acceptance means account erasure
(ADR-060), because processing the profile is necessary to provide the service.
The privacy notice must say so.

## Consequences

- Every client that calls `/auth/provision` for a seeker/employer must send the
  flag; existing server and frontend tests that omit it are updated.
- Pre-migration rows keep `null` consent fields; they are not backfilled (no
  evidence exists to invent).
- If the Terms are edited later, old rows keep the version they accepted.
- The version is a timestamp today. If PESO needs immutable version IDs, that is a
  later schema change, not speculative now.
