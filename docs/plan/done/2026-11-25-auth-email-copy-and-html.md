# Auth email copy refresh — verification + password reset

- **Status:** Approved by user 2026-11-25. Dispatch: `backend`.
- **Owner of contract:** architect. No schema or config change.

## Confirmed brief

- **What:** Replace the verification and password-reset email bodies in `server/src/mailer.js` with the copy below (short greeting, purpose, link, 1-hour expiry line, sign-off). Add a simple HTML part alongside the plain text.
- **How:** Extend `deliver()` to pass `html` to nodemailer when provided. Build `text` + `html` in `sendVerificationEmail` and `sendResetPassword`. Keep subjects unchanged. Escape the user's name before it enters HTML. No new dependencies.
- **Done when:** `npm test` in `server/` passes; dev mode (`SMTP_HOST` unset) logs `dev_mail` containing the new `text` and `html`; both bodies include greeting, `url`, and the expiry line.
- **Out of scope:** Supabase templates (dead per ADR-056), HTML styling/branding, changing the 1-hour expiry, `sendExistingAccountEmail` copy.
- **Assumptions:** expiry stays 1 hour (Better Auth defaults; repo sets no override). `user.name` falls back to `there`. Plain text remains the fallback part.

## Approved copy (verbatim)

### Verification

Subject: `Verify your JobLinked email`

```
Hi {name},

Welcome to JobLinked! Please confirm your email address by opening the link below.

{url}

This link expires in 1 hour. If you didn't create a JobLinked account, you can ignore this email.

— The JobLinked team
```

### Password reset

Subject: `Reset your JobLinked password`

```
Hi {name},

We received a request to reset the password for your JobLinked account. Open the link below to choose a new password.

{url}

This link expires in 1 hour. If you didn't request this, you can ignore this email — your password will stay the same.

— The JobLinked team
```

`{name}` = `user.name` trimmed, else `there`.

## Implementation notes

- `server/src/mailer.js`: `deliver` gains an `html` field; `sendMail({ from, to, subject, text, html })` — omit `html` when absent so the existing-account mail is unchanged.
- HTML mirrors the text: paragraphs + one `<a href="{url}">` anchor ("Verify my email" / "Reset my password"). Escape the name (`&`, `<`, `>`, `"`, `'`). Do not restructure the text; the URL comes from Better Auth and is trusted.
- Dev branch keeps logging `url` and `text`; include `html` there too when present (matches the approved brief). Production still fails closed without the URL.
- Add a comment that the 1-hour line mirrors Better Auth defaults (`emailVerification.expiresIn`, `emailAndPassword.resetPasswordTokenExpiresIn`); update the copy if those are ever configured.
- Tests in `server/src/ba.test.js`: reset + verification dev sends expose greeting, URL, expiry line, and html. Cover the `there` fallback and HTML escaping of a name like `A <b>B</b>` against `ba.test.js`'s current mailer tests. Existing assertions stay green.

## Files

- `server/src/mailer.js` (only production file)
- `server/src/ba.test.js` (tests)
