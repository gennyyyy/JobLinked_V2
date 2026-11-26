import { describe, it, expect, vi, afterEach } from 'vitest';

// ba.js and mailer.js read env at call/import time, so every case stubs env
// before importing. The auth instance builds at module scope, but pg Pool
// creation is lazy — no connection is opened until BA serves a request, and
// these tests never do.
const BASE_ENV = {
  NODE_ENV: 'test',
  BETTER_AUTH_URL: 'http://localhost:4000',
  BETTER_AUTH_SECRET: 'test-only-secret-0123456789abcdef0123456789',
  DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/joblinked_test',
  CORS_ORIGIN: 'https://jobs.example.com',
  TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
  SMTP_FROM: 'no-reply@joblinked.test',
};

const applyEnv = (env = {}) => {
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...env })) {
    vi.stubEnv(key, value);
  }
};

const loadAuth = async (env = {}) => {
  vi.resetModules();
  applyEnv(env);
  vi.stubEnv('SMTP_HOST', undefined); // dev fallback path unless a case sets it
  // logger reads LOG_LEVEL at import time; pin it so assertions see the lines.
  vi.stubEnv('LOG_LEVEL', 'info');
  return (await import('./ba.js')).auth;
};

const loadMailer = async (env = {}) => {
  vi.resetModules();
  applyEnv(env);
  // logger reads LOG_LEVEL at import time; pin it so assertions see the lines.
  vi.stubEnv('LOG_LEVEL', 'info');
  return import('./mailer.js');
};

// A real bcrypt cost-10 hash in the Supabase-era $2a$ format for "Abcdefg1!".
// bcrypt treats $2a$ and $2b$ identically, so imported Supabase hashes verify
// against the same compare() path.
const REAL_2A_HASH = '$2a$10$wFdXev9oQRZx0AfXPeB0UuCtGQTRvzCWrjTA/nWNOrDPh7XFroJOi';
const STRONG_PASSWORD = 'Abcdefg1!';

// Captures the JSON lines the shared logger writes to a console method.
const jsonLines = (spy) => spy.mock.calls.map(([line]) => JSON.parse(line));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('better-auth instance', () => {
  it('builds from env without opening a database connection', async () => {
    const auth = await loadAuth();

    expect(typeof auth.api.getSession).toBe('function');
    expect(auth.options.emailAndPassword).toMatchObject({
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
    });
    expect(auth.options.advanced.database.generateId).toBe('uuid');
  });

  it('sends auth mail off the request path via the background task handler', async () => {
    const auth = await loadAuth();

    expect(typeof auth.options.advanced.backgroundTasks.handler).toBe('function');
  });

  it('gives the auth database its own `auth` schema', async () => {
    const auth = await loadAuth();

    expect(auth.options.database).toMatchObject({ type: 'postgres', schemaName: 'auth' });
  });

  it('trusts CORS_ORIGIN plus the dev web origins outside production', async () => {
    const auth = await loadAuth({ NODE_ENV: 'development' });

    // Wildcards cover every local port (Vite 5173-5175, preview 4173) instead of
    // a port list that drifts from app.js's dev CORS regex.
    expect(auth.options.trustedOrigins).toEqual(
      expect.arrayContaining(['https://jobs.example.com', 'http://localhost:*', 'http://127.0.0.1:*'])
    );
  });

  it('does not trust the dev web origins in production', async () => {
    const auth = await loadAuth({ NODE_ENV: 'production' });

    expect(auth.options.trustedOrigins).toEqual(['https://jobs.example.com']);
  });

  it('sends the existing-account email from the onExistingUserSignUp hook', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const auth = await loadAuth();
    const hook = auth.options.emailAndPassword.onExistingUserSignUp;

    expect(typeof hook).toBe('function');
    await hook({ user: { email: 'owner@example.com' } });

    const mail = jsonLines(info).find((line) => line.event === 'dev_mail');
    expect(mail).toMatchObject({ kind: 'existing_account', to: 'owner@example.com' });
    expect(mail.text).toContain('https://jobs.example.com/login');
    expect(mail.text).toContain('https://jobs.example.com/forgot-password');
  });
});

describe('conditional captcha plugin (ADR-056 decision 6)', () => {
  const pluginIds = (auth) => auth.options.plugins.map((plugin) => plugin.id);

  it('registers the turnstile captcha plugin when TURNSTILE_SECRET_KEY is set', async () => {
    const auth = await loadAuth();

    expect(pluginIds(auth)).toContain('captcha');
  });

  it('skips the captcha plugin and warns once in development when the secret is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const auth = await loadAuth({ NODE_ENV: 'development', TURNSTILE_SECRET_KEY: undefined });

    // No plugin means no MISSING_RESPONSE 400 on sign-in/up/reset in dev.
    expect(pluginIds(auth)).not.toContain('captcha');
    expect(jsonLines(warn)).toContainEqual(
      expect.objectContaining({ level: 'warn', msg: expect.stringMatching(/TURNSTILE_SECRET_KEY/) })
    );
  });

  it('stays silent about the missing secret in production (the cutover task enforces it)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const auth = await loadAuth({ NODE_ENV: 'production', TURNSTILE_SECRET_KEY: undefined });

    expect(pluginIds(auth)).not.toContain('captcha');
    expect(jsonLines(warn).filter((line) => /TURNSTILE_SECRET_KEY/.test(line.msg || ''))).toHaveLength(0);
  });
});

describe('bcrypt password carry-over', () => {
  it('verifies a real Supabase-era $2a$ bcrypt cost-10 hash', async () => {
    const auth = await loadAuth();
    const { verify } = auth.options.emailAndPassword.password;

    await expect(verify({ hash: REAL_2A_HASH, password: STRONG_PASSWORD })).resolves.toBe(true);
    await expect(verify({ hash: REAL_2A_HASH, password: 'WrongPass1!' })).resolves.toBe(false);
  });

  it('answers false instead of throwing for a malformed or truncated hash', async () => {
    const auth = await loadAuth();
    const { verify } = auth.options.emailAndPassword.password;

    await expect(verify({ hash: 'not-a-hash', password: STRONG_PASSWORD })).resolves.toBe(false);
    await expect(verify({ hash: REAL_2A_HASH.slice(0, 20), password: STRONG_PASSWORD })).resolves.toBe(false);
  });

  it('hashes new passwords with bcrypt cost 10', async () => {
    const auth = await loadAuth();
    const { hash, verify } = auth.options.emailAndPassword.password;

    const digest = await hash(STRONG_PASSWORD);

    expect(digest).toMatch(/^\$2[aby]\$10\$/);
    await expect(verify({ hash: digest, password: STRONG_PASSWORD })).resolves.toBe(true);
  });
});

describe('passwordPolicyError (server-side policy, same rules as the client)', () => {
  const COMPOSITION = 'Password must include at least one letter, one number, and one symbol.';

  it.each([
    ['empty', '', 'Password is required'],
    ['undefined', undefined, 'Password is required'],
    ['too short', 'pass1!', 'Password must be at least 8 characters'],
    ['too long', 'a'.repeat(73), 'Password must be at most 72 characters'],
    ['letters only', 'password', COMPOSITION],
    ['the reported bypass', 'aaaaaaaa', COMPOSITION],
    ['digits only', '12345678', COMPOSITION],
    ['symbols only', '!@#$%^&*', COMPOSITION],
    ['letters and digits, no symbol', 'password123', COMPOSITION],
    ['digits and symbol, no letter', '12345678!', COMPOSITION],
    ['letters and symbol, no digit', 'password!', COMPOSITION],
    ['whitespace does not count as a symbol', 'password 1', COMPOSITION],
    ['letter, number and symbol', 'Passw0rd!', ''],
    ['exactly 8 characters', 'abcdef1!', ''],
    ['exactly 72 characters', `${'a'.repeat(70)}1!`, ''],
    ['the acceptance fixture', STRONG_PASSWORD, ''],
  ])('%s', async (_label, value, expected) => {
    const { passwordPolicyError } = await import('./passwordPolicy.js');
    expect(passwordPolicyError(value)).toBe(expected);
  });
});

describe('mailer', () => {
  it('logs the action URL instead of sending when SMTP_HOST is unset in development', async () => {
    const { sendResetPassword } = await loadMailer({ NODE_ENV: 'development' });
    vi.stubEnv('SMTP_HOST', undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const url = 'http://localhost:5173/reset-password?token=tok_dev123';
    await sendResetPassword({ user: { email: 'user@example.com' }, url });

    expect(jsonLines(info)).toContainEqual(
      expect.objectContaining({ event: 'dev_mail', to: 'user@example.com', url })
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('logs an error without the URL when production has no SMTP configured', async () => {
    const { sendVerificationEmail } = await loadMailer({ NODE_ENV: 'production' });
    vi.stubEnv('SMTP_HOST', undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const url = 'https://api.joblinked.site/api/auth/verify-email?token=tok_prod123';
    await expect(
      sendVerificationEmail({ user: { email: 'user@example.com' }, url })
    ).resolves.toBe(false);

    expect(info).not.toHaveBeenCalled();
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain('tok_prod123');
    expect(logged).not.toContain(url);
    expect(jsonLines(error)).toContainEqual(
      expect.objectContaining({ event: 'mail_not_configured', to: 'user@example.com' })
    );
  });

  it('logs the existing-account email with branded html and both links in development', async () => {
    const { sendExistingAccountEmail } = await loadMailer({ NODE_ENV: 'development' });
    vi.stubEnv('SMTP_HOST', undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await sendExistingAccountEmail({ user: { email: 'existing@example.com' } });

    const mail = jsonLines(info).find((line) => line.event === 'dev_mail');
    expect(mail).toMatchObject({ kind: 'existing_account', to: 'existing@example.com' });
    expect(mail.text).toContain('https://jobs.example.com/login');
    expect(mail.text).toContain('https://jobs.example.com/forgot-password');
    expect(mail.text).toContain('ignore this email');

    // Branded layout: icon, navy header, blue CTA, note box, footer.
    expect(mail.html).toContain('<!doctype html>');
    expect(mail.html).toContain('max-width:600px');
    expect(mail.html).toContain('background-color:#f1f5f9');
    expect(mail.html).toContain('src="cid:joblinked-logo"');
    expect(mail.html).not.toContain('joblinked-icon');
    expect(mail.html).toContain('alt="JobLinked"');
    expect(mail.html).toContain('bgcolor="#2563eb"');
    expect(mail.html).toContain('background-color:#edf4ff');
    expect(mail.html).toContain('&copy; 2026 JobLinked');

    // CTA logs in; the secondary link resets the password.
    expect(mail.html).toContain('href="https://jobs.example.com/login"');
    expect(mail.html).toContain('>Log in</a>');
    expect(mail.html).toContain('href="https://jobs.example.com/forgot-password"');
    expect(mail.html).toContain('>Reset your password</a>');

    // No greeting, no expiry claim, no sign-off for this mail.
    expect(mail.html).not.toContain('Hi ');
    expect(mail.html).not.toContain('expires');
    expect(mail.html).not.toContain('The JobLinked team');
    expect(error).not.toHaveBeenCalled();
  });

  it('logs the verification email with greeting, escaped URL, expiry line, and branded html in development', async () => {
    const { sendVerificationEmail } = await loadMailer({ NODE_ENV: 'development' });
    vi.stubEnv('SMTP_HOST', undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const url = 'https://api.joblinked.site/api/auth/verify-email?token=tok_dev456&next=%2Fjobs';
    await sendVerificationEmail({ user: { email: 'nova@example.com', name: '  Nova  ' }, url });

    const mail = jsonLines(info).find((line) => line.event === 'dev_mail');
    expect(mail).toMatchObject({ kind: 'verify_email', to: 'nova@example.com', url });
    expect(mail.text).toContain('Hi Nova,');
    expect(mail.text).toContain('Welcome to JobLinked!');
    expect(mail.text).toContain(url);
    expect(mail.text).toContain('This link expires in 1 hour.');
    expect(mail.text).toContain('— The JobLinked team');

    expect(mail.html).toContain('src="cid:joblinked-logo"');
    expect(mail.html).toContain('Hi Nova,');
    expect(mail.html).toContain('bgcolor="#2563eb"');
    expect(mail.html).toContain('href="https://api.joblinked.site/api/auth/verify-email?token=tok_dev456&amp;next=%2Fjobs"');
    expect(mail.html).toContain('>Verify my email</a>');
    expect(mail.html).toContain('This link expires in 1 hour.');
    expect(mail.html).toContain("If you didn't create a JobLinked account");
    expect(mail.html).toContain('— The JobLinked team');
    expect(mail.html).toContain('&copy; 2026 JobLinked');
  });

  it('falls back to "there" and escapes the name in the reset email html', async () => {
    const { sendResetPassword } = await loadMailer({ NODE_ENV: 'development' });
    vi.stubEnv('SMTP_HOST', undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const url = 'http://localhost:5173/reset-password?token=tok_dev789';
    await sendResetPassword({ user: { email: 'anon@example.com' }, url });
    await sendResetPassword({ user: { email: 'esc@example.com', name: 'A <b>B</b>' }, url });

    const mails = jsonLines(info).filter((line) => line.event === 'dev_mail');
    const [anon, escaped] = mails;
    expect(anon.text).toContain('Hi there,');
    expect(anon.html).toContain('Hi there,');
    expect(escaped.text).toContain('Hi A <b>B</b>,');
    expect(escaped.html).toContain('Hi A &lt;b&gt;B&lt;/b&gt;,');
    expect(escaped.html).not.toContain('<b>B</b>');
    expect(escaped.html).toContain('src="cid:joblinked-logo"');
    expect(escaped.html).toContain(`href="${url}"`);
    expect(escaped.html).toContain('>Reset my password</a>');
    expect(escaped.html).toContain('This link expires in 1 hour.');
    expect(escaped.html).toContain('your password will stay the same');
  });

  it('passes branded html and an inline logo attachment to the transport for every auth mail', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    vi.doMock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));
    vi.spyOn(console, 'info').mockImplementation(() => {});

    try {
      const { sendResetPassword, sendVerificationEmail, sendExistingAccountEmail } = await loadMailer({
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.test',
      });

      const resetUrl = 'https://jobs.example.com/reset-password?token=tok_html1';
      const verifyUrl = 'https://jobs.example.com/verify-email?token=tok_html2';
      await sendResetPassword({ user: { email: 'reset@example.com' }, url: resetUrl });
      await sendVerificationEmail({ user: { email: 'verify@example.com' }, url: verifyUrl });
      await sendExistingAccountEmail({ user: { email: 'existing@example.com' } });

      expect(sendMail).toHaveBeenCalledTimes(3);
      for (const [mail] of sendMail.mock.calls) {
        expect(mail.html).toContain('src="cid:joblinked-logo"');
        expect(mail.html).not.toContain('joblinked-icon');
        expect(mail.attachments).toEqual([
          expect.objectContaining({
            filename: 'joblinked-icon.png',
            path: expect.stringMatching(/joblinked-icon\.png$/),
            cid: 'joblinked-logo',
            contentDisposition: 'inline',
          }),
        ]);
      }

      expect(sendMail.mock.calls[0][0]).toMatchObject({
        to: 'reset@example.com',
        html: expect.stringContaining(`href="${resetUrl}"`),
      });
      expect(sendMail.mock.calls[0][0].html).toContain('>Reset my password</a>');
      expect(sendMail.mock.calls[1][0].html).toContain('>Verify my email</a>');
      expect(sendMail.mock.calls[2][0].html).toContain('href="https://jobs.example.com/login"');
      expect(sendMail.mock.calls[2][0].html).toContain('>Log in</a>');
    } finally {
      vi.doUnmock('nodemailer');
    }
  });

  it('sends one existing-account email per address inside the 10-minute cooldown', async () => {
    const { sendExistingAccountEmail } = await loadMailer({ NODE_ENV: 'development' });
    vi.stubEnv('SMTP_HOST', undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    await sendExistingAccountEmail({ user: { email: 'Dupe@Example.com' } });
    await sendExistingAccountEmail({ user: { email: 'dupe@example.com' } });

    expect(
      jsonLines(info).filter((line) => line.event === 'dev_mail' && line.kind === 'existing_account')
    ).toHaveLength(1);
  });

  it('does not start the cooldown when the first send fails', async () => {
    const { sendExistingAccountEmail } = await loadMailer({ NODE_ENV: 'production' });
    vi.stubEnv('SMTP_HOST', undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    // No SMTP in production: the first attempt fails without sending.
    await sendExistingAccountEmail({ user: { email: 'retry@example.com' } });
    expect(jsonLines(error).filter((line) => line.event === 'mail_not_configured')).toHaveLength(1);

    // A failed attempt must not consume the cooldown, so the retry goes out.
    vi.stubEnv('NODE_ENV', 'development');
    await sendExistingAccountEmail({ user: { email: 'retry@example.com' } });

    expect(
      jsonLines(info).filter((line) => line.event === 'dev_mail' && line.kind === 'existing_account')
    ).toHaveLength(1);
  });

  it('logs SMTP rejection details without credentials on send failure', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.doMock('nodemailer', () => ({
      default: {
        createTransport: () => ({
          sendMail: vi.fn().mockRejectedValue({
            code: 'EENVELOPE',
            responseCode: 550,
            command: 'MAIL FROM',
            response: `550 5.1.2 domain refused ${'x'.repeat(300)}`,
          }),
        }),
      },
    }));

    try {
      const { sendExistingAccountEmail } = await loadMailer({
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.test',
        SMTP_USER: 'smtp-user',
        SMTP_PASS: 'smtp-secret',
      });

      await sendExistingAccountEmail({ user: { email: 'existing@example.com' } });

      const failed = jsonLines(error).find((line) => line.event === 'mail_failed');
      expect(failed).toMatchObject({
        to: 'existing@example.com',
        kind: 'existing_account',
        code: 'EENVELOPE',
        responseCode: 550,
        command: 'MAIL FROM',
      });
      expect(failed.response).toHaveLength(200);
      expect(JSON.stringify(failed)).not.toContain('smtp-secret');
      expect(info).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('nodemailer');
    }
  });
});
