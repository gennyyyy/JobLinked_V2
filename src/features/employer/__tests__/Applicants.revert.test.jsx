import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

describe('Applicants status updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listByCompany.mockResolvedValue([APPLICANT])
    updateApplicationStatus.mockResolvedValue({ id: 'app-1', status: 'Applied' })
  })

  it('reverts an Under Review applicant back to Applied', async () => {
    render(<Applicants />)
    fireEvent.click(await screen.findByRole('button', { name: /review candidate juan dela cruz/i }))

    fireEvent.change(within(await screen.findByRole('dialog')).getByLabelText(/recruitment status/i), { target: { value: 'Applied' } })
    fireEvent.click(screen.getByRole('button', { name: /update candidate/i }))

    await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledTimes(1))
    expect(updateApplicationStatus).toHaveBeenCalledWith('app-1', 'Applied', {
      interviewAt: null,
      interviewInstructions: null,
      employerNotes: null,
    })
  })

  it('shows the recorded status in the review dialog', async () => {
    listByCompany.mockResolvedValue([{ ...APPLICANT, status: 'Interview' }])
    render(<Applicants />)
    fireEvent.click(await screen.findByRole('button', { name: /review candidate juan dela cruz/i }))

    expect(within(await screen.findByRole('dialog')).getByLabelText(/recruitment status/i)).toHaveValue('Interview')
  })
})
