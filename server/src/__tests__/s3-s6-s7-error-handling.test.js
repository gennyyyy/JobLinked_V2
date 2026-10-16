import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';

const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const { withTransaction } = await import('../util.js');

// Hoisted at top level (its actual execution order) for the lazy-client spy.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn(() => ({ auth: { getUser: vi.fn(async () => ({ data: null, error: { message: 'no' } })) } })) }));

// S3 — upload.js must answer through the shared err() envelope like the rest
// of the server, not hand-roll { error: { code, message } }.
describe('S3 — upload.js uses the err() contract', () => {
  const uploadSrc = srv('src/upload.js');

  it('imports err from util.js', () => {
    expect(uploadSrc).toContain("import { err } from './util.js'");
  });

  it('has no hand-rolled error envelope left', () => {
    expect(uploadSrc).not.toMatch(/res\.status\(4\d\d\)\.json\(\{ error/);
    expect(uploadSrc.match(/err\(res, 400, 'BAD_REQUEST'/g) ?? []).toHaveLength(3);
  });
});

// S6 — withTransaction: the rollback guard must never mask the original error,
// and the client is always released.
describe('S6 — withTransaction', () => {
  const fakeClient = (behavior = {}) => {
    const calls = [];
    return {
      calls,
      release: vi.fn(),
      query: vi.fn(async (sql) => {
        calls.push(sql);
        if (behavior.rollbackThrows && sql === 'rollback') throw new Error('connection terminated');
        return { rows: [] };
      }),
    };
  };

  it('begins, returns the callback result, commits, and releases', async () => {
    const client = fakeClient();
    const result = await withTransactionMapper(client, async (c) => {
      await c.query('insert into t values (1)');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(client.calls).toEqual(['begin', 'insert into t values (1)', 'commit']);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rethrows the ORIGINAL error when the callback fails and rolls back', async () => {
    const client = fakeClient();
    const boom = new Error('real db failure');
    await expect(withTransactionMapper(client, async () => { throw boom; })).rejects.toBe(boom);
    expect(client.calls).toEqual(['begin', 'rollback']);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('a FAILING rollback must not mask the original error', async () => {
    const client = fakeClient({ rollbackThrows: true });
    const boom = new Error('real db failure');
    await expect(withTransactionMapper(client, async () => { throw boom; })).rejects.toBe(boom);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  // The helper reads pool.connect() from db.js; swap the pool for the fake.
  async function withTransactionMapper(client, fn) {
    const db = await import('../db.js');
    const original = db.pool.connect;
    db.pool.connect = async () => client;
    try {
      return await withTransaction(fn);
    } finally {
      db.pool.connect = original;
    }
  }
});

// S7 — the Supabase client must be built lazily: importing auth.js without
// SUPABASE_URL must not throw, and createClient runs on first use only.
describe('S7 — lazy Supabase client', () => {
  it('does not build the client at import time; builds once on first use', async () => {
    vi.doMock('@supabase/supabase-js', () => ({ createClient }));
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();

    // Import must not throw even with no SUPABASE_URL configured.
    const mod = await import('../auth.js');
    expect(createClient).not.toHaveBeenCalled();

    // First use builds and caches; the second use reuses.
    const a = mod.supa();
    const b = mod.supa();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);

    // The middlewares drive the same lazy getter.
    const res = { status: (s) => ({ json: () => s }) };
    await mod.auth({ headers: {} }, res, () => {});
    expect(createClient).toHaveBeenCalledTimes(1);
    vi.doUnmock('@supabase/supabase-js');
  });
});
