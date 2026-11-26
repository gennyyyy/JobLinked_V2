import { beforeEach, describe, expect, it } from 'vitest';
import {
  RESET_COOLDOWN_MS,
  canRequestReset,
  recordResetRequest,
  resetRequestCooldown,
} from './requestResetCooldown.js';

beforeEach(() => {
  resetRequestCooldown();
});

describe('canRequestReset', () => {
  it('allows a request without recording it', () => {
    const start = 1_000_000;

    expect(canRequestReset('jane@example.com', start)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    // A check alone must leave no window behind.
    expect(canRequestReset('jane@example.com', start + 1_000)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('blocks inside the window after a recorded request and does not extend it', () => {
    const start = 1_000_000;
    recordResetRequest('jane@example.com', start);

    expect(canRequestReset('jane@example.com', start + 1_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 59,
    });
    // Repeated checks must not push the deadline out.
    expect(canRequestReset('jane@example.com', start + 30_000).allowed).toBe(false);
    expect(canRequestReset('jane@example.com', start + RESET_COOLDOWN_MS)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('keys addresses case-insensitively and ignores surrounding spaces', () => {
    const start = 1_000_000;
    recordResetRequest('Jane@Example.com', start);

    expect(canRequestReset('  jane@example.COM ', start + 1_000).allowed).toBe(false);
  });

  it('keeps different addresses independent', () => {
    const start = 1_000_000;
    recordResetRequest('jane@example.com', start);

    expect(canRequestReset('john@example.com', start + 1_000).allowed).toBe(true);
  });

  it('lets an empty email through so Better Auth can reject it', () => {
    expect(canRequestReset('', 1_000_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(canRequestReset(undefined, 1_000_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});

describe('recordResetRequest', () => {
  it('starts the window for the normalized address', () => {
    const start = 1_000_000;
    recordResetRequest(' Jane@Example.com ', start);

    expect(canRequestReset('jane@example.com', start + 1).allowed).toBe(false);
    expect(canRequestReset('jane@example.com', start + RESET_COOLDOWN_MS).allowed).toBe(true);
  });

  it('ignores an empty email', () => {
    recordResetRequest('', 1_000_000);
    recordResetRequest(undefined, 1_000_000);

    expect(canRequestReset('jane@example.com', 1_000_000).allowed).toBe(true);
  });
});
