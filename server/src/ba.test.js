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
    ).resolves.toBeUndefined();

    expect(info).not.toHaveBeenCalled();
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain('tok_prod123');
    expect(logged).not.toContain(url);
    expect(jsonLines(error)).toContainEqual(
      expect.objectContaining({ event: 'mail_not_configured', to: 'user@example.com' })
    );
  });
});
