import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PublicShell from '../PublicShell'

describe('PublicShell footer', () => {
  it('points every footer link at its dedicated page', () => {
    render(
      <MemoryRouter>
        <PublicShell><p>content</p></PublicShell>
      </MemoryRouter>,
    )

    for (const [name, href] of [
      ['Career resources', '/peso-services'],
      ['Employer registration', '/register/employer'],
      ['Accreditation process', '/how-it-works'],
      ['About the platform', '/about'],
      ['PESO services', '/peso-services'],
      ['Frequently asked questions', '/faq'],
    ]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
    }
  })

  it('renders the footer without duplicate-key console errors', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <MemoryRouter>
          <PublicShell><p>content</p></PublicShell>
        </MemoryRouter>,
      )

      const duplicateKeyCalls = errorSpy.mock.calls.filter(([message]) => String(message).includes('same key'))
      expect(duplicateKeyCalls).toEqual([])
    } finally {
      errorSpy.mockRestore()
    }
  })
})
