import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import Applicants from '../Applicants'
import { listByCompany, updateApplicationStatus } from '../../../shared/services/applications'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'employer-1' } }),
}))

vi.mock('../../../shared/services/applications', () => ({
  listByCompany: vi.fn(),
  updateApplicationStatus: vi.fn(),
  getApplicationHistory: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../../shared/services/seekers', () => ({
  listSeekerEducation: vi.fn(),
  listSeekerExperience: vi.fn(),
}))
vi.mock('../../../shared/services/documents', () => ({ signedUrl: vi.fn() }))

const APPLICANT = {
  id: 'app-1',
  status: 'Under Review',
  applied_at: '2026-01-05T00:00:00.000Z',
  seeker: { id: 's1', full_name: 'juan dela cruz', barangay_district: 'Bulac' },
  job: { id: 'j1', title: 'Warehouse Associate' },
}

describe('Applicants — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listByCompany.mockResolvedValue([APPLICANT])
  })

  it('keeps the list and the dialog when a status change fails', async () => {
    updateApplicationStatus.mockRejectedValue(new Error('status boom'))
    render(<Applicants />)
    fireEvent.click(await screen.findByRole('button', { name: /review candidate juan dela cruz/i }))

    fireEvent.change(within(await screen.findByRole('dialog')).getByLabelText(/recruitment status/i), { target: { value: 'Rejected' } })
    fireEvent.click(screen.getByRole('button', { name: /update candidate/i }))

    await waitFor(() => expect(within(screen.getByRole('dialog')).getAllByRole('alert').some((alert) => alert.textContent.includes('status boom'))).toBe(true))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText(/failed to load applicants/i)).toBeNull()
  })

  it('shows a load error instead of the table when the applicants request fails', async () => {
    listByCompany.mockRejectedValue(new Error('list boom'))
    render(<Applicants />)

    expect(await screen.findByText('list boom')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull())
  })
})
