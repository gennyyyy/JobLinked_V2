import { describe, it, expect } from 'vitest';
import { pool } from '../db.js';

// Fix 1 — pool must survive connection errors. The real pg.Pool (not the
// test helper mock) is imported here so we can assert it has an 'error'
// listener AND that emitting 'error' on it does not throw (an EventEmitter
// with no 'error' listener throws by default, crashing the process).
describe('pool resilience', () => {
  it('has at least one error listener', () => {
    expect(pool.listenerCount('error')).toBeGreaterThanOrEqual(1);
  });

  it('does not throw when an error is emitted', () => {
    expect(() => pool.emit('error', new Error('boom'))).not.toThrow();
  });
});
