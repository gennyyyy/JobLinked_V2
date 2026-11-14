import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Legal from '../Legal'
import { getLegal } from '../../../shared/services/legal'

vi.mock('../../../shared/services/legal', () => ({ getLegal: vi.fn() }))

describe('Legal page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the fallback when the API rejects', async () => {
    getLegal.mockRejectedValue(new Error('boom'))
    render(
      <MemoryRouter>
        <Legal title="Privacy notice" document="privacy" />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getByText(/Data Privacy Act of 2012, RA 10173/)).toBeInTheDocument(),
    )
  })

  it('renders the API body when it resolves', async () => {
    getLegal.mockResolvedValue('API body text')
    render(
      <MemoryRouter>
        <Legal title="Privacy notice" document="privacy" />
      </MemoryRouter>,
    )
    expect(await screen.findByText('API body text')).toBeInTheDocument()
  })

  it('renders the fallback on empty string', async () => {
    getLegal.mockResolvedValue('')
    render(
      <MemoryRouter>
        <Legal title="Privacy notice" document="privacy" />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getByText(/Data Privacy Act of 2012, RA 10173/)).toBeInTheDocument(),
    )
  })
})