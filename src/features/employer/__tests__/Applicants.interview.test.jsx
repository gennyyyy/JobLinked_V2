import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Applicants from '../Applicants'
import { listByCompany, updateApplicationStatus } from '../../../shared/services/applications'
import { formatFullAddress } from '../../../shared/utils/address'

// The scheduler auto-fills the meeting location from the employer's address,
// which the auth provider merges into `user` from GET /auth/me.
// vi.hoisted so the mock factory (which vitest hoists) can safely read it.
const { USER } = vi.hoisted(() => ({
  USER: {
    id: 'employer-1',
    street_address: '123 Rizal St',
    barangay_district: 'Sto. Rosario',
    city_municipality: 'Santa Maria',
    province_state: 'Bulacan',
  },
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: USER }),
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

const DEFAULT_LOCATION = formatFullAddress(USER)

async function openScheduler() {
  render(<Applicants />)
  fireEvent.click(await screen.findByTitle('Schedule an interview'))
  return screen.findByLabelText(/interview date & time/i)
}

describe('Applicants interview instruction presets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listByCompany.mockResolvedValue([APPLICANT])
    updateApplicationStatus.mockResolvedValue({ id: 'app-1', status: 'Interview' })
  })

  it('composes selected attire and bring chips into interviewInstructions', async () => {
    const dateInput = await openScheduler()
    fireEvent.change(dateInput, { target: { value: '2026-05-01T10:00' } })

    fireEvent.click(screen.getByRole('button', { name: 'Formal / Corporate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Valid Government ID' }))
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Bring your portfolio' } })

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))

    await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledTimes(1))
    const [id, status, extra] = updateApplicationStatus.mock.calls[0]
    expect(id).toBe('app-1')
    expect(status).toBe('Interview')
    expect(extra.interviewAt).toBe('2026-05-01T10:00')
    expect(extra.interviewInstructions).toBe(
      `Location: ${DEFAULT_LOCATION}\nAttire: Formal / Corporate\nBring: Valid Government ID\nBring your portfolio`
    )
  })

  it('sends only the typed instructions when no chips are selected', async () => {
    const dateInput = await openScheduler()
    fireEvent.change(dateInput, { target: { value: '2026-05-01T10:00' } })
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Meet at the lobby' } })

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))

    await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledTimes(1))
    const extra = updateApplicationStatus.mock.calls[0][2]
    expect(extra.interviewInstructions).toBe(`Location: ${DEFAULT_LOCATION}\nMeet at the lobby`)
    expect(extra.interviewInstructions).not.toMatch(/Attire:|Bring:/)
  })

  it('auto-fills the meeting location from the employer address', async () => {
    await openScheduler()
    expect(screen.getByLabelText('Meeting Location')).toHaveValue(DEFAULT_LOCATION)
  })

  it('sends the overridden meeting location instead of the default', async () => {
    const dateInput = await openScheduler()
    fireEvent.change(dateInput, { target: { value: '2026-05-01T10:00' } })
    fireEvent.change(screen.getByLabelText('Meeting Location'), { target: { value: 'PESO Office, Ground Floor' } })

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))

    await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledTimes(1))
    expect(updateApplicationStatus.mock.calls[0][2].interviewInstructions).toBe(
      'Location: PESO Office, Ground Floor'
    )
  })

  it('no longer offers "Smart Casual" among the attire presets', async () => {
    await openScheduler()
    expect(screen.queryByRole('button', { name: 'Smart Casual' })).toBeNull()
  })

  it('toggles the interview card open and closed on repeated clicks', async () => {
    render(<Applicants />)
    const toggle = await screen.findByTitle('Schedule an interview')

    fireEvent.click(toggle)
    expect(await screen.findByLabelText(/interview date & time/i)).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByTitle('Hide interview details'))
    expect(screen.queryByLabelText(/interview date & time/i)).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps the toggle when the applicant is already at Interview', async () => {
    listByCompany.mockResolvedValue([{ ...APPLICANT, status: 'Interview' }])
    render(<Applicants />)

    fireEvent.click(await screen.findByTitle('Schedule an interview'))
    expect(await screen.findByLabelText(/interview date & time/i)).toBeInTheDocument()
  })
})
