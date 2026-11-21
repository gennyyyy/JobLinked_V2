import { describe, it, expect, vi } from 'vitest';
import { envError, mapUser, runMigration, sourceClientConfig } from '../../scripts/migrate-supabase-auth.mjs';

// Real bcrypt cost-10 $2a$ hashes in the Supabase-era format. The migration
// copies the bytes verbatim; nothing here re-hashes.
const HASH_ADMIN = '$2a$10$wFdXev9oQRZx0AfXPeB0UuCtGQTRvzCWrjTA/nWNOrDPh7XFroJOi'; // Abcdefg1!
const HASH_SEEKER = '$2a$10$TfoHD0UB36Xxq0z09de6n.Td9KgMxxWSpu6HUWXNVU8fhMd8/gd3C'; // SeekerPass1!
const HASH_CHANGED = '$2a$10$6QhGI79YbopTLuKoBA5SquNHgnbuhv3xNwbfm0tINLTj4SDIYFki6'; // ChangedPass1!

// Rows as node-postgres returns them from auth.users (jsonb parsed to objects).
const SOURCE_ROWS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@joblinked.test',
    encrypted_password: HASH_ADMIN,
    email_confirmed_at: '2025-01-02T03:04:05Z',
    created_at: '2024-12-01T00:00:00Z',
    raw_user_meta_data: { first_name: 'Ana', last_name: 'Cruz' },
    raw_app_meta_data: { role: 'super-admin' },
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'seeker@joblinked.test',
    encrypted_password: HASH_SEEKER,
    email_confirmed_at: null,
    created_at: '2025-02-03T00:00:00Z',
    raw_user_meta_data: { full_name: 'Jose Reyes' },
    raw_app_meta_data: {},
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'nopass@joblinked.test',
    encrypted_password: null,
    email_confirmed_at: null,
    created_at: '2025-03-04T00:00:00Z',
    raw_user_meta_data: {},
    raw_app_meta_data: {},
  },
];

const emails = SOURCE_ROWS.map((row) => row.email);
const hashes = [HASH_ADMIN, HASH_SEEKER, HASH_CHANGED];

// Keyset-paginated fake of the read-only Supabase query:
// `where ($1 is null or id > $1) order by id limit $2`.
function fakeSource(rows = SOURCE_ROWS) {
  const query = vi.fn(async (_text, [cursor, limit]) => ({
    rows: rows
      .filter((row) => cursor === null || row.id > cursor)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .slice(0, limit),
  }));
  return { query };
}

// In-memory stand-in for auth."user" / auth."account" that honours the two
// guards the real SQL carries: role coalesce, credential-account not-exists.
function fakeDb() {
  const users = new Map();
  const accounts = new Map(); // userId -> password
  const query = vi.fn(async (text, values) => {
    if (text.includes('insert into auth."user"')) {
      const [id, name, email, emailVerified, image, createdAt, updatedAt, role, banned, twoFactorEnabled] = values;
      const existing = users.get(id);
      users.set(id, {
        id, name, email, emailVerified, image, createdAt, updatedAt,
        role: existing?.role ?? role, banned, twoFactorEnabled,
      });
      return { rowCount: 1 };
    }
    if (text.includes('insert into auth."account"')) {
      const [id, password] = values;
      if (accounts.has(id)) return { rowCount: 0 };
      accounts.set(id, password);
      return { rowCount: 1 };
    }
    throw new Error(`unexpected query: ${text}`);
  });
  return { users, accounts, query };
}

function captureLog() {
  const lines = [];
  const log = (line) => lines.push(line);
  return { lines, log };
}

describe('sourceClientConfig', () => {
  it('opens the Supabase database with a read-only default transaction', () => {
    expect(sourceClientConfig('postgres://supabase.example/db')).toEqual({
      connectionString: 'postgres://supabase.example/db',
      options: '-c default_transaction_read_only=on',
    });
  });
});

describe('envError (fail closed before any connection)', () => {
  it('names every missing variable and nothing else', () => {
    expect(envError({})).toBe('missing env: SUPABASE_DATABASE_URL, DATABASE_URL');
    expect(envError({ DATABASE_URL: 'postgres://target/db' })).toBe('missing env: SUPABASE_DATABASE_URL');
    expect(envError({ SUPABASE_DATABASE_URL: 'postgres://source/db' })).toBe('missing env: DATABASE_URL');
    expect(envError({ SUPABASE_DATABASE_URL: 'postgres://source/db', DATABASE_URL: 'postgres://target/db' })).toBeNull();
  });
});

describe('mapUser', () => {
  it('maps a verified super-admin with first+last name, keeping hash bytes', () => {
    const mapped = mapUser(SOURCE_ROWS[0]);

    expect(mapped.user).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Ana Cruz',
      email: 'admin@joblinked.test',
      emailVerified: true,
      image: null,
      createdAt: '2024-12-01T00:00:00Z',
      role: 'super-admin',
      banned: false,
      twoFactorEnabled: false,
    });
    expect(mapped.user.updatedAt).toBeInstanceOf(Date);
    expect(mapped.password).toBe(HASH_ADMIN);
  });

  it('prefers raw_user_meta_data.full_name', () => {
    expect(mapUser(SOURCE_ROWS[1]).user).toMatchObject({
      name: 'Jose Reyes',
      emailVerified: false,
      role: null,
    });
  });

  it('falls back to the email for the name and null for the password when absent', () => {
    const mapped = mapUser(SOURCE_ROWS[2]);

    expect(mapped.user.name).toBe('nopass@joblinked.test');
    expect(mapped.password).toBeNull();
  });
});

describe('runMigration', () => {
  it('dry run by default: reports counts and issues no writes', async () => {
    const source = fakeSource();
    const db = fakeDb();
    const { lines, log } = captureLog();

    const summary = await runMigration({ source, db, flags: {}, log });

    expect(summary).toEqual({
      event: 'migrate_supabase_auth',
      total: 3,
      verified: 1,
      withPassword: 2,
      usersWritten: 0,
      accountsWritten: 0,
      skipped: 0,
    });
    expect(lines).toEqual([summary]);
    expect(source.query).toHaveBeenCalledTimes(1);
    expect(source.query.mock.calls[0][1]).toEqual([null, 500]);
    expect(db.query).not.toHaveBeenCalled();
    expect(db.users.size).toBe(0);
    expect(db.accounts.size).toBe(0);
  });

  it('pages with the last id as the keyset cursor', async () => {
    const source = fakeSource();
    const db = fakeDb();

    const summary = await runMigration({ source, db, flags: { batch: 2 }, log: () => {} });

    expect(source.query.mock.calls.map(([, values]) => values)).toEqual([
      [null, 2],
      [SOURCE_ROWS[1].id, 2],
    ]);
    expect(summary.total).toBe(3);
  });

  it('skips rows without an email and counts them', async () => {
    const source = fakeSource([{ ...SOURCE_ROWS[0], email: null }]);
    const db = fakeDb();

    const summary = await runMigration({ source, db, flags: { apply: true }, log: () => {} });

    expect(summary).toMatchObject({ total: 0, skipped: 1, usersWritten: 0, accountsWritten: 0 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('--apply writes users, copies the role, and stores each bcrypt hash verbatim', async () => {
    const source = fakeSource();
    const db = fakeDb();
    const { log } = captureLog();

    const summary = await runMigration({ source, db, flags: { apply: true }, log });

    expect(summary).toMatchObject({ total: 3, usersWritten: 3, accountsWritten: 2 });

    const admin = db.users.get(SOURCE_ROWS[0].id);
    expect(admin).toMatchObject({
      name: 'Ana Cruz',
      email: 'admin@joblinked.test',
      emailVerified: true,
      role: 'super-admin',
      banned: false,
      twoFactorEnabled: false,
    });

    // One credential account per hashed user, none for the hashless one.
    expect([...db.accounts.keys()].sort()).toEqual([SOURCE_ROWS[0].id, SOURCE_ROWS[1].id]);
    expect(db.accounts.get(SOURCE_ROWS[0].id)).toBe(HASH_ADMIN);
    expect(db.accounts.get(SOURCE_ROWS[1].id)).toBe(HASH_SEEKER);
    expect(db.accounts.has(SOURCE_ROWS[2].id)).toBe(false);
  });

  it('guards the account insert and role with the required SQL shapes', async () => {
    const source = fakeSource();
    const db = fakeDb();

    await runMigration({ source, db, flags: { apply: true }, log: () => {} });

    const [userSql] = db.query.mock.calls.find(([text]) => text.includes('insert into auth."user"'));
    const [accountSql] = db.query.mock.calls.find(([text]) => text.includes('insert into auth."account"'));
    expect(userSql).toContain('on conflict ("id") do update');
    expect(userSql).toContain('coalesce(auth."user"."role", excluded."role")');
    expect(accountSql).toContain('where not exists');
    expect(accountSql).toContain('"providerId" = \'credential\'');
  });

  it('a second --apply never overwrites a password changed after the first run', async () => {
    const source = fakeSource();
    const db = fakeDb();

    await runMigration({ source, db, flags: { apply: true }, log: () => {} });
    // Simulate the user changing their password in Better Auth between runs.
    db.accounts.set(SOURCE_ROWS[0].id, HASH_CHANGED);

    const summary = await runMigration({ source, db, flags: { apply: true }, log: () => {} });

    expect(summary.accountsWritten).toBe(0);
    expect(db.accounts.get(SOURCE_ROWS[0].id)).toBe(HASH_CHANGED);
    expect(db.users.size).toBe(3);
  });

  it('--resume starts the keyset after the given id', async () => {
    const source = fakeSource();
    const db = fakeDb();

    const summary = await runMigration({
      source, db, flags: { apply: true, resume: SOURCE_ROWS[1].id }, log: () => {},
    });

    expect(source.query.mock.calls[0][1]).toEqual([SOURCE_ROWS[1].id, 500]);
    expect(summary.total).toBe(1);
    expect(db.users.has(SOURCE_ROWS[0].id)).toBe(false);
    expect(db.users.has(SOURCE_ROWS[1].id)).toBe(false);
    expect(db.users.has(SOURCE_ROWS[2].id)).toBe(true);
  });

  it('never logs an email address or a password hash', async () => {
    const source = fakeSource();
    const db = fakeDb();
    const { lines, log } = captureLog();

    await runMigration({ source, db, flags: { apply: true }, log });

    const output = JSON.stringify(lines);
    for (const email of emails) expect(output).not.toContain(email);
    for (const hash of hashes) expect(output).not.toContain(hash);
  });

  it('propagates a source failure instead of writing a partial summary', async () => {
    const source = { query: vi.fn(async () => { throw new Error('read-only transaction'); }) };
    const db = fakeDb();

    await expect(runMigration({ source, db, flags: {}, log: () => {} }))
      .rejects.toThrow('read-only transaction');
    expect(db.query).not.toHaveBeenCalled();
  });
});
