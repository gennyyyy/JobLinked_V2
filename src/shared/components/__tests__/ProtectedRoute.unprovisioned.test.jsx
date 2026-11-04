import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';

vi.mock('../../hooks/useAuth', () => ({
  default: vi.fn(),
}));

import useAuth from '../../hooks/useAuth';

function renderWithRouter(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={route} element={ui} />
        <Route path="/login" element={<div>Sign In</div>} />
        <Route path="/complete-registration" element={<div>Complete Registration</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute unprovisioned account handling', () => {
  it('redirects to /complete-registration when needsProvisioning is true', async () => {
    useAuth.mockReturnValue({
      user: null,
      role: null,
      loading: false,
      needsProvisioning: true,
    });
    renderWithRouter(
      <ProtectedRoute role="employer">
        <div>Secret</div>
      </ProtectedRoute>,
      { route: '/employer' }
    );
    expect(await screen.findByText('Complete Registration')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
  });

  it('renders children when needsProvisioning is false and role matches', () => {
    useAuth.mockReturnValue({
      user: { id: '1' },
      role: 'employer',
      loading: false,
      needsProvisioning: false,
    });
    renderWithRouter(
      <ProtectedRoute role="employer">
        <div>Employer Dashboard</div>
      </ProtectedRoute>,
      { route: '/employer' }
    );
    expect(screen.getByText('Employer Dashboard')).toBeInTheDocument();
  });
});
