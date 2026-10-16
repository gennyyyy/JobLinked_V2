import { describe, it, expect, beforeEach, vi } from 'vitest';

// Drive the mocked pool through the shared harness so resolveRole/findUserTable
// run against a faithful mini-Postgres: seedRoleTable registers which rows a
// user has in each role table, and the harness answers the union query the way
// the ORDER BY in the real SQL reads (see helpers/db.js). The precedence below
// (an active row beats an inactive higher-precedence row) is EXECUTED and its
// result asserted — not sniffed out of the SQL text. Flattening the precedence
// to `asc`, or dropping the status term, now changes the winner and fails these.

vi.mock('./db.js', async () => {
  const h = await import('./__tests__/helpers/db.js');
  return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect };
});

// auth.js builds a Supabase client at import time; stub env so the import can't throw.
process.env.SUPABASE_URL ||= 'http://127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
// admin.js starts a 24h retention timer at import; skip it in tests.
process.env.RETENTION_DISABLE ||= '1';

const { seedRoleTable, reset, callsOf, query } = await import('./__tests__/helpers/db.js');
const { resolveRole } = await import('./auth.js');
const { findUserTable } = await import('./routes/admin.js');

// A provisioned account sits in a role table; a role move leaves the OLD table's
// row deactivated (status 'inactive') rather than deleting it, so one id can hold
// rows in two tables at once.
const SA = 'super_admins', EMP = 'employers', JS = 'job_seekers';

describe('resolveRole', () => {
  beforeEach(() => reset());

  it('runs exactly ONE query (the fan-out fix)', async () => {
    seedRoleTable('id-1', SA, { status: 'active' });
    await resolveRole('id-1');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns the role and profile unchanged for consumers', async () => {
    seedRoleTable('id-2', EMP, { status: 'active', company_name: 'Acme' });
    const found = await resolveRole('id-2');
    expect(found.role).toBe('employer');
    expect(found.profile.company_name).toBe('Acme');
  });

  it('reads a suspended account so auth can reject it', async () => {
    seedRoleTable('id-3', JS, { status: 'suspended' });
    expect((await resolveRole('id-3')).profile.status).toBe('suspended');
  });

  it('returns null when the id is in no role table', async () => {
    expect(await resolveRole('id-4')).toBeNull();
  });

  it('binds the id as a parameter (no interpolation)', async () => {
    seedRoleTable('id-5', EMP, { status: 'active' });
    await resolveRole('id-5');
    expect(callsOf(/select role, profile from/)[0].params).toEqual(['id-5']);
  });

  // F1 (HIGH, data loss): a role move deactivates the old table's row instead
  // of deleting it — the deactivated row must NEVER shadow the user's current
  // role. An active employer row has to beat an inactive super_admins row even
  // though super-admin ranks first on `ord`. This is the guard that precedence
  // exists for; asserting the RESULT (not the SQL) is what makes it bite.
  it('F1: an ACTIVE employer row outranks an INACTIVE super-admin row', async () => {
    seedRoleTable('id-6', SA, { status: 'inactive', full_name: 'Stale Admin' });
    seedRoleTable('id-6', EMP, { status: 'active', company_name: 'Acme' });
    const found = await resolveRole('id-6');
    expect(found.role).toBe('employer');
    expect(found.profile.company_name).toBe('Acme');
  });

  it('F1: the inverse — an ACTIVE super-admin outranks an INACTIVE employer', async () => {
    seedRoleTable('id-7', SA, { status: 'active', email: 'boss@x.com' });
    seedRoleTable('id-7', EMP, { status: 'inactive', company_name: 'Old Co' });
    const found = await resolveRole('id-7');
    expect(found.role).toBe('super-admin');
  });

  it('applies table precedence only among rows of the SAME status', async () => {
    // Two active rows: super-admin (ord 1) must still win the tie-break.
    seedRoleTable('id-8', EMP, { status: 'active', company_name: 'Acme' });
    seedRoleTable('id-8', JS, { status: 'active', full_name: 'Jane' });
    expect((await resolveRole('id-8')).role).toBe('employer'); // ord 2 < ord 3
    reset();
    seedRoleTable('id-9', JS, { status: 'active' });
    seedRoleTable('id-9', EMP, { status: 'active' });
    seedRoleTable('id-9', SA, { status: 'active' });
    expect((await resolveRole('id-9')).role).toBe('super-admin'); // ord 1 wins
  });

  // A single inactive row (the only provisioned account) must not be inverted
  // into an accidental "active" by a flipped comparator.
  it('a lone suspended/inactive row is still returned as-is', async () => {
    seedRoleTable('id-10', JS, { status: 'inactive', full_name: 'Gone' });
    const found = await resolveRole('id-10');
    expect(found.role).toBe('job-seeker');
    expect(found.profile.status).toBe('inactive');
  });
});

describe('findUserTable', () => {
  beforeEach(() => reset());

  // Real uuids: a malformed id now answers {} (404) before any query (S1).
  const U = (n) => `${n}aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;

  it('runs exactly ONE query (the fan-out fix)', async () => {
    seedRoleTable(U(1), EMP, { status: 'active' });
    await findUserTable(U(1));
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns the table and profile for a super-admin', async () => {
    seedRoleTable(U(2), SA, { status: 'active', email: 's@x.com' });
    const found = await findUserTable(U(2));
    expect(found.table).toBe('super_admins');
    expect(found.profile.role).toBe('super-admin');
  });

  it('returns the table and profile for an employer', async () => {
    seedRoleTable(U(3), EMP, { status: 'active', company_name: 'Acme' });
    const found = await findUserTable(U(3));
    expect(found.table).toBe('employers');
    expect(found.profile.company_name).toBe('Acme');
    expect(found.profile.role).toBe('employer');
  });

  it('returns the table and profile for a job-seeker', async () => {
    seedRoleTable(U(4), JS, { status: 'active', full_name: 'Jane' });
    const found = await findUserTable(U(4));
    expect(found.table).toBe('job_seekers');
    expect(found.profile.full_name).toBe('Jane');
    expect(found.profile.role).toBe('job-seeker');
  });

  it('returns {} when the id is in no role table', async () => {
    expect(await findUserTable(U(5))).toEqual({});
  });

  it('returns {} without querying when the id is not a uuid (S1)', async () => {
    expect(await findUserTable('not-a-uuid')).toEqual({});
    expect(query).not.toHaveBeenCalled();
  });

  it('binds the id as a parameter (no interpolation)', async () => {
    seedRoleTable(U(6), EMP, { status: 'active' });
    await findUserTable(U(6));
    expect(callsOf(/select tbl, profile from/)[0].params).toEqual([U(6)]);
  });

  // F1, same guard as resolveRole, on the admin-facing table resolver: after a
  // move the handler must read the user's CURRENT (active) row, never the
  // deactivated one the move left behind.
  it('F1: resolves the ACTIVE employer row over the INACTIVE super-admin row', async () => {
    seedRoleTable(U(7), SA, { status: 'inactive', full_name: 'Stale Admin' });
    seedRoleTable(U(7), EMP, { status: 'active', company_name: 'Acme' });
    const found = await findUserTable(U(7));
    expect(found.table).toBe('employers');
    expect(found.profile.role).toBe('employer');
    expect(found.profile.company_name).toBe('Acme');
  });

  it('F1: the inverse — resolves the ACTIVE super-admin row over the INACTIVE employer', async () => {
    seedRoleTable(U(8), SA, { status: 'active', email: 'boss@x.com' });
    seedRoleTable(U(8), EMP, { status: 'inactive', company_name: 'Old Co' });
    const found = await findUserTable(U(8));
    expect(found.table).toBe('super_admins');
    expect(found.profile.role).toBe('super-admin');
  });
});
