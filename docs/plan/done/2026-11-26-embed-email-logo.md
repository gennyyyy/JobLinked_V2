# Fix email logo — embed icon as a CID attachment

- **Status:** Approved by user 2026-11-26. Dispatch: `backend`.
- **Owner of contract:** architect. No schema or config change.

## Confirmed brief

- **What:** Embed the JobLinked icon inside all three auth emails instead of hotlinking it. Header stays icon + "JobLinked" text.
- **How:** `server/src/mailer.js` resolves `public/joblinked-icon.png` from the repo root, attaches it inline via nodemailer `cid`, and the HTML uses `<img src="cid:joblinked-logo">`. No remote URL or `CORS_ORIGIN` dependency for the icon. `appOrigin()` stays only for the duplicate-account links.
- **Done when:** `npm test` in `server/` passes; the transport call carries the inline attachment; the HTML references the CID.
- **Out of scope:** the reset link still using Better Auth's dev `baseURL` (`http://localhost:4000/...`), wordmark changes, remote-image fallbacks.
- **Assumption:** deployment includes the repo-root `public/` directory (runbook's `/srv/joblinked` git pull does).

## Implementation notes

- Path: `fileURLToPath(new URL('../../public/joblinked-icon.png', import.meta.url))` in `server/src/mailer.js` (`server/src` → repo `public/`). Use `node:fs` `existsSync` and `node:url` `fileURLToPath`; no dependencies.
- `deliver()`: when `html` is present and the file exists, pass `attachments: [{ filename: 'joblinked-icon.png', path: LOGO_PATH, cid: 'joblinked-logo', contentDisposition: 'inline' }]` to `sendMail`. When the file is missing, omit the attachment — the mail must still send, with the img alt text as fallback.
- `emailLayout`: header `<img src="cid:joblinked-logo" width="48" height="48" alt="JobLinked">`. Remove the `${origin}/joblinked-icon.png` construction and its escaping. `origin` remains a layout param only for the duplicate-account links.
- Dev branch: unchanged (logs `text`/`html`; `cid:` does not render in a browser preview — expected).
- Tests in `server/src/ba.test.js`: replace the icon-URL assertions with `src="cid:joblinked-logo"` and assert no remote icon URL remains; assert the transport receives the inline attachment (filename, cid, `contentDisposition: 'inline'`) for auth mails, and that the existing-account mail also carries it. Keep the mail-sends-when-logo-missing behavior untested unless trivial.

## Files

- `server/src/mailer.js` (only production file)
- `server/src/ba.test.js` (tests)
