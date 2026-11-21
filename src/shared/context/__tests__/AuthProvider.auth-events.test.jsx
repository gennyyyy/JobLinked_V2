import { Button } from "../../../components/ui/button";
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { authClientMock, resetAuthClient, setAuthSession } from '../../../test/authClientMock'

const getProfile = vi.fn()
const setApiIdentity = vi.fn()

vi.mock('../../lib/auth-client', async () => {
  const { authClientMock: client } = await import('../../../test/authClientMock')
  return { authClient: client }
})
vi.mock('../../lib/api', () => ({ setApiIdentity }))
vi.mock('../../services/auth', () => ({ getProfile }))

const { default: AuthProvider } = await import('../AuthProvider')
const { default: useAuth } = await import('../../hooks/useAuth')

// Every transition goes through the same seam: a new session object, exactly
// like authClient.useSession() re-emitting after a sign-in/refresh/focus.
const signIn = (userId, email = 'test@example.com') =>
  act(() => setAuthSession({ user: { id: userId, email } }))
const signOutSession = () => act(() => setAuthSession(null))

function Child() {
  const { user, loading } = useAuth()
  return (
    <>
      <div>ready</div>
      <span data-testid="auth-role">{user ? user.role : 'anon'}</span>
      <span data-testid="auth-loading">{loading ? 'yes' : 'no'}</span>
    </>
  )
}

// Stands in for a page that fetches from `useEffect(..., [user])`: it counts a
// re-fetch only when React hands it a brand new user object.
function ProfileIdentityProbe({ sessionUser }) {
  const { user, refreshUser } = useAuth()
  const [userObjects, setUserObjects] = useState(0)

  useEffect(() => {
    if (user) setUserObjects((count) => count + 1)
  }, [user])

  return (
    <>
      <span data-testid="probe-role">{user ? user.role : 'anon'}</span>
      <span data-testid="probe-company">{user?.company_name || 'none'}</span>
      <span data-testid="probe-skills">{user?.skills ? user.skills.join(', ') : 'none'}</span>
      <span data-testid="probe-user-objects">{userObjects}</span>
      <Button type="button" onClick={() => refreshUser(sessionUser)}>refresh</Button>
    </>
  )
}

function AuthenticateProbe() {
  const { user, loading, authenticate } = useAuth()
  return (
    <>
      <span data-testid="auth-role">{user ? user.role : 'anon'}</span>
      <span data-testid="auth-loading">{loading ? 'yes' : 'no'}</span>
      <Button type="button" onClick={() => authenticate({ id: 'u1', role: 'employer' })}>seed</Button>
    </>
  )
}

function LogoutProbe() {
  const { user, loading, logout } = useAuth()
  return (
    <>
      <span data-testid="auth-role">{user ? user.role : 'anon'}</span>
      <span data-testid="auth-loading">{loading ? 'yes' : 'no'}</span>
      <Button type="button" onClick={() => logout()}>log out</Button>
    </>
  )
}

beforeEach(() => {
  getProfile.mockReset()
  setApiIdentity.mockReset()
  resetAuthClient()
})

describe('AuthProvider session transitions', () => {
  it('loads the profile once for repeated session emits of the same user', async () => {
    getProfile.mockResolvedValue({ id: 'u1', role: 'job-seeker' })
    render(<AuthProvider><Child /></AuthProvider>)
    signIn('u1')
    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1))
    // A focus refetch re-emits the same session — must not reload
    signIn('u1')
    signIn('u1')
    await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument())
    expect(getProfile).toHaveBeenCalledTimes(1)
  })

  it('reloads when a different user signs in', async () => {
    getProfile.mockResolvedValue({ id: 'u2', role: 'employer' })
    render(<AuthProvider><Child /></AuthProvider>)
    signIn('u1')
    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1))
    signIn('u2')
    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(2))
    // loadProfile passes the session user id
    expect(getProfile).toHaveBeenLastCalledWith('u2')
    expect(getProfile.mock.calls.at(-1)?.[0]).toBe('u2')
  })

  it('keeps an already-loaded user when a later getProfile call rejects', async () => {
    getProfile.mockResolvedValueOnce({ id: 'u1', role: 'job-seeker' })
    render(<AuthProvider><Child /></AuthProvider>)
    signIn('u1')
    await waitFor(() => expect(screen.getByTestId('auth-role')).toHaveTextContent('job-seeker'))
    // A dropped refetch (e.g. after saving the profile) must not sign the user out.
    getProfile.mockRejectedValueOnce(new Error('network down'))
    signIn('u2')
    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('auth-role')).toHaveTextContent('job-seeker')
  })

  it('holds loading true while a fresh sign-in resolves the profile', async () => {
    setAuthSession(null, true)
    let resolveProfile
    getProfile.mockImplementationOnce(() => new Promise((resolve) => { resolveProfile = resolve }))
    render(<AuthProvider><Child /></AuthProvider>)
    // Settle the initial anonymous resolve first, like the first null session.
    await act(async () => setAuthSession(null, false))
    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('no'))

    signIn('u1')
    // ProtectedRoute must see loading=yes instead of user=null here.
    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('yes'))
    expect(screen.getByTestId('auth-role')).toHaveTextContent('anon')

    await act(async () => resolveProfile({ id: 'u1', role: 'job-seeker' }))
    await waitFor(() => expect(screen.getByTestId('auth-role')).toHaveTextContent('job-seeker'))
    expect(screen.getByTestId('auth-loading')).toHaveTextContent('no')
  })

  it('retries a failed profile load on the next session emit for the same user', async () => {
    getProfile.mockRejectedValueOnce(new Error('network down'))
    render(<AuthProvider><Child /></AuthProvider>)
    signIn('u1')
    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('no'))
    expect(screen.getByTestId('auth-role')).toHaveTextContent('anon')

    getProfile.mockResolvedValueOnce({ id: 'u1', role: 'job-seeker' })
    signIn('u1')
    await waitFor(() => expect(screen.getByTestId('auth-role')).toHaveTextContent('job-seeker'))
  })

  it('leaves the user null when there is none and getProfile rejects', async () => {
    getProfile.mockRejectedValueOnce(new Error('network down'))
    render(<AuthProvider><Child /></AuthProvider>)
    signIn('u1')
    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1))
    // loading only settles after the catch ran — proves the rejection path completed
    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('no'))
    expect(screen.getByTestId('auth-role')).toHaveTextContent('anon')
  })
})

describe('AuthProvider authenticate seed', () => {
  it('uses the already-resolved profile without a second fetch', async () => {
    render(<AuthProvider><AuthenticateProbe /></AuthProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'seed' }))
    await waitFor(() => expect(screen.getByTestId('auth-role')).toHaveTextContent('employer'))
    expect(screen.getByTestId('auth-loading')).toHaveTextContent('no')
    expect(getProfile).not.toHaveBeenCalled()
    expect(setApiIdentity).toHaveBeenCalledWith('u1')
  })
})

describe('AuthProvider API cache identity', () => {
  it('sets the identity before reading the profile and resets it on sign-out', async () => {
    getProfile.mockResolvedValue({ id: 'u1', role: 'job-seeker' })
    render(<AuthProvider><Child /></AuthProvider>)
    signIn('u1')

    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1))
    expect(setApiIdentity).toHaveBeenCalledWith('u1')
    expect(setApiIdentity.mock.invocationCallOrder[0])
      .toBeLessThan(getProfile.mock.invocationCallOrder[0])

    signOutSession()
    await waitFor(() => expect(screen.getByTestId('auth-role')).toHaveTextContent('anon'))
    expect(setApiIdentity).toHaveBeenLastCalledWith('anon')
  })
})

describe('AuthProvider logout', () => {
  it('calls the Better Auth signOut and clears the state and identity', async () => {
    getProfile.mockResolvedValue({ id: 'u1', role: 'job-seeker' })
    render(<AuthProvider><LogoutProbe /></AuthProvider>)
    signIn('u1')
    await waitFor(() => expect(screen.getByTestId('auth-role')).toHaveTextContent('job-seeker'))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'log out' }))
    })

    expect(authClientMock.signOut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByTestId('auth-role')).toHaveTextContent('anon'))
    expect(screen.getByTestId('auth-loading')).toHaveTextContent('no')
    expect(setApiIdentity).toHaveBeenLastCalledWith('anon')
  })
})

describe('AuthProvider stale-response guard', () => {
  it('drops a slow profile response after a different user signed in', async () => {
    // user A's fetch resolves late — after user B already loaded
    let resolveA
    getProfile.mockImplementationOnce(() => new Promise((res) => { resolveA = res; }))
    getProfile.mockResolvedValueOnce({ id: 'u2', role: 'employer' })
    render(<AuthProvider><Child /></AuthProvider>)

    signIn('u1')
    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1))
    signIn('u2')
    await waitFor(() => expect(screen.getByTestId('auth-role')).toHaveTextContent('employer'))

    await act(async () => { resolveA({ id: 'u1', role: 'job-seeker' }); })
    expect(screen.getByTestId('auth-role')).toHaveTextContent('employer')
  })

  it('does not resurrect a signed-out user when an in-flight fetch resolves late', async () => {
    let resolveA
    getProfile.mockImplementationOnce(() => new Promise((res) => { resolveA = res; }))
    render(<AuthProvider><Child /></AuthProvider>)

    signIn('u1')
    await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1))
    signOutSession()
    await waitFor(() => expect(screen.getByTestId('auth-role')).toHaveTextContent('anon'))

    await act(async () => { resolveA({ id: 'u1', role: 'job-seeker' }); })
    expect(screen.getByTestId('auth-role')).toHaveTextContent('anon')
  })
})

describe('AuthProvider user object identity', () => {
  it('keeps the same user object when a refetch returns identical data', async () => {
    // A fresh object every call, like the real GET /auth/me round-trip.
    getProfile.mockImplementation(() => Promise.resolve({ id: 'u1', role: 'employer', company_name: 'Acme', skills: ['welding'] }))
    render(<AuthProvider><ProfileIdentityProbe sessionUser={{ id: 'u1' }} /></AuthProvider>)
    signIn('u1')
    await waitFor(() => expect(screen.getByTestId('probe-user-objects')).toHaveTextContent('1'))
    expect(getProfile).toHaveBeenCalledTimes(1)

    // refreshUser after a save — the server sends back exactly what we hold.
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await act(async () => {})
    // No new user object, so the page's `useEffect([user])` never re-fires.
    expect(screen.getByTestId('probe-user-objects')).toHaveTextContent('1')
  })

  it('hands out a new user object when a profile value changed', async () => {
    getProfile.mockImplementationOnce(() => Promise.resolve({ id: 'u1', role: 'employer', company_name: 'Acme' }))
    getProfile.mockImplementationOnce(() => Promise.resolve({ id: 'u1', role: 'employer', company_name: 'Acme Foods' }))
    render(<AuthProvider><ProfileIdentityProbe sessionUser={{ id: 'u1' }} /></AuthProvider>)
    signIn('u1')
    await waitFor(() => expect(screen.getByTestId('probe-company')).toHaveTextContent('Acme'))

    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await act(async () => {})
    expect(screen.getByTestId('probe-company')).toHaveTextContent('Acme Foods')
    expect(screen.getByTestId('probe-user-objects')).toHaveTextContent('2')
  })

  it('compares non-primitive fields by value, not by reference', async () => {
    getProfile.mockImplementationOnce(() => Promise.resolve({ id: 'u1', role: 'employer', skills: ['welding'] }))
    // Same contents, different array reference — the real server sends a new array.
    getProfile.mockImplementationOnce(() => Promise.resolve({ id: 'u1', role: 'employer', skills: ['welding'] }))
    render(<AuthProvider><ProfileIdentityProbe sessionUser={{ id: 'u1' }} /></AuthProvider>)
    signIn('u1')
    await waitFor(() => expect(screen.getByTestId('probe-skills')).toHaveTextContent('welding'))

    // Same array contents -> no new object.
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await act(async () => {})
    expect(screen.getByTestId('probe-user-objects')).toHaveTextContent('1')

    // Different array contents -> new object, and the new value lands.
    getProfile.mockImplementationOnce(() => Promise.resolve({ id: 'u1', role: 'employer', skills: ['welding', 'driving'] }))
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await act(async () => {})
    expect(screen.getByTestId('probe-skills')).toHaveTextContent('welding, driving')
    expect(screen.getByTestId('probe-user-objects')).toHaveTextContent('2')
  })
})
