import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CompleteRegistration from '../CompleteRegistration';

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../../../shared/services/auth', () => ({
  provision: vi.fn(),
}));

import useAuth from '../../../shared/hooks/useAuth';
import { provision } from '../../../shared/services/auth';

function renderWithRouter(ui, { initialPath = '/complete-registration' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/complete-registration" element={ui} />
        <Route path="/job-seeker" element={<div>Job Seeker Portal</div>} />
        <Route path="/employer" element={<div>Employer Portal</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CompleteRegistration', () => {
  it('preselects role from query param', () => {
    useAuth.mockReturnValue({
      user: null,
      needsProvisioning: true,
      sessionUser: { id: 'u1', email: 'test@example.com' },
      loading: false,
      refreshUser: vi.fn(),
    });
    renderWithRouter(<CompleteRegistration />, {
      initialPath: '/complete-registration?role=employer',
    });
    expect(screen.getByLabelText(/registration path/i)).toHaveValue('employer');
  });

  it('defaults to job-seeker when no role param is present', () => {
    useAuth.mockReturnValue({
      user: null,
      needsProvisioning: true,
      sessionUser: { id: 'u1', email: 'test@example.com' },
      loading: false,
      refreshUser: vi.fn(),
    });
    renderWithRouter(<CompleteRegistration />);
    expect(screen.getByLabelText(/registration path/i)).toHaveValue('job-seeker');
  });

  it('redirects to /login when no session exists', async () => {
    useAuth.mockReturnValue({
      user: null,
      needsProvisioning: false,
      sessionUser: null,
      loading: false,
      refreshUser: vi.fn(),
    });
    renderWithRouter(<CompleteRegistration />);
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to portal when user is already provisioned', async () => {
    useAuth.mockReturnValue({
      user: { id: 'u1', role: 'employer' },
      needsProvisioning: false,
      sessionUser: null,
      loading: false,
      refreshUser: vi.fn(),
    });
    renderWithRouter(<CompleteRegistration />);
    expect(await screen.findByText('Employer Portal')).toBeInTheDocument();
  });

  it('calls provision with correct payload for job-seeker and navigates', async () => {
    useAuth.mockReturnValue({
      user: null,
      needsProvisioning: true,
      sessionUser: { id: 'u1', email: 'test@example.com' },
      loading: false,
      refreshUser: vi.fn(),
    });
    provision.mockResolvedValue({ role: 'job-seeker' });
    renderWithRouter(<CompleteRegistration />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'John');
    await userEvent.type(screen.getByLabelText(/middle name/i), 'M');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.click(screen.getByRole('button', { name: /complete registration/i }));

    await waitFor(() =>
      expect(provision).toHaveBeenCalledWith({
        role: 'job-seeker',
        first_name: 'John',
        middle_name: 'M',
        last_name: 'Doe',
        suffix: '',
        email: 'test@example.com',
      })
    );
    expect(await screen.findByText('Job Seeker Portal')).toBeInTheDocument();
  });

  it('calls provision with company fields for employer', async () => {
    useAuth.mockReturnValue({
      user: null,
      needsProvisioning: true,
      sessionUser: { id: 'u1', email: 'test@example.com' },
      loading: false,
      refreshUser: vi.fn(),
    });
    provision.mockResolvedValue({ role: 'employer' });
    renderWithRouter(<CompleteRegistration />, {
      initialPath: '/complete-registration?role=employer',
    });

    await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Smith');
    await userEvent.type(screen.getByLabelText(/company name/i), 'Acme Corp');
    await userEvent.type(screen.getByLabelText(/company email/i), 'info@acme.com');
    await userEvent.click(screen.getByRole('button', { name: /complete registration/i }));

    await waitFor(() =>
      expect(provision).toHaveBeenCalledWith({
        role: 'employer',
        first_name: 'Jane',
        middle_name: '',
        last_name: 'Smith',
        suffix: '',
        email: 'test@example.com',
        company_name: 'Acme Corp',
        company_email: 'info@acme.com',
      })
    );
    expect(await screen.findByText('Employer Portal')).toBeInTheDocument();
  });

  it('shows error when provision fails', async () => {
    useAuth.mockReturnValue({
      user: null,
      needsProvisioning: true,
      sessionUser: { id: 'u1', email: 'test@example.com' },
      loading: false,
      refreshUser: vi.fn(),
    });
    provision.mockRejectedValue(new Error('Server error'));
    renderWithRouter(<CompleteRegistration />);

    await userEvent.type(screen.getByLabelText(/first name/i), 'John');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.click(screen.getByRole('button', { name: /complete registration/i }));

    expect(await screen.findByText('Server error')).toBeInTheDocument();
  });
});
