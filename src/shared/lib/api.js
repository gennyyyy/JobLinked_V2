import { supabase } from './supabase';

// Sole HTTP path for all data access. Attaches the Supabase session JWT,
// sends JSON by default (FormData passes through for uploads), and throws
// Error(message) with .status on { error } bodies — pages already render
// error.message.
function apiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return 'http://localhost:4000';
  return '';
}

// Absolute URL for a public API asset (company logo) that <img src> can load
// without an Authorization header.
export const apiAssetUrl = (path) => `${apiUrl()}/api/${String(path || '').replace(/^\/+/, '')}`;

// Token and user id come from one session read: the GET cache is keyed per
// identity, so the key must belong to the session that sends the request.
async function sessionAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    userId: session?.user?.id ?? 'anon',
  };
}

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

// Exactly one refreshSession + one retry per 401, then bounce. Straight-line
// code — no loop or recursion — so an infinite refresh loop is impossible.
// Shared by request() and blob(): on 401 retry once with a fresh token, then
// bounce on a second 401; non-OK responses throw the server's error message.
async function settleAuth(res, sent, url, retry) {
  if (res.status === 401 && sent.Authorization) {
    let fresh;
    try {
      fresh = await refreshedHeaders();
    } catch {
      await bounce(res);
    }
    try {
      res = await retry(fresh);
    } catch {
      unreachable(url);
    }
    if (res.status === 401) await bounce(res);
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

async function refreshedHeaders() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data?.session?.access_token) throw error || new Error('refresh failed');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function bounce(res) {
  let message;
  try {
    message = (await res.json())?.error?.message;
  } catch { /* non-JSON error body */ }
  try {
    await supabase.auth.signOut();
  } catch { /* best-effort cleanup before bounce */ }
  window.location.href = '/login';
  throwStatus(res, message);
}

// Two layers over GET, both keyed `${userId}::${path}` so one identity's data
// can never be served to another:
// - in-flight coalescing: identical GETs while one is pending share its promise;
// - a 10 s cache of parsed 2xx JSON, so fast page switching does not refetch
//   the same lists. Errors, 429s, and non-JSON bodies are never stored (send
//   throws before resolution), and any non-GET clears the whole cache.
const GET_CACHE_TTL_MS = 10_000;
const getCache = new Map();
const inFlightGets = new Map();
// Bumped on every clear so a GET that was already in flight when a write
// landed cannot store the pre-write body under the new state.
let cacheGeneration = 0;

export function clearApiCache() {
  cacheGeneration += 1;
  getCache.clear();
}

async function request(method, path, body) {
  if (method !== 'GET') {
    clearApiCache();
    return send(method, path, body);
  }
  const session = await sessionAuth();
  const key = `${session.userId}::${path}`;
  const cached = getCache.get(key);
  if (cached && Date.now() - cached.at < GET_CACHE_TTL_MS) return cached.value;
  // An expired entry is useless; drop it so the map only holds live reads.
  if (cached) getCache.delete(key);
  const pending = inFlightGets.get(key);
  if (pending) return pending;
  const generation = cacheGeneration;
  const promise = send(method, path, body, session);
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

async function send(method, path, body, session) {
  const isForm = body instanceof FormData;
  const url = `${apiUrl()}/api/${path}`;
  const base = isForm ? {} : { 'Content-Type': 'application/json' };
  const payload = isForm ? body : body === undefined ? undefined : JSON.stringify(body);
  const { headers: sent } = session || await sessionAuth();
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { ...base, ...sent },
      body: payload,
    });
  } catch {
    unreachable(url);
  }
  res = await settleAuth(res, sent, url,
    (fresh) => fetch(url, { method, headers: { ...base, ...fresh }, body: payload }));
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function blob(path) {
  const url = `${apiUrl()}/api/${path}`;
  const { headers: sent } = await sessionAuth();
  let res;
  try {
    res = await fetch(url, { headers: sent });
  } catch {
    unreachable(url);
  }
  res = await settleAuth(res, sent, url, (fresh) => fetch(url, { headers: fresh }));
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
