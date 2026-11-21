import { createAuthClient } from 'better-auth/react';
import { apiUrl } from './apiUrl';

// Session transport is BA's signed cookie on the API origin (ADR-056): every
// call must carry it cross-origin. baseURL comes from apiUrl() so it can
// never drift from VITE_API_URL; empty means same-origin.
export const authClient = createAuthClient({
  baseURL: apiUrl() || undefined,
  fetchOptions: { credentials: 'include' },
});
