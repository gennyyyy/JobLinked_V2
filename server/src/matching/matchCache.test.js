import { describe, it, expect, beforeEach, vi } from 'vitest';
import { keyFor, lookup, store, cacheHit, _reset } from './matchCache.js';
import { jobMatchLimiter } from '../middleware/rateLimit.js';

const TTL_MS = 15 * 60 * 1000;

const req = (overrides = {}) => ({
  method: 'POST',
  path: '/jobs/match',
  originalUrl: '/api/jobs/match',
  ip: '203.0.113.7',
  headers: {},
  user: { id: 'user-1' },
  body: { prompt: 'welder in poblacion', candidateIds: ['b', 'a'] },
  ...overrides,
});

// Direct middleware invocation: express-rate-limit only touches these on res.
const res = () => {
  const response = {
    headersSent: false,
    statusCode: 200,
    headers: {},
    setHeader: (name, value) => { response.headers[name] = value; },
    status(code) { response.statusCode = code; return response; },
    json(body) { response.body = body; return response; },
  };
  return response;
};

beforeEach(() => {
  _reset();
});

describe('matchCache keys', () => {
  it('is independent of candidate order', () => {
    expect(keyFor('user-1', 'welder', ['b', 'a', 'c'])).toBe(keyFor('user-1', 'welder', ['a', 'b', 'c']));
  });

  it('normalizes the prompt before hashing', () => {
    expect(keyFor('user-1', '  Welder \n in   Poblacion ', ['a']))
      .toBe(keyFor('user-1', 'Welder in Poblacion', ['a']));
  });

  it('separates users, prompts, and candidates', () => {
    const base = keyFor('user-1', 'welder', ['a']);

    expect(keyFor('user-2', 'welder', ['a'])).not.toBe(base);
    expect(keyFor('user-1', 'cashier', ['a'])).not.toBe(base);
    expect(keyFor('user-1', 'welder', ['b'])).not.toBe(base);
  });
});

describe('matchCache store/lookup', () => {
  it('round-trips the entry with generatedAt and expiresAt', () => {
    const key = keyFor('user-1', 'welder', ['job-2', 'job-1']);
    const entry = {
      mode: 'ai',
      ranking: ['job-1', 'job-2'],
      reasons: [{ jobId: 'job-1', reason: 'Skills match 1 of 1' }],
    };

    store(key, entry);
    const found = lookup(key);

    expect(found.mode).toBe('ai');
    expect(found.ranking).toEqual(['job-1', 'job-2']);
    expect(found.reasons).toEqual([{ jobId: 'job-1', reason: 'Skills match 1 of 1' }]);
    expect(typeof found.generatedAt).toBe('number');
    expect(found.expiresAt - found.generatedAt).toBe(TTL_MS);
  });

  it('returns null for an unknown key', () => {
    expect(lookup(keyFor('nobody', 'nothing', []))).toBeNull();
  });
});

describe('matchCache TTL', () => {
  it('expires entries after 15 minutes and drops them', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const key = keyFor('user-1', 'welder', ['a']);
      store(key, { mode: 'heuristic', ranking: ['a'], reasons: [] });

      vi.advanceTimersByTime(TTL_MS - 1);
      expect(lookup(key)).not.toBeNull();

      vi.advanceTimersByTime(1);
      expect(lookup(key)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('matchCache LRU cap', () => {
  it('evicts the oldest entry beyond 300', () => {
    for (let i = 0; i < 300; i += 1) {
      store(keyFor('user-1', `prompt-${i}`, []), { mode: 'heuristic', ranking: [], reasons: [] });
    }

    store(keyFor('user-1', 'prompt-300', []), { mode: 'heuristic', ranking: [], reasons: [] });

    expect(lookup(keyFor('user-1', 'prompt-0', []))).toBeNull();
    expect(lookup(keyFor('user-1', 'prompt-1', []))).not.toBeNull();
    expect(lookup(keyFor('user-1', 'prompt-300', []))).not.toBeNull();
  });
});

describe('cacheHit', () => {
  it('is false when user or body is missing', () => {
    expect(cacheHit({})).toBe(false);
    expect(cacheHit({ user: { id: 'user-1' } })).toBe(false);
    expect(cacheHit({ body: { prompt: 'welder' } })).toBe(false);
    expect(cacheHit()).toBe(false);
  });

  it('is true only for a live entry with the same user, prompt, and candidates', () => {
    const request = req();
    store(keyFor(request.user.id, request.body.prompt, request.body.candidateIds), {
      mode: 'heuristic',
      ranking: [],
      reasons: [],
    });

    expect(cacheHit(request)).toBe(true);
    expect(cacheHit(req({ body: { prompt: 'cashier', candidateIds: ['b', 'a'] } }))).toBe(false);
    expect(cacheHit(req({ user: { id: 'user-2' } }))).toBe(false);
  });
});

describe('jobMatchLimiter', () => {
  it('429s with the shared error body after 30 cache misses', async () => {
    const user = { id: 'limiter-miss-user' };

    for (let i = 0; i < 30; i += 1) {
      const next = vi.fn();
      await jobMatchLimiter(req({ user }), res(), next);
      expect(next).toHaveBeenCalledOnce();
    }

    const blocked = res();
    const next = vi.fn();
    await jobMatchLimiter(req({ user }), blocked, next);

    expect(next).not.toHaveBeenCalled();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
    });
  });

  it('skips cached requests without counting them', async () => {
    const user = { id: 'limiter-hit-user' };
    const body = { prompt: 'cached prompt', candidateIds: ['b', 'a'] };
    store(keyFor(user.id, body.prompt, body.candidateIds), { mode: 'heuristic', ranking: [], reasons: [] });

    // Well over the 30 limit: passing proves the skip neither blocks nor counts.
    for (let i = 0; i < 31; i += 1) {
      const next = vi.fn();
      const response = res();
      await jobMatchLimiter(req({ user, body }), response, next);
      expect(next).toHaveBeenCalledOnce();
      expect(response.statusCode).toBe(200);
    }
  });
});
