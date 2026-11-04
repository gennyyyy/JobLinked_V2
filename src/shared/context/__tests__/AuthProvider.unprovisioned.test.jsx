import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

let mockAuthCallback = null;
const getProfile = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb) => {
        mockAuthCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));
vi.mock('../../services/auth', () => ({ getProfile, signOut: vi.fn() }));

const { default: AuthProvider } = await import('../AuthProvider');
const { default: useAuth } = await import('../../hooks/useAuth');

const emit = (event, userId, email = 'test@example.com') =>
  mockAuthCallback(event, userId ? { user: { id: userId, email } } : null);

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

beforeEach(() => getProfile.mockReset());

describe('AuthProvider unprovisioned account handling', () => {
  it('sets needsProvisioning when session exists but profile returns null', async () => {
    getProfile.mockResolvedValue(null);
    render(
      <AuthProvider>
        <Child />
      </AuthProvider>,
    );
    emit('SIGNED_IN', 'u1', 'unprovisioned@example.com');
    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('no'));
    expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('yes');
    expect(screen.getByTestId('session-user')).toHaveTextContent('u1');
    expect(screen.getByTestId('auth-role')).toHaveTextContent('anon');
  });

  it('clears needsProvisioning when profile is later loaded', async () => {
    getProfile.mockResolvedValueOnce(null);
    render(
      <AuthProvider>
        <Child />
      </AuthProvider>,
    );
    emit('SIGNED_IN', 'u1', 'unprovisioned@example.com');
    await waitFor(() => expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('yes'));

    // Sign out to clear the state, then sign in again with a profile.
    emit('SIGNED_OUT', null);
    await waitFor(() => expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('no'));

    getProfile.mockResolvedValueOnce({ id: 'u1', role: 'job-seeker' });
    emit('SIGNED_IN', 'u1', 'unprovisioned@example.com');
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
    emit('SIGNED_IN', 'u1', 'unprovisioned@example.com');
    await waitFor(() => expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('yes'));

    emit('SIGNED_OUT', null);
    await waitFor(() => expect(screen.getByTestId('needs-provisioning')).toHaveTextContent('no'));
    expect(screen.getByTestId('session-user')).toHaveTextContent('none');
  });
});
