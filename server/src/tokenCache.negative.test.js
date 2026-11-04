import { describe, it, expect, vi, beforeEach } from 'vitest';

// tokenCache.js memoizes the Supabase getUser result. The F2 contract (ADR-028)
// originally cached positives only; retries pay a real round-trip per request,
// so definite 4xx answers are now memoized too — while transport failures,
// rate limits and 5xx never are: an outage must not turn a valid session into
// a remembered 401, and 429 must not trip the limiter hammering it.
const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }));

process.env.SUPABASE_URL ||= 'http://127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const { cachedGetUser, clearTokenCache } = await import('./tokenCache.js');

const user = { id: 'u1', email: 'u@x.com' };

beforeEach(() => {
  mocks.getUser.mockReset();
  clearTokenCache();
});

describe('negative memo of definite auth rejections', () => {
  it('an explicit 4xx rejection is memoized for the TTL', async () => {
    mocks.getUser.mockResolvedValue({ data: null, error: { status: 401, message: 'invalid JWT' } });
    expect(await cachedGetUser('token-a', mocks.getUser)).toBeNull();
    expect(await cachedGetUser('token-a', mocks.getUser)).toBeNull(); // served from the memo
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it('a transport failure (status 0) is never memoized', async () => {
    mocks.getUser.mockResolvedValue({ data: null, error: { status: 0, message: 'FetchError' } });
    expect(await cachedGetUser('token-b', mocks.getUser)).toBeNull();
    expect(await cachedGetUser('token-b', mocks.getUser)).toBeNull();
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });

  it('a 429 / 5xx answer is never memoized', async () => {
    mocks.getUser.mockResolvedValue({ data: null, error: { status: 429, message: 'over rate limit' } });
    await cachedGetUser('token-c', mocks.getUser);
    mocks.getUser.mockResolvedValue({ data: null, error: { status: 500, message: 'boom' } });
    await cachedGetUser('token-c', mocks.getUser);
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    expect(await cachedGetUser('token-c', mocks.getUser)).toEqual(user);
    expect(mocks.getUser).toHaveBeenCalledTimes(3);
  });

  it('a thrown-only failure is not memoized (it escapes to the caller)', async () => {
    mocks.getUser.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(cachedGetUser('token-d', mocks.getUser)).rejects.toThrow('ECONNREFUSED');
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    expect(await cachedGetUser('token-d', mocks.getUser)).toEqual(user);
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });

  it('the memo is released once the 60s TTL passes', async () => {
    vi.useFakeTimers();
    try {
      mocks.getUser.mockResolvedValue({ data: null, error: { status: 401, message: 'invalid JWT' } });
      expect(await cachedGetUser('token-e', mocks.getUser)).toBeNull();
      vi.advanceTimersByTime(59_000);
      expect(await cachedGetUser('token-e', mocks.getUser)).toBeNull();
      expect(mocks.getUser).toHaveBeenCalledTimes(1); // still inside the TTL
      vi.advanceTimersByTime(2_000); // now past 60s
      mocks.getUser.mockResolvedValue({ data: { user }, error: null });
      expect(await cachedGetUser('token-e', mocks.getUser)).toEqual(user);
      expect(mocks.getUser).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
