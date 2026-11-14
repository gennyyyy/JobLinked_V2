# ADR-053: Editable legal documents

**Status:** Accepted (implemented 2026-11-15)
**Date:** 2026-11-15
**Owner:** Lead Architect

## Context

The Privacy Notice and Terms of Use were hardcoded in `src/shared/content/legal.js`. PESO/counsel must be able to update them without a redeploy, and the public site plus the registration consent modal must reflect the published text.

## Decision

- **Storage:** a `legal_documents` table (`key text PK, body text not null, updated_at, updated_by`), seeded idempotently from the bundled constants (`on conflict (key) do nothing`).
- **Read:** public `GET /legal/:key` (no auth) returns `{ key, body, updated_at }`; unknown key → 404. The client (`getLegal`) caches one in-flight promise per key and falls back to the bundled constant on any error or empty body, so the site never breaks if the API is down.
- **Edit:** `PATCH /admin/legal/:key` gated on `settings.manage`; body required non-empty (400 otherwise); unknown key → 404; audit `settings.legal.update` (key only, never the body).
- **Admin UI:** a "Legal documents" section on `/super-admin/settings` with two textareas (Privacy notice, Terms of use), Save (disabled until dirty), success/error messages, and a "View published" link.
- **Registration consent modal** reads the published privacy notice via the same cached reader.
- **No rich text:** plain `<textarea>`; the documents are plain text.
- **Fallback:** `src/shared/content/legal.js` remains the seed and the client fallback.

## Consequences

- Legal text is editable at runtime; the public pages and consent modal reflect changes without a redeploy.
- Re-running `schema.sql` never overwrites an edit (idempotent seed).
- Unknown keys surface as 404 server-side but the client never fails (bundled fallback).
- Audit records the change without storing the body.
- Permission-gated: only `settings.manage` holders can edit.

## Follow-ups (not blocking)

- Rich-text/markdown rendering if counsel wants formatting.
- Version history / diff of edits (currently only `updated_at`/`updated_by`).
