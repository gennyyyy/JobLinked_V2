import { describe, it, expect, afterAll, vi } from 'vitest';
import logger from './logger.js';
import { pool, unverifiedRemoteDatabase } from './db.js';

// Regression: when Postgres drops an idle pooled connection (server restart,
// machine sleep/resume, idle reap, network blip) pg-pool emits 'error'. With no
// listener that is an uncaught exception -- the API process died outright, and
// `node --watch` does not respawn a crashed child, so the dev server stayed
// dead until it was restarted by hand.
describe('db pool resilience', () => {
  afterAll(async () => { await pool.end(); });

  it('logs an idle client error instead of throwing the process away', () => {
    const log = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const dropped = Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01' });

    expect(pool.listenerCount('error')).toBeGreaterThan(0);
    expect(() => pool.emit('error', dropped)).not.toThrow();
    expect(log).toHaveBeenCalledWith('db_pool_error', { code: '57P01', message: dropped.message });

    log.mockRestore();
  });
});

// F-10: the "remote database requires TLS" assumption must be executable, not
// a comment. Loopback is the production topology (ADR-044) and stays allowed.
describe('db boot guard — remote DATABASE_URL needs verified TLS', () => {
  it('refuses a remote host without sslmode=verify-full', () => {
    expect(unverifiedRemoteDatabase('postgres://u:p@db.example.com:5432/joblinked')).toBe(true);
    expect(unverifiedRemoteDatabase('postgres://u:p@db.example.com/joblinked?sslmode=require')).toBe(true);
    expect(unverifiedRemoteDatabase('postgres://u:p@db.example.com/joblinked?sslmode=disable')).toBe(true);
  });

  it('allows loopback and Unix sockets', () => {
    expect(unverifiedRemoteDatabase('postgres://u:p@127.0.0.1:5432/joblinked?sslmode=disable')).toBe(false);
    expect(unverifiedRemoteDatabase('postgres://u:p@localhost:5432/joblinked')).toBe(false);
    expect(unverifiedRemoteDatabase('postgres://u:p@[::1]:5432/joblinked')).toBe(false);
    expect(unverifiedRemoteDatabase('postgres:///joblinked')).toBe(false);
    expect(unverifiedRemoteDatabase('postgres:///joblinked?host=/var/run/postgresql')).toBe(false);
  });

  it('allows a remote host that asks for verify-full', () => {
    expect(unverifiedRemoteDatabase('postgres://u:p@db.example.com:5432/joblinked?sslmode=verify-full')).toBe(false);
  });

  it('exits 1 at import time, without echoing the URL', async () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://app:hunter2@db.example.com/joblinked';
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('EXIT'); });
    const log = vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.resetModules();
    try {
      await expect(import('./db.js')).rejects.toThrow('EXIT');
      expect(exit).toHaveBeenCalledWith(1);
      expect(JSON.stringify(log.mock.calls)).not.toContain('hunter2');
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prev;
      exit.mockRestore();
      log.mockRestore();
      vi.resetModules();
    }
  });
});
