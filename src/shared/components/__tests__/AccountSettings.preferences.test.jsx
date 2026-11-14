import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccountSettings from '../AccountSettings'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/account', () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}))
vi.mock('../../services/auth', () => ({
  changeEmail: vi.fn(),
  listMfaFactors: vi.fn().mockResolvedValue([]),
  enrollMfa: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  unenrollMfa: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getPreferences, updatePreferences } from '../../../shared/services/account'

describe('AccountSettings preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'job-seeker', email: 'a@b.ph' } })
    getPreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    updatePreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
  })

  it('loads server values into the switches', async () => {
    getPreferences.mockResolvedValue({ application_updates: false, community_announcements: true })
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)

    await waitFor(() => expect(getPreferences).toHaveBeenCalled())
    const appSwitch = document.querySelector('#application-updates')
    const commSwitch = document.querySelector('#community-notices')
    await waitFor(() => {
      expect(appSwitch).not.toBeChecked()
      expect(commSwitch).toBeChecked()
    })
  })

  it('toggling enables Save and PATCH receives only the changed key', async () => {
    getPreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)
    await waitFor(() => expect(getPreferences).toHaveBeenCalled())

    const appSwitch = document.querySelector('#application-updates')
    fireEvent.click(appSwitch)

    const saveBtn = screen.getByRole('button', { name: /save preferences/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())

    fireEvent.click(saveBtn)
    await waitFor(() => expect(updatePreferences).toHaveBeenCalledWith({ application_updates: false }))
  })

  it('shows an error and keeps values on failure', async () => {
    getPreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)
    await waitFor(() => expect(getPreferences).toHaveBeenCalled())

    updatePreferences.mockRejectedValueOnce(new Error('Save failed'))
    const appSwitch = document.querySelector('#application-updates')
    fireEvent.click(appSwitch)
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')
    expect(document.querySelector('#application-updates')).not.toBeChecked()
  })

  it('announces success once', async () => {
    getPreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)
    await waitFor(() => expect(getPreferences).toHaveBeenCalled())

    const appSwitch = document.querySelector('#application-updates')
    fireEvent.click(appSwitch)
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))

    const statuses = await screen.findAllByRole('status')
    // Loading… may be gone; ensure at least one success status
    expect(statuses.some((el) => /saved/i.test(el.textContent))).toBe(true)
    // only one status announcing saved
    const savedStatuses = screen.getAllByRole('status').filter((el) => /saved/i.test(el.textContent))
    expect(savedStatuses).toHaveLength(1)
  })

  it('shows a loading state', async () => {
    let resolve
    getPreferences.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(document.querySelector('#application-updates')).toBeDisabled()
    resolve({ application_updates: true, community_announcements: true })
  })
})
