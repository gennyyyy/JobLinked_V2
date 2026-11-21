import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { authClientMock, resetAuthClient, setAuthSession } from '../../../test/authClientMock';

const getProfile = vi.fn();

vi.mock('../../lib/auth-client', async () => {
  const { authClientMock: client } = await import('../../../test/authClientMock');
  return { authClient: client };
});
vi.mock('../../lib/api', () => ({ setApiIdentity: vi.fn() }));
vi.mock('../../services/auth', () => ({ getProfile }));

const { default: AuthProvider } = await import('../AuthProvider');
const { default: useAuth } = await import('../../hooks/useAuth');

const signIn = (userId, email = 'test@example.com') =>
  act(() => setAuthSession({ user: { id: userId, email } }));
const signOutSession = () => act(() => setAuthSession(null));

function Child() {
  const { user, loading, needsProvisioning, sessionUser } = useAuth();
  return (
    <>
      <div>ready</div>
      <span data-testid="auth-role">{user ? user.role : 'anon'}</span>
      <span data-testid="auth-loading">{loading ? 'yes' : 'no'}</span>
      <span data-testid="needs-provisioning">{needsProvisioning ? 'yes' : 'no'}</span>
      <span data-testid="session-user">{sessionUser ? sessionUser.id : 'none'}</span>
    </>
  );
}

beforeEach(() => {
  getProfile.mockReset();
  resetAuthClient();
});

describe('AuthProvider unprovisioned account handling', () => {
  it('sets needsProvisioning when session exists but profile returns null', async () => {
    getProfile.mockResolvedValue(null);
    render(
      <AuthProvider>
        <Child />
      </AuthProvider>,
    );
    signIn('u1', 'unprovisioned@example.com');
    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('no'));
    expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('yes');
    expect(screen.getByTestId('session-user')).toHaveTextContent('u1');
    expect(screen.getByTestId('auth-role')).toHaveTextContent('anon');
    // The session is valid — a missing profile must never sign the user out.
    expect(authClientMock.signOut).not.toHaveBeenCalled();
  });

  it('clears needsProvisioning when profile is later loaded', async () => {
    getProfile.mockResolvedValueOnce(null);
    render(
      <AuthProvider>
        <Child />
      </AuthProvider>,
    );
    signIn('u1', 'unprovisioned@example.com');
    await waitFor(() => expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('yes'));

    // Sign out to clear the state, then sign in again with a profile.
    signOutSession();
    await waitFor(() => expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('no'));

    getProfile.mockResolvedValueOnce({ id: 'u1', role: 'job-seeker' });
    signIn('u1', 'unprovisioned@example.com');
    await waitFor(() => expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('no'));
    expect(screen.getByTestId('auth-role')).toHaveTextContent('job-seeker');
  });

  it('clears needsProvisioning on sign out', async () => {
    getProfile.mockResolvedValue(null);
    render(
      <AuthProvider>
        <Child />
      </AuthProvider>,
    );
    signIn('u1', 'unprovisioned@example.com');
    await waitFor(() => expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('yes'));

    signOutSession();
    await waitFor(() => expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('no'));
    expect(screen.getByTestId('session-user')).toHaveTextContent('none');
  });
});
