import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccountSettings from '../AccountSettings'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/account', () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  exportAccount: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getPreferences, exportAccount } from '../../../shared/services/account'

describe('AccountSettings data controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'job-seeker', full_name: 'Ana Cruz', email: 'ana@example.com' } })
    getPreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    exportAccount.mockResolvedValue(undefined)
  })

  it('downloads the caller data from the account overview panel', async () => {
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)
    await waitFor(() => expect(getPreferences).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /export my data/i }))

    await waitFor(() => expect(exportAccount).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('status')).toHaveTextContent(/downloaded/i)
  })

  it('shows the server message when the export fails', async () => {
    exportAccount.mockRejectedValueOnce(new Error('Export unavailable'))
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)
    await waitFor(() => expect(getPreferences).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /export my data/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Export unavailable')
  })
})
