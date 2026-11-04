import logger from './logger.js';

// Shared provider layer for OpenAI-compatible chat completions (ADR-023:
// a missing key must never stop the API booting, so env is read per call).
const DEFAULT_BASE = 'https://openrouter.ai/api/v1';
// Only this base has a model we can vouch for; every other base must name one.
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const BUDGET_CALLS = 20;
const BUDGET_WINDOW_MS = 60_000;

const env = (name) => String(process.env[name] ?? '').trim() || null;

export const resolveConfig = () => {
  const base = env('OPENROUTER_BASE_URL') || DEFAULT_BASE;
  return {
    key: env('OPENROUTER_API_KEY'),
    base,
    model: env('OPENROUTER_MODEL') || (base === DEFAULT_BASE ? DEFAULT_MODEL : null),
  };
};

export const isConfigured = () => resolveConfig().key !== null;

export const normalize = (text) => (text == null ? '' : String(text).replace(/\s+/g, ' ').trim());

// ponytail: in-process rolling window (single instance, same caveat as
// aiLimiter). A Redis counter is needed only if the API ever runs multi-instance.
const stamps = [];

const takeBudget = () => {
  const now = Date.now();
  while (stamps.length && now - stamps[0] >= BUDGET_WINDOW_MS) stamps.shift();
  if (stamps.length >= BUDGET_CALLS) return false;
  stamps.push(now);
  return true;
};

// Exported for tests only — production callers never touch the budget.
export const providerCallBudget = { reset: () => { stamps.length = 0; } };

const failure = (status = null) => ({ kind: 'UPSTREAM_FAILURE', status });

export async function callChat({ messages, maxTokens = 1200, timeoutMs = 10_000 } = {}) {
  const started = Date.now();
  // Trust-boundary discipline: log only the status class and latency, never
  // the prompt, messages, reply, or provider body.
  const finish = (status, result) => {
    const fields = { status, ms: Date.now() - started };
    if (status === 'OK') logger.info('ai provider call', fields);
    else logger.warn('ai provider call failed', fields);
    return result;
  };

  const config = resolveConfig();
  // A missing key or a custom base with no model is a config failure, not a
  // network one: fail fast instead of spending budget on a guaranteed 4xx.
  if (!config.key || !config.model) return finish('config', failure());
  if (!takeBudget()) return finish('budget', failure());

  let upstream;
  try {
    upstream = await fetch(`${config.base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({ model: config.model, messages, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const aborted = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return finish(aborted ? 'timeout' : 'network', failure());
  }

  if (!upstream.ok) {
    try { await upstream.body?.cancel?.(); } catch { /* already gone */ }
    return finish(`${Math.floor(upstream.status / 100)}xx`, failure(upstream.status));
  }

  let data;
  try { data = await upstream.json(); } catch { return finish('malformed', failure()); }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') return finish('empty', failure());
  return finish('OK', { kind: 'OK', reply: content.trim() });
}
