import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobPosts from '../JobPosts'
import { getEmployer } from '../../../shared/services/auth'
import { listEmployerJobs } from '../../../shared/services/jobs'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'employer-user-1' } }),
}))

vi.mock('../../../shared/services/auth', () => ({
  getEmployer: vi.fn(),
}))

vi.mock('../../../shared/services/jobs', () => ({
  listEmployerJobs: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  changeJobStatus: vi.fn(),
  duplicateJob: vi.fn(),
}))

const APPROVED_EMPLOYER = { id: 'emp-1', name: 'Santa Maria Trading', accreditation_status: 'approved' }

async function renderAndOpenForm() {
  getEmployer.mockResolvedValue(APPROVED_EMPLOYER)
  listEmployerJobs.mockResolvedValue({ data: [], total: [].length, page: 1, pageSize: 25 })
  render(
    <MemoryRouter>
      <JobPosts />
    </MemoryRouter>
  )

  const openBtn = await screen.findByRole('button', { name: /post a vacancy/i })
  await waitFor(() => expect(openBtn).toBeEnabled())
  fireEvent.click(openBtn)

  const trigger = await screen.findByRole('button', { name: /select barangay/i })
  fireEvent.click(trigger)
  return trigger
}

describe('JobPosts barangay search filter', () => {
  // Every test renders the whole JobPosts page and opens the vacancy form,
  // which costs ~3s on a box already loaded by parallel vitest workers -
  // inside the 5s default, so the timeout (not the filter) decides the result.
  // ponytail: 20s; raise it if the page grows heavier imports.
  beforeEach(() => vi.clearAllMocks())

  it('filters the listbox to matching barangays', { timeout: 20_000 }, async () => {
    await renderAndOpenForm()
    fireEvent.change(screen.getByLabelText(/search barangay/i), { target: { value: 'bu' } })

    expect(screen.getByRole('option', { name: 'Bulac' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pulong Buhangin' })).toBeInTheDocument()
    // 'Buenavista' also legitimately contains 'bu'
    expect(screen.queryByRole('option', { name: 'Bagbaguin' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Tumana' })).not.toBeInTheDocument()
  })

  it('shows a non-interactive message when nothing matches', { timeout: 20_000 }, async () => {
    await renderAndOpenForm()
    fireEvent.change(screen.getByLabelText(/search barangay/i), { target: { value: 'zz' } })

    expect(screen.getByText('No barangays match')).toBeInTheDocument()
    expect(screen.queryByRole('listbox', { name: 'Barangay location' })).not.toBeInTheDocument()
  })

  it('selecting a filtered option sets the trigger label and closes the dropdown', { timeout: 20_000 }, async () => {
    const trigger = await renderAndOpenForm()
    fireEvent.change(screen.getByLabelText(/search barangay/i), { target: { value: 'bulac' } })
    fireEvent.click(screen.getByRole('option', { name: 'Bulac' }))

    expect(trigger).toHaveTextContent('Bulac')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/search barangay/i)).not.toBeInTheDocument()
  })
})
