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
    expect(screen.getByRole('heading', { name: 'PESO Services' })).toBeInTheDocument()
  })

  it('renders all four services with the three labelled descriptions', () => {
    render(
      <MemoryRouter>
        <PesoServices />
      </MemoryRouter>
    )
    for (const title of [
      'Job matching & placement',
      'Community job fairs',
      'Career guidance',
      'Skills & livelihood training',
    ]) {
      expect(screen.getByRole('heading', { name: title, level: 2 })).toBeInTheDocument()
    }
    expect(screen.getAllByText('What it is')).toHaveLength(4)
    expect(screen.getAllByText('Who it’s for')).toHaveLength(4)
    expect(screen.getAllByText('How to get it')).toHaveLength(4)
    expect(
      screen.getByText(
        'PESO shares announcements and referrals for skills training and livelihood programs run with TESDA and other partner agencies.'
      )
    ).toBeInTheDocument()
  })
})
