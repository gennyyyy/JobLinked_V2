import { supabase } from './supabase';

// Sole HTTP path for all data access. Attaches the Supabase session JWT,
// sends JSON by default (FormData passes through for uploads), and throws
// Error(message) with .status on { error } bodies — pages already render
// error.message.
function apiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return 'http://localhost:4000';
  const err = new Error('We couldn\u2019t load this right now. Please check your connection and try again.');
  err.detail = 'Missing VITE_API_URL configuration';
  throw err;
}

// Absolute URL for a public API asset (company logo) that <img src> can load
// without an Authorization header.
export const apiAssetUrl = (path) => `${apiUrl()}/api/${String(path || '').replace(/^\/+/, '')}`;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
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
  const error = new Error('We couldn\u2019t load this right now. Please check your connection and try again.');
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
    try {
      apiError = (await res.json())?.error;
    } catch { /* non-JSON error body */ }
    throwStatus(res, apiError?.message, apiError);
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

// Concurrent identical GETs share one request — e.g. auth/me asked for by the
// auth provider and again by a page on a cold load. Entries are dropped the
// moment they settle, so this is dedupe only; nothing is cached and a later
// call always hits the network.
const inFlightGets = new Map();

async function request(method, path, body) {
  if (method !== 'GET') return send(method, path, body);
  const url = `${apiUrl()}/api/${path}`;
  const existing = inFlightGets.get(url);
  if (existing) return existing;
  const pending = send(method, path, body);
  inFlightGets.set(url, pending);
  const settle = () => inFlightGets.delete(url);
  pending.then(settle, settle);
  return pending;
}

async function send(method, path, body) {
  const isForm = body instanceof FormData;
  const url = `${apiUrl()}/api/${path}`;
  const base = isForm ? {} : { 'Content-Type': 'application/json' };
  const payload = isForm ? body : body === undefined ? undefined : JSON.stringify(body);
  const sent = await authHeaders();
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
  const sent = await authHeaders();
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
