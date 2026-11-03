import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Applicants from '../Applicants'
import { listByCompany, updateApplicationStatus } from '../../../shared/services/applications'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'employer-1' } }),
}))

vi.mock('../../../shared/services/applications', () => ({
  listByCompany: vi.fn(),
  updateApplicationStatus: vi.fn(),
}))

// SeekerProfileCard (imported by Applicants) pulls the seeker/document services,
// which reach the Supabase client — stub them out.
vi.mock('../../../shared/services/seekers', () => ({
  listSeekerEducation: vi.fn(),
  listSeekerExperience: vi.fn(),
}))
vi.mock('../../../shared/services/documents', () => ({ signedUrl: vi.fn() }))

const APPLICANT = {
  id: 'app-1',
  status: 'Under Review',
  applied_at: '2026-01-05T00:00:00.000Z',
  seeker: { id: 's1', full_name: 'juan dela cruz' },
  job: { title: 'Warehouse Associate' },
}

async function renderRow(applicant) {
  listByCompany.mockResolvedValue([applicant])
  render(<Applicants />)
  await screen.findByText('Warehouse Associate')
}

describe('Applicants — revert Under Review to Applied', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateApplicationStatus.mockResolvedValue({ id: 'app-1', status: 'Applied' })
  })

  it('reverts an Under Review applicant back to Applied', async () => {
    await renderRow(APPLICANT)

    const undo = screen.getByTitle('Revert to Applied')
    expect(undo).toHaveTextContent('Undo Review')

    fireEvent.click(undo)

    await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledTimes(1))
    const [id, status] = updateApplicationStatus.mock.calls[0]
    expect(id).toBe('app-1')
    expect(status).toBe('Applied')
  })

  it('hides the revert button (and shows Review) for an Interview row', async () => {
    await renderRow({ ...APPLICANT, status: 'Interview' })

    expect(screen.queryByTitle('Revert to Applied')).not.toBeInTheDocument()
    expect(screen.getByTitle('Move back to Under Review')).toHaveTextContent('Review')
  })
})
