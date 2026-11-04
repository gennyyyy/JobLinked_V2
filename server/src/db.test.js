import { describe, it, expect, afterAll, vi } from 'vitest';
import logger from './logger.js';
import { pool } from './db.js';

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
