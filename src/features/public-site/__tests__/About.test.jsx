import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import About from '../About'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: null, loading: false }),
}))

describe('About page', () => {
  it('renders heading', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Built around people, not paperwork.' })).toBeInTheDocument()
  })
})