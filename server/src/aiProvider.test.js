import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The provider logs through the shared logger; capture its calls so the
// "never logs message content" contract is asserted on what is actually
// emitted, not on a guessed format.
const logs = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('./logger.js', () => ({ default: logs }));

const { isConfigured, resolveConfig, normalize, callChat, providerCallBudget } =
  await import('./aiProvider.js');

const ENV_KEYS = ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_BASE_URL'];
const KEY = 'sk-test-key';
const MESSAGE = { role: 'user', content: 'find me a welding job nearby' };

const fetchMock = vi.fn();
let savedEnv;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  providerCallBudget.reset();
  for (const fn of Object.values(logs)) fn.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
});

const okResponse = (content) => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });
const call = () => callChat({ messages: [MESSAGE] });

describe('aiProvider', () => {
  it('resolves openrouter defaults without env', () => {
    expect(resolveConfig()).toEqual({
      key: null,
      base: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o-mini',
    });
    expect(isConfigured()).toBe(false);
  });

  it('picks the code default model only for the openrouter base', () => {
    process.env.OPENROUTER_API_KEY = KEY;
    process.env.OPENROUTER_BASE_URL = 'https://integrate.api.nvidia.com/v1';

    expect(resolveConfig()).toEqual({
      key: KEY,
      base: 'https://integrate.api.nvidia.com/v1',
      model: null,
    });
    expect(isConfigured()).toBe(true);

    process.env.OPENROUTER_MODEL = 'nvidia/test-model';
    expect(resolveConfig().model).toBe('nvidia/test-model');
  });

  it('warns exactly once when a custom base has a key but no model', async () => {
    process.env.OPENROUTER_API_KEY = KEY;
    process.env.OPENROUTER_BASE_URL = 'https://integrate.api.nvidia.com/v1';

    // Fresh module instance: the "once" flag is module state, and earlier
    // specs in this file already legitimately triggered it.
    vi.resetModules();
    const fresh = await import('./aiProvider.js');

    expect(fresh.resolveConfig().model).toBeNull();
    expect(fresh.isConfigured()).toBe(true);
    expect(logs.warn).toHaveBeenCalledTimes(1);
    expect(String(logs.warn.mock.calls[0][0])).toMatch(/OPENROUTER_MODEL/);
  });

  it('returns OK for a valid completion', async () => {
    process.env.OPENROUTER_API_KEY = KEY;
    fetchMock.mockResolvedValueOnce(okResponse('hi'));

    await expect(call()).resolves.toEqual({ kind: 'OK', reply: 'hi' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      model: 'openai/gpt-4o-mini',
      messages: [MESSAGE],
      max_tokens: 1200,
    });
  });

  it('maps upstream 401/403/404/429/5xx to UPSTREAM_FAILURE, not errors', async () => {
    process.env.OPENROUTER_API_KEY = KEY;
    for (const status of [401, 403, 404, 429, 500, 503]) {
      fetchMock.mockResolvedValueOnce({ ok: false, status });
      await expect(call()).resolves.toEqual({ kind: 'UPSTREAM_FAILURE', status });
    }
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('maps timeout and malformed bodies to UPSTREAM_FAILURE', async () => {
    process.env.OPENROUTER_API_KEY = KEY;

    // A fetch that honours the abort signal, so the 5 ms timeout actually fires.
    fetchMock.mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError')));
    }));
    await expect(callChat({ messages: [MESSAGE], timeoutMs: 5 }))
      .resolves.toEqual({ kind: 'UPSTREAM_FAILURE', status: null });

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => JSON.parse('not json') });
    await expect(call()).resolves.toEqual({ kind: 'UPSTREAM_FAILURE', status: null });
  });

  it('stays under the global minute budget and reports exhaustion without calling fetch', async () => {
    process.env.OPENROUTER_API_KEY = KEY;
    fetchMock.mockResolvedValue(okResponse('hi'));

    for (let i = 0; i < 20; i += 1) {
      expect((await call()).kind).toBe('OK');
    }
    expect(fetchMock).toHaveBeenCalledTimes(20);

    fetchMock.mockClear();
    await expect(call()).resolves.toEqual({ kind: 'UPSTREAM_FAILURE', status: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalize collapses whitespace', () => {
    expect(normalize('  hello \n\t world  ')).toBe('hello world');
    expect(normalize('a\n\nb')).toBe('a b');
    expect(normalize(null)).toBe('');
    expect(normalize(42)).toBe('42');
  });

  it('never logs message content', async () => {
    process.env.OPENROUTER_API_KEY = KEY;
    const secret = 'my-very-private-application-story';
    const reply = 'a model reply body';

    fetchMock.mockResolvedValueOnce(okResponse(reply));
    await callChat({ messages: [{ role: 'user', content: secret }] });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await callChat({ messages: [{ role: 'user', content: secret }] });

    const lines = Object.values(logs)
      .flatMap((fn) => fn.mock.calls)
      .map((args) => JSON.stringify(args));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toContain(secret);
      expect(line).not.toContain(reply);
    }

    // Status class + latency only.
    for (const [, fields] of [...logs.info.mock.calls, ...logs.warn.mock.calls]) {
      expect(Object.keys(fields).sort()).toEqual(['ms', 'status']);
      expect(Number.isFinite(fields.ms)).toBe(true);
    }
  });
});
