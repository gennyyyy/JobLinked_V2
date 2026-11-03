import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccountMenu from '../AccountMenu'
import { displayName } from '../../utils/accountName'

const user = { full_name: 'jane owner', email: 'jane@acme.test' }

function renderMenu(props = {}) {
  return render(
    <MemoryRouter>
      <AccountMenu
        user={user}
        profileTo="/employer/profile"
        roleLabel="Employer"
        onLogout={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('AccountMenu', () => {
  it('trigger name = display name', () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: displayName(user, 'Employer') })
    expect(trigger).toBeInTheDocument()
  })

  it('opens with aria-expanded true', () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: displayName(user, 'Employer') })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('Profile links to profileTo', () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: displayName(user, 'Employer') })
    fireEvent.click(trigger)
    const link = screen.getByRole('link', { name: /profile/i })
    expect(link).toHaveAttribute('href', '/employer/profile')
  })

  it('Sign out calls handler', () => {
    const onLogout = vi.fn()
    renderMenu({ onLogout })
    const trigger = screen.getByRole('button', { name: displayName(user, 'Employer') })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('outside pointerdown closes', () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: displayName(user, 'Employer') })
    fireEvent.click(trigger)
    fireEvent.pointerDown(document)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('Escape closes+refocuses', () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: displayName(user, 'Employer') })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(trigger)
  })
})