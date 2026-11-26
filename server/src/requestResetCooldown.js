// Per-email 60s window for password-reset requests. Keyed by the submitted
// address, so it never needs an account lookup and cannot leak whether the
// address exists.
// ponytail: per-process map; Redis/DB if the API runs multi-instance.
export const RESET_COOLDOWN_MS = 60_000;

const requestedAt = new Map();

const keyFor = (email) => String(email ?? '').trim().toLowerCase();

// Sweep only once the map is big enough to be worth it, mirroring mailer.js.
const sweep = (now) => {
  if (requestedAt.size <= 5000) return;
  for (const [address, at] of requestedAt) {
    if (now - at >= RESET_COOLDOWN_MS) requestedAt.delete(address);
  }
};

// Pure check: a request that is later rejected must not consume the window.
export const canRequestReset = (email, now = Date.now()) => {
  const key = keyFor(email);
  // BA validates the address; an empty one must reach its 400, not a false 429.
  if (!key) return { allowed: true, retryAfterSeconds: 0 };

  const last = requestedAt.get(key);
  if (last !== undefined && now - last < RESET_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((RESET_COOLDOWN_MS - (now - last)) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
};

// Only the accepted request (the `after` hook) starts the window.
export const recordResetRequest = (email, now = Date.now()) => {
  const key = keyFor(email);
  if (!key) return;
  sweep(now);
  requestedAt.set(key, now);
};

// Test hook: a module-level map would otherwise leak windows between cases.
export const resetRequestCooldown = () => requestedAt.clear();
