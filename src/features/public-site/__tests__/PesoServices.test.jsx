import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PesoServices from '../PesoServices'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: null, loading: false }),
}))

describe('PesoServices page', () => {
  it('renders heading', () => {
    render(
      <MemoryRouter>
        <PesoServices />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: "You don't have to take the next step alone." })).toBeInTheDocument()
  })
})