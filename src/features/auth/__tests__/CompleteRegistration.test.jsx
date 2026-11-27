import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CompleteRegistration from '../CompleteRegistration';

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: vi.fn(),
}));

// Real service + shared client seam; the API layer answers /auth/provision.
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

import useAuth from '../../../shared/hooks/useAuth';
import { api } from '../../../shared/lib/api';
import { stashApplyIntent } from '../../../shared/lib/applyIntent';

const apiError = (status, message) => Object.assign(new Error(message), { status });
const NO_PENDING = () => apiError(400, 'role must be job-seeker, employer, or super-admin');

function renderWithRouter(ui, { initialPath = '/complete-registration' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/complete-registration" element={ui} />
        <Route path="/job-seeker" element={<div>Job Seeker Portal</div>} />
        <Route path="/job-seeker/jobs/42" element={<div>seeker job page</div>} />
        <Route path="/employer" element={<div>Employer Portal</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const unprovisioned = (refreshUser = vi.fn()) => {
  useAuth.mockReturnValue({
    user: null,
    needsProvisioning: true,
    sessionUser: { id: 'u1', email: 'test@example.com' },
    loading: false,
    refreshUser,
  });
  return refreshUser;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CompleteRegistration', () => {
  it('preselects role from query param', async () => {
    unprovisioned();
    api.post.mockRejectedValueOnce(NO_PENDING());
    renderWithRouter(<CompleteRegistration />, {
      initialPath: '/complete-registration?role=employer',
    });
    expect(await screen.findByLabelText(/registration path/i)).toHaveValue('employer');
  });

  it('defaults to job-seeker when no role param is present', async () => {
    unprovisioned();
    api.post.mockRejectedValueOnce(NO_PENDING());
    renderWithRouter(<CompleteRegistration />);
    expect(await screen.findByLabelText(/registration path/i)).toHaveValue('job-seeker');
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
    expect(api.post).not.toHaveBeenCalled();
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
    expect(api.post).not.toHaveBeenCalled();
  });

  it('auto-provisions once on mount and routes by the merged role', async () => {
    const refreshUser = unprovisioned();
    api.post.mockResolvedValue({ id: 'u1', role: 'job-seeker' });
    renderWithRouter(<CompleteRegistration />);

    expect(await screen.findByText('Job Seeker Portal')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('auth/provision', {});
    expect(refreshUser).toHaveBeenCalledWith({ id: 'u1', email: 'test@example.com' });
  });

  it('lands a provisioned job-seeker with an apply intent on the job page', async () => {
    localStorage.clear();
    unprovisioned();
    api.post.mockResolvedValue({ role: 'job-seeker' });
    stashApplyIntent('42');
    renderWithRouter(<CompleteRegistration />);
    expect(await screen.findByText('seeker job page')).toBeInTheDocument();
  });

  it('sends a provisioned employer to the employer portal', async () => {
    localStorage.clear();
    unprovisioned();
    api.post.mockResolvedValue({ role: 'employer' });
    stashApplyIntent('42');
    renderWithRouter(<CompleteRegistration />);
    expect(await screen.findByText('Employer Portal')).toBeInTheDocument();
  });

  it('never renders the form while the automatic merge is in flight', async () => {
    unprovisioned();
    let resolve;
    api.post.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderWithRouter(<CompleteRegistration />);

    expect(screen.queryByLabelText(/registration path/i)).not.toBeInTheDocument();
    resolve({ id: 'u1', role: 'employer' });
    expect(await screen.findByText('Employer Portal')).toBeInTheDocument();
  });

  it('falls back to the form when there is no pending invite or signup (400)', async () => {
    unprovisioned();
    api.post.mockRejectedValueOnce(NO_PENDING());
    api.post.mockResolvedValueOnce({ role: 'job-seeker' });
    renderWithRouter(<CompleteRegistration />);

    await userEvent.type(await screen.findByLabelText(/first name/i), 'John');
    await userEvent.type(screen.getByLabelText(/middle name/i), 'M');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.click(screen.getByRole('checkbox', { name: /terms of use/i }));
    await userEvent.click(screen.getByRole('button', { name: /complete registration/i }));

    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('auth/provision', {
      role: 'job-seeker',
      first_name: 'John',
      middle_name: 'M',
      last_name: 'Doe',
      suffix: '',
      email: 'test@example.com',
      terms_accepted: true,
    }));
    expect(await screen.findByText('Job Seeker Portal')).toBeInTheDocument();
  });

  it('blocks the fallback submit until the terms box is checked', async () => {
    unprovisioned();
    api.post.mockRejectedValueOnce(NO_PENDING());
    renderWithRouter(<CompleteRegistration />);

    await userEvent.type(await screen.findByLabelText(/first name/i), 'John');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    const terms = screen.getByRole('checkbox', { name: /terms of use/i });
    expect(terms).toBeRequired();
    expect(terms).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: /complete registration/i }));

    // Native required validation stops the submit; only the automatic merge
    // attempt reached the server.
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('calls provision with company fields for employer', async () => {
    unprovisioned();
    api.post.mockRejectedValueOnce(NO_PENDING());
    api.post.mockResolvedValueOnce({ role: 'employer' });
    renderWithRouter(<CompleteRegistration />, {
      initialPath: '/complete-registration?role=employer',
    });

    await userEvent.type(await screen.findByLabelText(/first name/i), 'Jane');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Smith');
    await userEvent.type(screen.getByLabelText(/company name/i), 'Acme Corp');
    await userEvent.type(screen.getByLabelText(/company email/i), 'info@acme.com');
    await userEvent.click(screen.getByRole('checkbox', { name: /terms of use/i }));
    await userEvent.click(screen.getByRole('button', { name: /complete registration/i }));

    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('auth/provision', {
      role: 'employer',
      first_name: 'Jane',
      middle_name: '',
      last_name: 'Smith',
      suffix: '',
      email: 'test@example.com',
      company_name: 'Acme Corp',
      company_email: 'info@acme.com',
      terms_accepted: true,
    }));
    expect(await screen.findByText('Employer Portal')).toBeInTheDocument();
  });

  it('shows the error above the form when the automatic merge fails unexpectedly', async () => {
    unprovisioned();
    api.post.mockRejectedValueOnce(apiError(500, 'Server error'));
    renderWithRouter(<CompleteRegistration />);

    expect(await screen.findByText('Server error')).toBeInTheDocument();
    expect(screen.getByLabelText(/registration path/i)).toBeInTheDocument();
  });
});
