import { authClient } from './auth-client';
import { apiUrl } from './apiUrl';

// Sole HTTP path for all data access. Cookies carry the session (better-auth),
// sends JSON by default (FormData passes through for uploads), and throws
// Error(message) with .status on { error } bodies — pages already render
// error.message.

// Absolute URL for a public API asset (company logo) that <img src> can load
// without a session.
export const apiAssetUrl = (path) => `${apiUrl()}/api/${String(path || '').replace(/^\/+/, '')}`;

// The GET cache is keyed per identity so one account's data can never be
// served to another. AuthProvider owns the transitions and calls this before
// any profile/API read; 'anon' covers every signed-out read.
let identity = 'anon';

function withQuery(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    qs.append(key, String(value));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

function throwStatus(res, message, apiError) {
  const error = new Error(message || res.statusText || 'Request failed');
  error.status = res.status;
  if (apiError) error.error = apiError;
  throw error;
}

export function isUnprovisioned(err) {
  return err?.error?.code === 'FORBIDDEN' && /provisioned/i.test(err?.error?.message);
}

function unreachable(url) {
  const error = new Error('Can\u2019t reach the server right now \u2014 it may be restarting. Please try again in a moment.');
  error.status = 0;
  error.detail = `Cannot reach the API at ${url} \u2014 is the server running? (npm: node src/index.js in server/)`;
  throw error;
}

async function bounce(res) {
  let message;
  try {
    message = (await res.json())?.error?.message;
  } catch { /* non-JSON error body */ }
  try {
    await authClient.signOut();
  } catch { /* best-effort cleanup before bounce */ }
  window.location.href = '/login';
  throwStatus(res, message);
}

// Exactly one getSession probe + one retry per 401, then bounce. Straight-line
// code — no loop or recursion — so an infinite retry loop is impossible.
// A 401 with no session user is a public call's refusal: throw it untouched
// (never bounce a signed-out visitor). Shared by request() and blob().
async function settleAuth(res, url, retry) {
  if (res.status === 401) {
    const { data } = await authClient.getSession().catch(() => ({ data: null }));
    if (data?.user) {
      try {
        // The browser re-sends the (possibly just-refreshed) session cookie.
        res = await retry();
      } catch {
        unreachable(url);
      }
      if (res.status === 401) await bounce(res);
    }
  }
  if (!res.ok) {
    let apiError;
    let parsed = false;
    try {
      apiError = (await res.json())?.error;
      parsed = true;
    } catch { /* non-JSON error body (e.g. an nginx 502 HTML page) */ }
    // Say what actually happened: a saturated rate bucket and a restarting
    // service are not "check your connection" problems.
    let message = apiError?.message;
    if (res.status === 429 && apiError?.code === 'RATE_LIMITED') {
      message = 'Too many requests \u2014 please wait a moment.';
    } else if (res.status >= 500 && !parsed) {
      message = 'The service is having trouble \u2014 please try again shortly.';
    }
    throwStatus(res, message, apiError);
  }
  return res;
}

// Two layers over GET, both keyed `${identity}::${path}` so one identity's data
// can never be served to another:
// - in-flight coalescing: identical GETs while one is pending share its promise;
// - a 10 s cache of parsed 2xx JSON, so fast page switching does not refetch
//   the same lists. Errors, 429s, and non-JSON bodies are never stored (send
//   throws before resolution), and any non-GET clears the whole cache.
const GET_CACHE_TTL_MS = 10_000;
const getCache = new Map();
const inFlightGets = new Map();
// Bumped on every clear so a GET that was already in flight when a write or a
// sign-out landed cannot store the stale body under the new state.
let cacheGeneration = 0;

export function clearApiCache() {
  cacheGeneration += 1;
  getCache.clear();
}

export function setApiIdentity(id) {
  const next = id || 'anon';
  if (next === identity) return;
  identity = next;
  cacheGeneration += 1;
  getCache.clear();
  inFlightGets.clear();
}

async function request(method, path, body) {
  if (method !== 'GET') {
    clearApiCache();
    return send(method, path, body);
  }
  const key = `${identity}::${path}`;
  const cached = getCache.get(key);
  if (cached && Date.now() - cached.at < GET_CACHE_TTL_MS) return cached.value;
  // An expired entry is useless; drop it so the map only holds live reads.
  if (cached) getCache.delete(key);
  const pending = inFlightGets.get(key);
  if (pending) return pending;
  const generation = cacheGeneration;
  const promise = send(method, path, body);
  inFlightGets.set(key, promise);
  const settle = () => inFlightGets.delete(key);
  promise.then(
    (value) => {
      if (value !== null && generation === cacheGeneration) getCache.set(key, { value, at: Date.now() });
      settle();
    },
    settle,
  );
  return promise;
}

async function send(method, path, body) {
  const isForm = body instanceof FormData;
  const url = `${apiUrl()}/api/${path}`;
  const base = isForm ? {} : { 'Content-Type': 'application/json' };
  const payload = isForm ? body : body === undefined ? undefined : JSON.stringify(body);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: base,
      body: payload,
      credentials: 'include',
    });
  } catch {
    unreachable(url);
  }
  res = await settleAuth(res, url,
    () => fetch(url, { method, headers: base, body: payload, credentials: 'include' }));
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function blob(path) {
  const url = `${apiUrl()}/api/${path}`;
  let res;
  try {
    res = await fetch(url, { credentials: 'include' });
  } catch {
    unreachable(url);
  }
  res = await settleAuth(res, url, () => fetch(url, { credentials: 'include' }));
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `Request failed (${res.status})`;
    try {
      const body = JSON.parse(text);
      if (body?.error?.message) message = body.error.message;
    } catch { /* non-JSON error body */ }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return res.blob();
}

export const api = {
  get: (path, params) => request('GET', withQuery(path, params)),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
  blob: (path) => blob(path),
};
