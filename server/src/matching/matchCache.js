import { createHash } from 'node:crypto';
import { normalize } from '../aiProvider.js';

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 300;

// ponytail: in-memory Map, single process. Move to a shared store if the API
// ever runs more than one instance.
const entries = new Map();

// Test-only: TTL and LRU cap are module state, so specs need a clean slate.
export const _reset = () => entries.clear();

// Candidate order must not change the key: the same set of jobs asked in a
// different order is the same question, so it must hit the same cached answer.
// The prompt is normalized here (not at the call sites) so the limiter's
// cacheHit and the route's lookup can never disagree on what "the same
// question" means.
export const keyFor = (userId, prompt, candidateIds) => {
  const ids = (Array.isArray(candidateIds) ? candidateIds : []).map(String).sort();
  const payload = JSON.stringify([String(userId ?? ''), normalize(prompt), ids]);
  return createHash('sha1').update(payload).digest('hex');
};

export const lookup = (key) => {
  const entry = entries.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    entries.delete(key);
    return null;
  }

  // Refresh insertion order on access so the cap evicts the least recently used.
  entries.delete(key);
  entries.set(key, entry);
  return entry;
};

export const store = (key, entry) => {
  const now = Date.now();
  entries.delete(key);
  entries.set(key, {
    mode: entry.mode,
    ranking: entry.ranking,
    reasons: entry.reasons,
    generatedAt: now,
    expiresAt: now + TTL_MS,
  });

  while (entries.size > MAX_ENTRIES) {
    entries.delete(entries.keys().next().value);
  }
};

// Skip function for jobMatchLimiter: a live cached result is free to replay, so
// it must not count against the caller's budget. Missing user/body is never a hit.
export const cacheHit = (req) => {
  const userId = req?.user?.id;
  const body = req?.body;
  if (!userId || typeof body?.prompt !== 'string') return false;

  return lookup(keyFor(userId, body.prompt, body.candidateIds)) !== null;
};
