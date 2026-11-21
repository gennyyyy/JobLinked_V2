import { describe, it, expect, vi } from 'vitest';
import { mapUser, runMigration } from '../../scripts/migrate-supabase-auth.mjs';

// Real bcrypt cost-10 $2a$ hashes in the Supabase-era format. The migration
// copies the bytes verbatim; nothing here re-hashes.
const HASH_ADMIN = '$2a$10$wFdXev9oQRZx0AfXPeB0UuCtGQTRvzCWrjTA/nWNOrDPh7XFroJOi'; // Abcdefg1!
const HASH_SEEKER = '$2a$10$TfoHD0UB36Xxq0z09de6n.Td9KgMxxWSpu6HUWXNVU8fhMd8/gd3C'; // SeekerPass1!
const HASH_CHANGED = '$2a$10$6QhGI79YbopTLuKoBA5SquNHgnbuhv3xNwbfm0tINLTj4SDIYFki6'; // ChangedPass1!

// Supabase admin API user shape (the fields this migration reads).
const SUPABASE_USERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@joblinked.test',
    email_confirmed_at: '2025-01-02T03:04:05Z',
    created_at: '2024-12-01T00:00:00Z',
    user_metadata: { first_name: 'Ana', last_name: 'Cruz' },
    app_metadata: { role: 'super-admin' },
    encrypted_password: HASH_ADMIN,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'seeker@joblinked.test',
    email_confirmed_at: null,
    created_at: '2025-02-03T00:00:00Z',
    user_metadata: { full_name: 'Jose Reyes' },
    app_metadata: {},
    encrypted_password: HASH_SEEKER,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'nopass@joblinked.test',
    email_confirmed_at: null,
    created_at: '2025-03-04T00:00:00Z',
    user_metadata: {},
    app_metadata: {},
    encrypted_password: null,
  },
];

const emails = SUPABASE_USERS.map((u) => u.email);
const hashes = [HASH_ADMIN, HASH_SEEKER, HASH_CHANGED];

// Page/perPage fake of supabase.auth.admin.listUsers.
function fakeSupabase(users = SUPABASE_USERS) {
  const listUsers = vi.fn(async ({ page, perPage }) => {
    const start = (page - 1) * perPage;
    return { data: { users: users.slice(start, start + perPage) }, error: null };
  });
  return { auth: { admin: { listUsers } } };
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

describe('mapUser', () => {
  it('maps a verified super-admin with first+last name, keeping hash bytes', () => {
    const mapped = mapUser(SUPABASE_USERS[0]);

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

  it('prefers user_metadata.full_name', () => {
    expect(mapUser(SUPABASE_USERS[1]).user).toMatchObject({
      name: 'Jose Reyes',
      emailVerified: false,
      role: null,
    });
  });

  it('falls back to the email for the name and null for the password when absent', () => {
    const mapped = mapUser(SUPABASE_USERS[2]);

    expect(mapped.user.name).toBe('nopass@joblinked.test');
    expect(mapped.password).toBeNull();
  });
});

describe('runMigration', () => {
  it('dry run by default: reports counts and issues no writes', async () => {
    const supabase = fakeSupabase();
    const db = fakeDb();
    const { lines, log } = captureLog();

    const summary = await runMigration({ supabase, db, flags: {}, log });

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
    expect(db.query).not.toHaveBeenCalled();
    expect(db.users.size).toBe(0);
    expect(db.accounts.size).toBe(0);
  });

  it('pages through the admin API with page/perPage', async () => {
    const supabase = fakeSupabase();
    const db = fakeDb();

    const summary = await runMigration({ supabase, db, flags: { batch: 2 }, log: () => {} });

    expect(supabase.auth.admin.listUsers.mock.calls).toEqual([
      [{ page: 1, perPage: 2 }],
      [{ page: 2, perPage: 2 }],
    ]);
    expect(summary.total).toBe(3);
  });

  it('--apply writes users, copies the role, and stores each bcrypt hash verbatim', async () => {
    const supabase = fakeSupabase();
    const db = fakeDb();
    const { log } = captureLog();

    const summary = await runMigration({ supabase, db, flags: { apply: true }, log });

    expect(summary).toMatchObject({ total: 3, usersWritten: 3, accountsWritten: 2 });

    const admin = db.users.get(SUPABASE_USERS[0].id);
    expect(admin).toMatchObject({
      name: 'Ana Cruz',
      email: 'admin@joblinked.test',
      emailVerified: true,
      role: 'super-admin',
      banned: false,
      twoFactorEnabled: false,
    });

    // One credential account per hashed user, none for the hashless one.
    expect([...db.accounts.keys()].sort()).toEqual([SUPABASE_USERS[0].id, SUPABASE_USERS[1].id]);
    expect(db.accounts.get(SUPABASE_USERS[0].id)).toBe(HASH_ADMIN);
    expect(db.accounts.get(SUPABASE_USERS[1].id)).toBe(HASH_SEEKER);
    expect(db.accounts.has(SUPABASE_USERS[2].id)).toBe(false);
  });

  it('guards the account insert and role with the required SQL shapes', async () => {
    const supabase = fakeSupabase();
    const db = fakeDb();

    await runMigration({ supabase, db, flags: { apply: true }, log: () => {} });

    const [userSql] = db.query.mock.calls.find(([text]) => text.includes('insert into auth."user"'));
    const [accountSql] = db.query.mock.calls.find(([text]) => text.includes('insert into auth."account"'));
    expect(userSql).toContain('on conflict ("id") do update');
    expect(userSql).toContain('coalesce(auth."user"."role", excluded."role")');
    expect(accountSql).toContain('where not exists');
    expect(accountSql).toContain('"providerId" = \'credential\'');
  });

  it('a second --apply never overwrites a password changed after the first run', async () => {
    const supabase = fakeSupabase();
    const db = fakeDb();

    await runMigration({ supabase, db, flags: { apply: true }, log: () => {} });
    // Simulate the user changing their password in Better Auth between runs.
    db.accounts.set(SUPABASE_USERS[0].id, HASH_CHANGED);

    const summary = await runMigration({ supabase, db, flags: { apply: true }, log: () => {} });

    expect(summary.accountsWritten).toBe(0);
    expect(db.accounts.get(SUPABASE_USERS[0].id)).toBe(HASH_CHANGED);
    expect(db.users.size).toBe(3);
  });

  it('--resume skips users through the given id', async () => {
    const supabase = fakeSupabase();
    const db = fakeDb();

    const summary = await runMigration({
      supabase, db, flags: { apply: true, resume: SUPABASE_USERS[1].id }, log: () => {},
    });

    expect(summary.total).toBe(1);
    expect(db.users.has(SUPABASE_USERS[0].id)).toBe(false);
    expect(db.users.has(SUPABASE_USERS[1].id)).toBe(false);
    expect(db.users.has(SUPABASE_USERS[2].id)).toBe(true);
  });

  it('never logs an email address or a password hash', async () => {
    const supabase = fakeSupabase();
    const db = fakeDb();
    const { lines, log } = captureLog();

    await runMigration({ supabase, db, flags: { apply: true }, log });

    const output = JSON.stringify(lines);
    for (const email of emails) expect(output).not.toContain(email);
    for (const hash of hashes) expect(output).not.toContain(hash);
  });

  it('fails loudly on a source error without leaking user data', async () => {
    const supabase = {
      auth: { admin: { listUsers: vi.fn(async () => ({ data: null, error: { message: 'permission denied' } })) } },
    };

    await expect(runMigration({ supabase, db: fakeDb(), flags: {}, log: () => {} }))
      .rejects.toThrow('listUsers page 1: permission denied');
  });
});
