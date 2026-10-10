import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute'

vi.mock('../../hooks/useAuth', () => ({
  default: vi.fn(),
}))

import useAuth from '../../hooks/useAuth'

function renderWithRouter(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={route} element={ui} />
        <Route path="/employer/login" element={<div>Employer Login</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  it('shows loading screen while loading', () => {
    useAuth.mockReturnValue({ user: null, role: null, loading: true })
    renderWithRouter(<ProtectedRoute role="employer"><div>Secret</div></ProtectedRoute>)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('redirects unauthenticated user to login', async () => {
    useAuth.mockReturnValue({ user: null, role: null, loading: false })
    renderWithRouter(
      <ProtectedRoute role="employer"><div>Secret</div></ProtectedRoute>,
      { route: '/employer' }
    )
    expect(await screen.findByText('Employer Login')).toBeInTheDocument()
    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
  })

  it('redirects wrong-role user to their portal home', async () => {
    useAuth.mockReturnValue({ user: { id: '1' }, role: 'job-seeker', loading: false })
    renderWithRouter(
      <ProtectedRoute role="employer"><div>Secret</div></ProtectedRoute>,
      { route: '/employer' }
    )
    expect(await screen.findByText('Employer Login')).toBeInTheDocument()
    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
  })

  it('renders children for correct role', () => {
    useAuth.mockReturnValue({ user: { id: '1' }, role: 'employer', loading: false })
    renderWithRouter(
      <ProtectedRoute role="employer"><div>Employer Dashboard</div></ProtectedRoute>,
      { route: '/employer' }
    )
    expect(screen.getByText('Employer Dashboard')).toBeInTheDocument()
  })
})