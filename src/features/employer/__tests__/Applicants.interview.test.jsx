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

async function openReview() {
  render(<Applicants />)
  fireEvent.click(await screen.findByRole('button', { name: /review candidate juan dela cruz/i }))
  return within(await screen.findByRole('dialog')).getByLabelText(/recruitment status/i)
}

describe('Applicants interview scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listByCompany.mockResolvedValue([APPLICANT])
    updateApplicationStatus.mockResolvedValue({ id: 'app-1', status: 'Interview' })
  })

  it('requires a date and time before scheduling an interview', async () => {
    const statusSelect = await openReview()
    fireEvent.change(statusSelect, { target: { value: 'Interview' } })
    fireEvent.click(screen.getByRole('button', { name: /update candidate/i }))

    await waitFor(() => expect(within(screen.getByRole('dialog')).getAllByRole('alert').some((alert) => /choose an interview date and time/i.test(alert.textContent))).toBe(true))
    expect(updateApplicationStatus).not.toHaveBeenCalled()
  })

  it('sends the interview date, location, and internal notes', async () => {
    const statusSelect = await openReview()
    fireEvent.change(statusSelect, { target: { value: 'Interview' } })
    fireEvent.change(screen.getByLabelText(/interview date & time/i), { target: { value: '2026-05-01T10:00' } })
    fireEvent.change(screen.getByLabelText(/location or meeting link/i), { target: { value: 'PESO Office, Ground Floor' } })
    fireEvent.change(screen.getByLabelText(/internal recruitment notes/i), { target: { value: 'Strong portfolio' } })
    fireEvent.click(screen.getByRole('button', { name: /update candidate/i }))

    await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledTimes(1))
    expect(updateApplicationStatus).toHaveBeenCalledWith('app-1', 'Interview', {
      interviewAt: '2026-05-01T10:00',
      interviewInstructions: 'PESO Office, Ground Floor',
      employerNotes: 'Strong portfolio',
    })
  })
})
