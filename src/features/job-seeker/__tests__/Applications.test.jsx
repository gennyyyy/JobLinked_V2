import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Applications from '../Applications'
import { listBySeeker } from '../../../shared/services/applications'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1' } }),
}))

vi.mock('../../../shared/services/applications', () => ({
  listBySeeker: vi.fn(),
}))

function makeApplication(overrides = {}) {
  return {
    id: 'app-1',
    status: 'Applied',
    applied_at: '2026-01-15T00:00:00.000Z',
    job_id: 'job-1',
    interview_at: null,
    interview_instructions: null,
    employer_notes: null,
    job: { title: 'Barangay Health Worker', employers: { company_name: 'Santa Maria Health Office' } },
    ...overrides,
  }
}

// Renders the page and returns the expandable application row.
async function renderRow(application) {
  listBySeeker.mockResolvedValue([application])
  render(
    <MemoryRouter>
      <Applications />
    </MemoryRouter>
  )
  return screen.findByRole('button', { name: /Barangay Health Worker/i })
}

describe('Applications expanded panel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders multiple Bring items as a bulleted list, not chips', async () => {
    const row = await renderRow(makeApplication({
      status: 'Interview',
      interview_at: '2026-02-01T09:00:00.000Z',
      interview_instructions: 'Location: City Hall\nBring: Valid ID, Resume, Ballpen',
    }))
    fireEvent.click(row)

    expect(screen.getByText('What to Bring (3)')).toBeInTheDocument()
    expect(screen.getByRole('list')).toHaveTextContent('Valid ID')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('renders a single Bring item as the inline chip with no list', async () => {
    const row = await renderRow(makeApplication({
      status: 'Interview',
      interview_at: '2026-02-01T09:00:00.000Z',
      interview_instructions: 'Bring: Resume',
    }))
    fireEvent.click(row)

    expect(screen.getByText('What to Bring (1)')).toBeInTheDocument()
    expect(screen.getByText('Resume')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('shows non-empty explainer copy for a Placed application with no interview data', async () => {
    const row = await renderRow(makeApplication({ status: 'Placed' }))
    fireEvent.click(row)

    expect(screen.getByText('Placed in Position')).toBeInTheDocument()
    expect(screen.getByText(/placed into this position/i)).toBeInTheDocument()
  })

  it('shows non-empty explainer copy for a Terminated application with no interview data', async () => {
    const row = await renderRow(makeApplication({ status: 'Terminated' }))
    fireEvent.click(row)

    expect(screen.getByText('Engagement Ended')).toBeInTheDocument()
    expect(screen.getByText(/engagement has ended/i)).toBeInTheDocument()
  })
})
