import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../Dashboard'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/applications', () => ({ listBySeeker: vi.fn() }))
vi.mock('../../../shared/services/jobs', () => ({ listJobs: vi.fn() }))
vi.mock('../../../shared/services/notifications', () => ({ listNotifications: vi.fn() }))

import useAuth from '../../../shared/hooks/useAuth'
import { listBySeeker } from '../../../shared/services/applications'
import { listJobs } from '../../../shared/services/jobs'
import { listNotifications } from '../../../shared/services/notifications'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

const APPLICATIONS = [
  { id: 'a1', job_id: 'j9', status: 'Accepted', applied_at: daysAgo(1), job: { title: 'Warehouse Associate', employers: { company_name: 'santa maria trading' } } },
]
const JOBS = [{ id: 'j1', title: 'Truck Driver', location: 'Santa Maria', employers: { company_name: 'sm logistics' } }]

function renderDashboard() {
  render(<MemoryRouter><Dashboard /></MemoryRouter>)
}

describe('Job-seeker Dashboard error state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'seeker-1', first_name: 'Juan', full_name: 'juan dela cruz' } })
    listNotifications.mockResolvedValue([])
  })

  it('keeps an h1 and shows a neutral message with Retry when load fails', async () => {
    const neutralError = new Error('We couldn\u2019t load this right now. Please check your connection and try again.')
    neutralError.status = 0
    neutralError.detail = 'Cannot reach the API at http://localhost:4000'
    listBySeeker.mockRejectedValue(neutralError)
    listJobs.mockResolvedValue({ jobs: [] })

    renderDashboard()

    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()

    const body = document.body.textContent
    expect(body).not.toMatch(/localhost/)
    expect(body).not.toMatch(/npm:/)
    expect(body).not.toMatch(/Cannot reach/)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('Retry refetches and renders the dashboard on success', async () => {
    const user = userEvent.setup()
    listBySeeker.mockRejectedValueOnce(new Error('Network down'))
    listJobs.mockResolvedValue({ jobs: [] })
    renderDashboard()

    await screen.findByRole('alert')
    const retryBtn = screen.getByRole('button', { name: /retry/i })

    // Now the mocks succeed
    listBySeeker.mockResolvedValue(APPLICATIONS)
    listJobs.mockResolvedValue({ jobs: JOBS })

    await user.click(retryBtn)

    expect(await screen.findByText(/good to see you, juan/i)).toBeInTheDocument()
    expect(screen.getByText('Applications sent')).toBeInTheDocument()
  })

  it('neutral message when jobs service fails', async () => {
    listBySeeker.mockResolvedValue([])
    listJobs.mockRejectedValue(new Error('We couldn\u2019t load this right now. Please check your connection and try again.'))
    renderDashboard()

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()

    const body = document.body.textContent
    expect(body).not.toMatch(/localhost/)
  })
})
