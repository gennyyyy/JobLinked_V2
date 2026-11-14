# ADR-053: Editable legal documents (privacy notice and terms of use)

**Status:** Accepted (implemented 2026-11-15)
**Date:** 2026-11-15
**Owner:** Lead Architect

## Context

The Privacy Notice and Terms of Use were hard-coded constants in
`src/shared/content/legal.js`, so changing them required a code change and
redeploy. The rework needs a super-admin to view and edit both documents
from `/super-admin/settings`, with the public pages and the registration
consent modal reading the published text.

## Decision

1. **Storage.** New additive table `public.legal_documents`
   (`key text primary key, body text not null, updated_at timestamptz not null default now(), updated_by uuid`).
   Two rows seeded: `privacy`, `terms`. Seed uses `on conflict (key) do nothing`
   so re-running `schema.sql` never overwrites an admin edit.
2. **Public read.** `GET /legal/:key` is unauthenticated and returns
   `{ key, body, updated_at }`; an unknown key returns `404 NOT_FOUND`.
3. **Admin edit.** `PATCH /admin/legal/:key` requires `auth`,
   `requireRole('super-admin')`, and `settings.manage`; body `{ body }` is
   trimmed and must be non-empty (`400 BAD_REQUEST`); unknown key → `404`;
   key must be `privacy` or `terms` (`400` otherwise). Each successful update
   writes an audit `settings.legal.update` with `{ key }` only — never the body.
4. **Bundled fallback.** `src/shared/content/legal.js` remains the seed source
   and the client fallback. `getLegal(key)` returns `body`, falling back to
   `PRIVACY_NOTICE`/`TERMS_OF_USE` on any error or empty body, with a
   module-level in-flight promise cache shared by the public page and the
   consent modal. `updateLegal(key, body)` calls the PATCH endpoint.
5. **No rich text.** Plain `<textarea>`; documents are plain text.
6. **Permission-aware UI.** The settings "Legal documents" section disables
   editing and shows a notice when `!hasPermission(user, 'settings.manage')`.
7. **Public readers.** `Legal.jsx` and the registration consent modal fetch
   via `getLegal` with a loading skeleton and the bundled fallback on error;
   they never fail because the API is down.

## Consequences

- Legal text is editable without a redeploy; the bundle stays the seed and
  fallback, so the site never breaks if the API is down.
- Edits are audited (key only) and permission-gated; empty/whitespace bodies
  are rejected and the previous version is kept.
- One additive schema change (`legal_documents`); rollback is `drop table`.
- No new dependencies; no rich-text editor.

## Follow-ups (not blocking)

- Version history / diffing of legal documents is out of scope.
- Client-side markdown rendering is not added (plain text only).