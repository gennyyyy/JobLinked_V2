import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SidebarAccount from '../SidebarAccount'

function renderAccount(props = {}) {
  return render(
    <MemoryRouter>
      <SidebarAccount
        user={{ full_name: 'jane owner', email: 'jane@acme.test' }}
        profileTo="/employer/profile"
        roleLabel="Employer"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('SidebarAccount', () => {
  it('renders the title-cased name and role label', () => {
    renderAccount()
    expect(screen.getByText('Jane Owner')).toBeInTheDocument()
    expect(screen.getByText('Employer')).toBeInTheDocument()
  })

  it('derives initials from the first and last name', () => {
    renderAccount({ user: { full_name: 'jane owner' } })
    expect(screen.getByText('JO')).toBeInTheDocument()
  })

  it('falls back to first_name/last_name initials', () => {
    renderAccount({ user: { first_name: 'Ada', last_name: 'Lovelace' } })
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('falls back to the email when the user has no name', () => {
    renderAccount({ user: { email: 'anon@acme.test' }, roleLabel: 'Job Seeker' })
    // titleCase capitalizes the first letter of the fallback name.
    expect(screen.getByText(/anon@acme\.test/i)).toBeInTheDocument()
  })

  it('links the profile button to profileTo and fires onNavigate', () => {
    const onNavigate = vi.fn()
    renderAccount({ onNavigate })
    const link = screen.getByRole('link', { name: /jane owner/i })
    expect(link).toHaveAttribute('href', '/employer/profile')
    fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('fires onLogout from the sign out button', () => {
    const onLogout = vi.fn()
    renderAccount({ onLogout })
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })
})
