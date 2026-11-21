// One source of the API origin: every HTTP path (api.js, the Better Auth
// client) reads it here so the cookie transport can never drift from
// VITE_API_URL / the dev default / same-origin production.
export function apiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return 'http://localhost:4000';
  return '';
}
