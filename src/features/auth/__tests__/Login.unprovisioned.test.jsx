import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from '../Login';

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../../../shared/services/auth', () => ({
  signIn: vi.fn(),
}));

import useAuth from '../../../shared/hooks/useAuth';
import { signIn } from '../../../shared/services/auth';

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
  it('navigates to /complete-registration when signIn throws "needs provision"', async () => {
    useAuth.mockReturnValue({ user: null, authenticate: vi.fn() });
    signIn.mockRejectedValue(new Error('needs provision'));
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Complete Registration Page')).toBeInTheDocument();
  });

  it('does not show error message for unprovisioned accounts', async () => {
    useAuth.mockReturnValue({ user: null, authenticate: vi.fn() });
    signIn.mockRejectedValue(new Error('needs provision'));
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.findByText('Complete Registration Page')).resolves.toBeInTheDocument());
    expect(screen.queryByText(/needs provision/i)).not.toBeInTheDocument();
  });
});
