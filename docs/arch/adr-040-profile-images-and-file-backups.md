# ADR-040 — Profile images in Postgres; resumes stay on disk with an explicit backup

- **Status:** Accepted
- **Date:** 2026-11-05
- **Context:** file-storage audit (`docs/arch/testing/2026-11-05-file-storage-audit.md`)
- **Schema change:** `db/migrations/010_profile_images.sql`, `db/schema.sql`

## Problem

1. The job-seeker “profile picture” was never stored: a `FileReader` data URL in
   React state, lost on unmount/refresh. There was no column and no endpoint.
2. The company logo had a `logo_path` text column but no upload UI, and an
   internal auth-gated path cannot render on a public job card.
3. PDFs live on local disk; the documented `pg_dump` backup omits them, so a
   restore leaves dangling rows (verified: valid row + missing file → 404).
4. Concurrent resume uploads raced the one-active partial index → 500.

## Decision

**Small images (avatars, company logos) are stored as bytes in Postgres.**
A single table keeps them out of the role rows, so the existing `select *`
profile queries can never serialize megabytes of image data:

```sql
create table public.profile_images (
  owner_id   uuid not null,          -- role-row id (no FK: role moves keep the id)
  kind       text not null check (kind in ('seeker-avatar','employer-logo')),
  mime       text not null check (mime in ('image/png','image/jpeg','image/webp')),
  bytes      bytea not null check (octet_length(bytes) <= 2097152),
  updated_at timestamptz not null default now(),
  primary key (owner_id, kind)
);
```

- Client resizes to ≤ 512 px JPEG before upload; 2 MB is the hard server cap.
- `GET /api/seekers/:id/avatar` is authenticated (self, linked employer, admin);
  `GET /api/employers/:id/logo` is public (business branding) and cacheable.
- Photo metadata (`has_avatar` / `has_logo` + version) is returned by the
  profile GETs; `/auth/me` is unchanged.

**Resumes and accreditation documents stay on disk** (path in Postgres).
Storing every 2 MB PDF in `bytea` would add ~40 GB per 20k seekers to every
dump/restore, and the 1 MB JSON cap already blocks data-URL photos. The fix for
the backup gap is operational and mandatory: `npm run backup:uploads` creates a
timestamped archive next to `pg_dump`, documented in `db/README.md`.

**Upload directory is deterministic.** A relative `UPLOAD_DIR` resolves against
the server package (`server/`), never `process.cwd()`, and the resolved path is
logged at boot.

**Uploads are content-checked.** Extension allow-list plus magic-byte sniffing
(PDF, DOC, DOCX, PNG, JPEG, WEBP); a mismatch is 400 and the file is unlinked.

**Cache policy.** Authenticated files: `Cache-Control: private, max-age=0,
must-revalidate` + `Vary: Authorization` (ETag/304 unchanged). Public logos:
`public, max-age=300` (the client appends `?v=<updated_at>`, so a replaced
logo gets a new URL). Avatars: `private, max-age=0, must-revalidate` — the
same URL is reused after replacement, so a positive max-age would show the
old photo.

**Concurrent resume uploads serialise per user** with
`pg_advisory_xact_lock(hashtext(userId))` inside the existing transaction; the
one-active index can no longer race. Deleting the active resume promotes the
newest remaining one in the same transaction.

## Consequences

- Profile pictures survive navigation, refresh, and a database restore.
- `pg_dump` alone is still an incomplete backup: the deploy procedure must run
  both commands. The backup script fails loudly if `tar` is unavailable.
- Image bytes are capped at 2 MB and resized client-side; no image processing
  dependency is added server-side.
- No FK on `owner_id`, matching `notifications`: a role move keeps the id, and
  an orphan image is harmless (and removable via the DELETE endpoints).
