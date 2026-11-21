import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from '../Login';

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../../../shared/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(), blob: vi.fn() },
  clearApiCache: vi.fn(),
  setApiIdentity: vi.fn(),
}));
vi.mock('../../../shared/lib/auth-client', async () => {
  const { authClientMock } = await import('../../../test/authClientMock')
  return { authClient: authClientMock }
});
vi.mock('../../../shared/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn(), updateUser: vi.fn() } },
}));

// No captcha here: a local .env.local carries a real site key, which would gate
// the submit before signIn is ever called. Same empty-key mock Login.test.jsx uses.
vi.mock('../../../shared/lib/turnstile', () => ({
  TURNSTILE_SITE_KEY: '',
  loadTurnstile: vi.fn(),
  renderTurnstile: vi.fn(),
  resetTurnstile: vi.fn(),
  removeTurnstile: vi.fn(),
}));

import useAuth from '../../../shared/hooks/useAuth';
import { api } from '../../../shared/lib/api';
import { authClientMock, resetAuthClient } from '../../../test/authClientMock';

beforeEach(() => {
  vi.clearAllMocks();
  resetAuthClient();
  useAuth.mockReturnValue({ user: null, authenticate: vi.fn() });
  // Valid BA credentials + a session, but no role row on this account.
  authClientMock.signIn.email.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  authClientMock.getSession.mockResolvedValue({ data: { user: { id: 'u1', email: 'new@example.com' } } });
  api.get.mockRejectedValue(Object.assign(new Error('Account not provisioned'), { status: 403 }));
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/complete-registration" element={<div>Complete Registration Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Login unprovisioned account routing', () => {
  it('navigates to /complete-registration when signIn needs provisioning', async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Complete Registration Page')).toBeInTheDocument();
    // The client never provisions from metadata: the recovery page does it.
    expect(api.post).not.toHaveBeenCalled();
  });

  it('does not show error message for unprovisioned accounts', async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.findByText('Complete Registration Page')).resolves.toBeInTheDocument());
    expect(screen.queryByText(/needs provision/i)).not.toBeInTheDocument();
  });
});
