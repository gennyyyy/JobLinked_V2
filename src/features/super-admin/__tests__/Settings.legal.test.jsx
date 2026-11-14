import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/admin', () => ({
  listReferenceData: vi.fn(),
  addReferenceData: vi.fn(),
  removeReferenceData: vi.fn(),
}))
vi.mock('../../../shared/services/legal', () => ({
  getLegal: vi.fn(),
  updateLegal: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { listReferenceData } from '../../../shared/services/admin'
import { getLegal, updateLegal } from '../../../shared/services/legal'
import Settings from '../Settings'

describe('super-admin Settings — legal documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'a1', role: 'super-admin', permissions: null }, full_name: 'Admin' })
    listReferenceData.mockResolvedValue([])
    getLegal.mockImplementation((key) => Promise.resolve(key === 'privacy' ? 'Privacy body' : 'Terms body'))
    updateLegal.mockResolvedValue({ key: 'privacy', body: 'Edited privacy body' })
  })

  it('renders both legal documents', async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>)
    expect(await screen.findByDisplayValue('Privacy body')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Terms body')).toBeInTheDocument()
  })
  it('Save calls updateLegal and shows success', async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>)
    const textarea = await screen.findByDisplayValue('Privacy body')
    fireEvent.change(textarea, { target: { value: 'Edited privacy body' } })
    fireEvent.click(screen.getAllByRole('button', { name: /^save$/i })[0])
    await waitFor(() => expect(updateLegal).toHaveBeenCalledWith('privacy', 'Edited privacy body'))
    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i)
  })
  it('shows an error when the server rejects an empty body', async () => {
    updateLegal.mockRejectedValueOnce(new Error('Document body cannot be empty.'))
    render(<MemoryRouter><Settings /></MemoryRouter>)
    const textarea = await screen.findByDisplayValue('Privacy body')
    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.click(screen.getAllByRole('button', { name: /^save$/i })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be empty/i)
  })

  it('disables editing without settings.manage permission', async () => {
    useAuth.mockReturnValue({ user: { id: 'a1', role: 'super-admin', permissions: [] }, full_name: 'Admin' })
    render(<MemoryRouter><Settings /></MemoryRouter>)
    const textarea = await screen.findByDisplayValue('Privacy body')
    expect(textarea).toBeDisabled()
  })
})
