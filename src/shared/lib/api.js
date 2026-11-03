import { supabase } from './supabase';

// Sole HTTP path for all data access. Attaches the Supabase session JWT,
// sends JSON by default (FormData passes through for uploads), and throws
// Error(message) with .status on { error } bodies — pages already render
// error.message.
function apiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return 'http://localhost:4000';
  throw new Error('Missing VITE_API_URL — see .env.example');
}

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

function throwStatus(res, message) {
  const error = new Error(message || res.statusText || 'Request failed');
  error.status = res.status;
  throw error;
}

function unreachable(url) {
  const error = new Error(`Cannot reach the API at ${url} — is the server running? (npm: node src/index.js in server/)`);
  error.status = 0;
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
    let message;
    try {
      message = (await res.json())?.error?.message;
    } catch { /* non-JSON error body */ }
    throwStatus(res, message);
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
  window.location.href = '/portals';
  throwStatus(res, message);
}

async function request(method, path, body) {
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
  return res.blob();
}

export const api = {
  get: (path, params) => request('GET', withQuery(path, params)),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
  blob: (path) => blob(path),
};
