import { vi } from 'vitest';
import { resolveRoleResult } from './auth.js';

// Swap-in for server/src/db.js: a pg-shaped pool whose query/clientQuery route
// through per-test rules. Both pool.query and pool.connect().query are recorded
// so tests can assert what was written, on which connection, and in what order.
const rules = []; // test-registered
const calls = [];

// --- Role-union simulator --------------------------------------------------
// resolveRole (auth.js) and findUserTable (admin.js) each run ONE union query
// over the three role tables and return the top row. seedRoleTable() registers
// which rows a user has in which table; the builtin rules below then answer
// that query EXACTLY as Postgres would for the ORDER BY baked into the real
// SQL. The directions are read out of the SQL — never hardcoded active-first —
// so a source mutation (desc↔asc on the active term, flipped ord, dropped
// `distinct on`) changes the RESULT, and a test that asserts the returned row
// fails the moment the precedence inverts. Untouched suites (no seed) keep the
// old single-row answer, so every loginAs()-based integration test is unaffected.
const ROLE_TABLE_ORD = { super_admins: 1, employers: 2, job_seekers: 3 };
const ROLE_BY_TABLE = { super_admins: 'super-admin', employers: 'employer', job_seekers: 'job-seeker' };
const roleTableRows = new Map(); // user id -> [{ role, tbl, profile, ord }]

export function seedRoleTable(id, table, profile) {
  if (!roleTableRows.has(id)) roleTableRows.set(id, []);
  roleTableRows.get(id).push({ role: ROLE_BY_TABLE[table], tbl: table, profile, ord: ROLE_TABLE_ORD[table] });
}

// Comparator over role-union rows that sorts them the way the ORDER BY in `sql`
// reads: the boolean active-status term, then table precedence `ord`, each in
// the direction the SQL states (Postgres DESC puts the larger value first, so
// the active boolean runs ahead). Parsing the directions from the SQL is the
// whole trick — it is what makes a reversed ORDER BY reverse the comparator.
export function unionOrder(sql) {
  const text = String(sql);
  const statusDir = (/'active'\)\s*(desc|asc)?/i.exec(text)?.[1] || 'asc').toLowerCase();
  const ordDir = (/,\s*ord\b\s*(desc|asc)?/i.exec(text)?.[1] || 'asc').toLowerCase();
  const isActive = (r) => (r.profile?.status === 'active' ? 1 : 0);
  return (a, b) => {
    let d = isActive(a) - isActive(b);
    if (d) return statusDir === 'desc' ? -d : d;
    d = a.ord - b.ord;
    return ordDir === 'desc' ? -d : d;
  };
}

function makeQuery(via) {
  return vi.fn(async (sql, params = []) => {
    const text = String(sql);
    calls.push({ sql: text, params, via });
    for (const rule of rules) {
      const hit = rule.match instanceof RegExp
        ? rule.match.test(text)
        : typeof rule.match === 'function' ? rule.match(text, params) : text.includes(rule.match);
      if (hit) return await rule.impl(params, text);
    }
    // resolveRole (auth.js) / findUserTable (admin.js) read one union query.
    // A seeded registry is answered exactly as Postgres would for that ORDER BY
    // (see seedRoleTable / unionOrder above); otherwise keep the single-row
    // registry answer every loginAs()-based integration test already relies on.
    if (text.includes('select role, profile from')) {
      const seeded = roleTableRows.get(params[0]);
      const rows = seeded?.length
        ? seeded.slice().sort(unionOrder(text)).slice(0, 1).map((r) => ({ role: r.role, profile: r.profile }))
        : (resolveRoleResult(params[0]) ? [resolveRoleResult(params[0])] : []);
      return { rows, rowCount: rows.length };
    }
    if (text.includes('select tbl, profile from')) {
      const seeded = roleTableRows.get(params[0]);
      if (!seeded?.length) return { rows: [], rowCount: 0 };
      const winner = seeded.slice().sort(unionOrder(text))[0];
      return { rows: [{ tbl: winner.tbl, profile: winner.profile }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
}

export const query = makeQuery('pool');
export const clientQuery = makeQuery('tx');
export const connect = vi.fn(async () => ({ query: clientQuery, release: vi.fn() }));
export const pool = { query, connect };

// Register a canned reply for queries matching a substring or predicate.
export const on = (match, impl) => rules.push({ match, impl });

// The recorded statements, oldest first. `via` is 'pool' or 'tx' (transaction).
export const callsOf = (re) => calls.filter((c) => re.test(c.sql));

export function reset() {
  rules.length = 0;
  calls.length = 0;
  roleTableRows.clear();
  query.mockClear();
  clientQuery.mockClear();
  connect.mockClear();
}
