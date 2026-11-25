# Branded HTML design for auth emails

- **Status:** Approved by user 2026-11-26. Dispatch: `backend`.
- **Owner of contract:** architect. No schema or config change.

## Confirmed brief

- **What:** Give all three auth emails — verification, password reset, duplicate-account — a branded HTML design. Verification/reset keep the approved copy; duplicate-account keeps its current copy and links. Plain-text parts stay as the fallback.
- **How:** One shared email layout (table-based, inline CSS) in `server/src/mailer.js`; icon URL from `appOrigin()`; escape the name for text/HTML and the URL for the `href` attribute; no new dependencies or assets. Update `server/src/ba.test.js`.
- **Done when:** `npm test` in `server/` passes; dev mode (`SMTP_HOST` unset) logs `dev_mail` with the branded `html`; all three mails carry the card markup and correct CTA links.
- **Out of scope:** Supabase templates, adding files to `public/`, dark mode, tracking pixels, copy or expiry changes.
- **Assumption:** production serves `${appOrigin()}/joblinked-icon.png`; if images are blocked, clients show `alt="JobLinked"`.

## Design spec

Light-mode only, inline CSS, table layout. Brand tokens from `src/index.css`: primary `#2563eb`, navy `#12325b`, accent `#edf4ff`, border `#e4eaf1`, text `#334155`, muted `#64748b`.

- Page background `#f1f5f9`, 24px/12px outer padding.
- 600px white card (`width:100%;max-width:600px`), `border:1px solid #e4eaf1`, 12px radius, hidden overflow.
- Header (24px 32px, top): `joblinked-icon.png` 48×48, `alt="JobLinked"`, 12px radius; text "JobLinked" 20px bold navy, 12px left gap.
- Body (24px 32px 32px):
  - Greeting 16px semibold navy (verification/reset only; duplicate-account keeps its copy without a greeting).
  - Purpose/body 15px/24px `#334155`.
  - CTA: table cell `bgcolor="#2563eb"`, 8px radius, anchor `display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;text-decoration:none`. One per mail.
    - verification: `Verify my email` → `url`
    - reset: `Reset my password` → `url`
    - duplicate-account: `Log in` → `${appOrigin()}/login`
  - Raw link fallback: 12px `#64748b`, `word-break:break-all`, link `#2563eb`.
    - duplicate-account secondary link: `Reset your password` → `${appOrigin()}/forgot-password`.
  - Note box: full width, `background:#edf4ff`, 8px radius, 12px 16px, 13px/20px navy.
    - verification: expiry line + "If you didn't create a JobLinked account, you can ignore this email."
    - reset: expiry line + "If you didn't request this, you can ignore this email — your password will stay the same."
    - duplicate-account: "If you didn't try to register, you can ignore this email." (no expiry claim)
  - Sign-off 15px `#334155`: "— The JobLinked team" (verification/reset; duplicate-account keeps its current text without sign-off).
- Footer under the card: 12px `#64748b`, centered. Per-mail reason + "© 2026 JobLinked".
- Hidden preheader div at body start.
- Text parts unchanged (verification/reset approved copy; duplicate-account current text).

## Implementation notes

- `mailer.js`: add `emailLayout({ preheader, bodyHtml, footerNote })` returning the full document; per-mail body builders. Keep `escapeHtml` for the name; add attribute escaping for URLs (`&` → `&amp;`, `"` → `&quot;`). Purpose/note/footer strings are constants and trusted.
- Use `appOrigin()` once per send for icon and duplicate-account links.
- `deliver()` already forwards `html`; no change needed there.
- Tests: the existing SMTP-transport assertion that the duplicate-account mail omits `html` is now wrong — update it. Assert the branded markup, CTA hrefs, icon URL, and escaped name for all three mails. Keep snapshot-free assertions.

## Files

- `server/src/mailer.js` (only production file)
- `server/src/ba.test.js` (tests)
