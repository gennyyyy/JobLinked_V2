# Account compliance API contract (RA 10173)

Base path `/api`. Auth: `Authorization: Bearer <token>` (`tokenAuth`).
Error shape is the existing one:

```json
{ "error": { "code": "CONFIRM_REQUIRED", "message": "Confirmation required" } }
```

## 1. `DELETE /api/account`

Erase the caller's account per ADR-060. Seeker and employer only.

**Request body**

```json
{ "confirm": "ERASE" }
```

**Success — 200**

```json
{ "erased": true, "role": "job-seeker" }
```

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `CONFIRM_REQUIRED` | body missing or `confirm !== "ERASE"` |
| 401 | existing auth error | no/invalid token |
| 403 | `FORBIDDEN` | caller resolves to `super-admin` |
| 404 | `NOT_FOUND` | no role row for the caller |

**Guarantees**

- One database transaction; every role row for the id is scrubbed, not only the
  role `resolveRole()` returns (a role move leaves a stale row).
- Better Auth user and its verification rows are deleted, the legacy Supabase
  session is revoked when configured, and the process token cache is cleared —
  every session is invalid on response.
- Response is sent only after commit, with the `account.erase` audit row committed
  in the same transaction.
- A repeat call is unauthenticated (401), not a second erasure.
- Archived vacancies have their text cleared so the posting cannot re-identify an
  erased employer.
- Free-text professionally authored about the user (`employer_notes`,
  `interview_instructions`, `application_status_history.remarks`) is nulled.
- Application and placement rows stay for PESO reporting; job posts of an erased
  employer are archived.
- The erased `email` is `erased+<user-id>@invalid.local`, so erasing any number of
  accounts cannot collide on the unique email index.

## 2. `GET /api/account/export`

Return the caller's own data as a JSON download. Seeker and employer.

**Success — 200** (`Content-Disposition: attachment; filename="joblinked-export.json"`)

```json
{
  "exported_at": "2026-11-26T08:00:00.000Z",
  "role": "job-seeker",
  "profile": { "...": "the caller's role-table row" },
  "consents": {
    "terms_accepted_at": "2026-11-20T02:11:00.000Z",
    "terms_version": "2026-11-01T00:00:00.000Z"
  },
  "applications": [
    {
      "id": "uuid",
      "job_title": "Sales Associate",
      "company_name": "Example Store",
      "status": "Interview",
      "applied_at": "2026-11-21T...",
      "interview_at": null,
      "employer_notes": null,
      "interview_instructions": null,
      "status_history": [
        { "status": "Applied", "remarks": null, "changed_at": "..." }
      ]
    }
  ],
  "notifications": [
    { "type": "application", "title": "...", "message": "...", "created_at": "..." }
  ],
  "documents": {
    "resumes": [{ "file_name": "cv.pdf", "uploaded_at": "..." }]
  }
}
```

**Exclusions (normative):** no password hashes, no session/token data, no other
users' identities, no internal audit rows.

**Employer envelope.** Same top-level keys, with `job_vacancies` and
`accreditations` in place of `applications`:

```json
{
  "exported_at": "2026-11-26T08:00:00.000Z",
  "role": "employer",
  "profile": { "...": "the employer's row without accreditation_remarks" },
  "consents": { "terms_accepted_at": "...", "terms_version": "..." },
  "job_vacancies": [
    { "title": "Sales Associate", "status": "published", "created_at": "...", "deadline": "..." }
  ],
  "accreditations": [
    { "status": "approved", "submitted_at": "...", "decided_at": "..." }
  ],
  "documents": {
    "accreditation_documents": [
      { "doc_type": "bir", "file_name": "2303.pdf", "status": "verified", "uploaded_at": "..." }
    ]
  }
}
```

No applicant PII, no `decided_by`/`reviewed_by` UUIDs, no internal remarks.
**Notifications are omitted from the employer envelope**: their bodies are
operational records that can reference applicants or carry PESO remarks; the
employer reads them in-app. `profile.accreditation_remarks` is stripped for the
same reason.

**Errors**

| Status | Code | When |
|---|---|---|
| 401 | existing auth error | no/invalid token |
| 403 | `FORBIDDEN` | caller resolves to `super-admin` (no staff export envelope) |
| 404 | `NOT_FOUND` | no role row |

## 3. `POST /api/auth/provision` (changed)

ADR-059 adds one required field for self-signup:

```json
{ "role": "job-seeker", "terms_accepted": true, "...": "profile fields" }
```

Missing/false → `400 CONSENT_REQUIRED` for seeker/employer when no admin invite
exists. Admin-invite provisioning is unchanged. Response shape is unchanged.

## Explicitly not part of this contract

- No retention scheduler in the app. Retention is an ops runbook + SQL purge.
- No admin-triggered erasure. Admins may use existing deactivation; erasure is a
  data-subject action.
- No partial erasure ("delete my resume only") — `DELETE /api/files/resumes/:id`
  already covers that.
