# File & image storage audit — 2026-11-05

**Scope:** resume PDFs, employer accreditation documents, company logo, job-seeker
profile picture. Tested against a live API (`:4100`), the bench database, real
Supabase sessions, a real browser, and read-only checks of the demo DB.

## 1. Where the bytes actually live

| Asset | Bytes stored | Metadata stored | Location |
|---|---|---|---|
| Resume (PDF/DOC/DOCX/PNG/JPG) | **local disk** | `public.resumes` row: `id`, `seeker_id`, `file_path`, `file_name`, `is_active`, `uploaded_at` | `server/uploads/resumes/<userId>/<uuid>-<name>` |
| Employer document | **local disk** | `public.employer_documents`: `file_path`, `file_name`, `doc_type`, `status`, timestamps | `server/uploads/documents/<companyId>/<uuid>-<name>` |
| Company logo | **nothing** (only an optional text URL/path) | `employers.logo_path text` | no upload path exists |
| Job-seeker profile picture | **nothing** | **no column, no endpoint** | browser memory only (data URL) |

There is **no `bytea`/large-object/binary column anywhere** in `db/schema.sql`.
A resume row is **184–216 bytes**; the file it points at was 0.3–2 MB in tests.
`UPLOAD_DIR=uploads` in `server/.env` is **relative to the process working
directory**, so the physical root depends on where the API is started
(`server/uploads` via `npm run dev:api` / `start-api.bat`; `<repo>/uploads` if
started as `node server/src/index.js` from the repo root).

Measured upload: 500 KB cold **454 ms** (includes JWT validation), 1.9 MB and
exactly 2 MB warm **15 ms**, 300 KB **59 ms**. Size rules: PDF ≤ 2 MB, all files
≤ 5 MB; exactly 2 MB accepted, 2 MB + 1 rejected 400, 4.9 MB accepted,
5 MB + 1 rejected 400. Byte-for-byte SHA-256 round-trip matched.

**Persistence:** survives an API restart (verified: file re-downloaded,
`200`, 122,889 bytes after restart). A DB row whose file is missing answers
`404 File not found` (verified by deleting the file) — so a `pg_dump` restore
alone yields dangling paths. `db/README.md`'s dump/restore procedure does not
include the uploads directory.

## 2. Caching

- **No server-side cache.** Every download reads the disk.
- Browser HTTP cache: `Cache-Control: public, max-age=0`, weak `ETag`,
  `Last-Modified`, `Accept-Ranges: bytes`. Conditional GET with
  `If-None-Match` / `If-Modified-Since` correctly returns **304** (raw HTTP
  verified; `fetch`/curl header plumbing initially hid it). Range returns 206.
- `public` + no `Vary: Authorization` is wrong for authenticated PII; shared
  proxies may store the bytes. `private` is the correct directive.
- Profile page fetches **every resume in full** on mount just to build
  View/Download links (6 full downloads observed on one profile), then revokes
  the object URLs on unmount.

## 3. Retention

No TTL and no cleanup for files or documents. Only `DELETE /files/resumes/:id`
removes a file. Employer documents have **no delete endpoint**, there is **no
account-deletion endpoint**, and the 12-month retention job deletes only old
`job_applications`. Every new resume upload is a new file (old ones are merely
deactivated), so storage grows without bound (≤ 50 uploads / 15 min / user,
2 MB each = up to 100 MB per 15 min per account).

## 4. Issues found

| # | Severity | Issue | Evidence |
|---|---|---|---|
| F1 | **High (matches report)** | Profile picture is **client-only**: `FileReader` → `data:` URL in React state; never uploaded, no API call, lost on unmount/refresh. No column, no route. | Browser: preview appeared (936 KB data URL), **0 API requests**, gone after navigating away and after refresh. |
| F2 | **High (DR)** | Files are **not in the DB and not in the documented backup**. Restoring a `pg_dump` reproduces rows but not bytes → 404s. | Missing-file simulation: `404 File not found` with the row intact. |
| F3 | **Medium-High** | **Concurrent resume uploads return 500**: the one-active-resume unique index races between the deactivate+insert transactions. | 6 simultaneous uploads → `[201, 500, 500, 201, 500, 201]`; log shows 3 × `23505` duplicate key. Files were correctly unlinked. |
| F4 | **Medium** | Deleting the **active** resume leaves the seeker with **no active resume** (no promotion of another row); applications referencing it have `resume_id` set to `null` by the FK. | After deleting active among 10 rows: `active = 0`. |
| F5 | **Medium (privacy)** | Download responses are `Cache-Control: public` without `Vary: Authorization` — authenticated resumes/documents should be `private`. | Headers from a real download. |
| F6 | **Medium (security)** | Upload validation is **extension-only** (plus the browser-supplied MIME on the client): EXE bytes named `.pdf` are accepted, stored and served as `application/pdf`. No AV/magic-byte check. | Uploaded `MZ…` bytes as `.pdf` → 201; downloadable. |
| F7 | **Medium (ops)** | `UPLOAD_DIR` is relative to CWD; starting the API from another directory writes/looks in a different folder. Bench and demo APIs also share one uploads tree in dev. | `UPLOAD_DIR=uploads`; path resolved via `process.cwd()`. |
| F8 | **Medium** | Company logo has **no upload UI**; `logo_path` is allow-listed but unused. Public job cards receive it raw, so an internal auth-gated path would 401 for anonymous visitors. | Browser: 0 file inputs / no logo control on Company profile; `logo_path` exposed verbatim in the public jobs payload. |
| F9 | **Low-Medium** | Profile page downloads all resumes in full just to link them; page weight grows with file count/size. | 6 × GET on resume files during one profile load. |
| F10 | **Low** | No `Content-Disposition` on file responses (PDFs inline); no per-user storage quota; empty user directories are never pruned. | Headers; uploads tree inspection. |

**Works correctly:** path traversal refused; filenames sanitized + UUID-prefixed;
owner/employer/admin authorization per file; 2 MB/5 MB boundaries; byte
integrity; 304/206; delete removes row + disk file; failed DB writes unlink the
just-written file; demo DB is consistent (2 resume rows, 0 missing files).

## 5. If pictures must be “in the database”

Store **avatars/logos as `bytea`** (small, resized to ≤ 256 KB, with mime +
updated_at) and keep **PDFs on disk/object storage** with metadata in Postgres:

- 20k seekers × 2 MB resume in `bytea` ≈ **40 GB** in Postgres — bloats every
  dump, backup and restore, and the 1 MB JSON body cap blocks data-URL photos
  anyway (verified: a 1.1 MB logo data URL → 400 `PAYLOAD_TOO_LARGE`).
- A 256 KB avatar is cheap in `bytea` and makes the profile picture atomic with
  the profile row — matching the “must survive refresh” requirement.
- Serving: `GET /api/seekers/:id/avatar` (or employer logo) with
  `Cache-Control: private, max-age=300` + ETag; add `webp` server-side (the
  photo input already accepts it).
- If the project insists on DB bytes for **all** files: dedicated `files` table
  with `bytea`, multipart streaming, quotas, and backups sized accordingly;
  do not extend the current 1 MB JSON limit.

## 6. Suggested fix order

1. F1 profile picture: add `avatar` storage + upload route + wire the existing input; show it in the header as well.
2. F2 backup: include `server/uploads` in deployment backup (or move to object storage) and document it.
3. F3 serialise resume uploads per user (advisory lock or retry on 23505 → 409/201).
4. F4 promote another resume on delete, or refuse deleting the active one.
5. F5 set `Cache-Control: private` (+ `Vary: Authorization`).
6. F6 verify magic bytes server-side; optionally scan.
7. F8/F7/F9/F10 as normal hardening.

## 7. Resolution (2026-11-05) — ADR-040

| # | Status | What changed |
|---|---|---|
| F1 | **Fixed** | `profile_images` table (`bytea`, ≤ 2 MB, mime check); `POST/DELETE /api/seekers/me/avatar`; client resizes to 512 px JPEG, uploads, and reloads the saved image as an object URL. `GET /auth/me` carries `has_avatar` + version so a photo-less profile makes no image request. |
| F2 | **Fixed operationally** | `npm run backup:uploads` archives `server/uploads`; `db/README.md` now documents dump **+** archive as one backup, with the restore command. Verified: archive lists `uploads/resumes/...`. |
| F3 | **Fixed** | `pg_advisory_xact_lock(hashtext(userId))` around deactivate+insert (upload) and around activate. Live: 6 concurrent uploads → six 201s, one active; 12 concurrent activations → twelve 200s, one active. |
| F4 | **Fixed** | Deleting the active resume promotes the newest remaining row in the same transaction. Live: `active = 1` after delete. |
| F5 | **Fixed** | Authenticated file + avatar responses are `private, max-age=0, must-revalidate` + `Vary: Authorization`; public logos are `public, max-age=300` but versioned by `?v=<updated_at>`. |
| F6 | **Fixed (content, not AV)** | Magic-byte check for PDF/DOC/DOCX/PNG/JPEG/WEBP on both disk and memory uploads; mismatch → 400 and the temp file is unlinked. Live: `MZ…` named `.pdf` and text named `.png` → 400. No antivirus scanner was added. |
| F7 | **Fixed** | Relative `UPLOAD_DIR` resolves against `server/`, never CWD; the resolved path is logged at boot. Verified by starting the API from the repo root. Two dev APIs still share `server/uploads`; filenames are UUID-prefixed so they cannot collide. |
| F8 | **Fixed** | `POST/DELETE /api/employers/me/logo` (resized client-side, bytes in Postgres) and a public `GET /api/employers/:id/logo`. Company Profile has upload/remove controls and renders the saved logo. Public job cards still use the initials mark — wiring them to the logo endpoint is a design follow-up, not a data defect. |
| F9 | **Fixed** | Resume View/Download fetch on click instead of on page load; one profile visit no longer downloads every PDF. |
| F10 | **Fixed / partial** | `Content-Disposition: inline; filename=` on downloads; resume count cap of 20 (checked before multer writes); empty per-user folders pruned after delete. No byte-quota across documents; no AV. |

Also: magic-byte + size validation applies to image uploads (2 MB cap), and
`db/schema.sql` bootstraps `profile_images` on a fresh database (verified by
creating a new DB from the file, inserting/reading a row, and confirming the
2 MB and mime constraints reject bad rows).

**Verification at close-out:** server 478/478 (the untracked
`tokenCache.negative.test.js` from the concurrent session is excluded and fails
on its own), frontend 513/513, `eslint .` clean, live file harness 37/37,
real-Chrome browser harness 102/102 (includes upload → navigate away → return →
still visible, for both avatar and logo).
