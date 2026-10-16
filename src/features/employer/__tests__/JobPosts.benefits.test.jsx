import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobPosts from '../JobPosts'
import { getEmployer } from '../../../shared/services/auth'
import { listEmployerJobs, createJob } from '../../../shared/services/jobs'

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

async function openCreateForm() {
  getEmployer.mockResolvedValue(APPROVED_EMPLOYER)
  listEmployerJobs.mockResolvedValue({ data: [], total: [].length, page: 1, pageSize: 25 })
  createJob.mockResolvedValue({})
  render(
    <MemoryRouter>
      <JobPosts />
    </MemoryRouter>
  )

  const openBtn = await screen.findByRole('button', { name: /post a vacancy/i })
  await waitFor(() => expect(openBtn).toBeEnabled())
  fireEvent.click(openBtn)
}

// Fill the fields validate() requires so the save payload is actually sent.
async function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText(/Administrative Officer/), { target: { value: 'Welder' } })
  fireEvent.change(screen.getByPlaceholderText(/Outline key duties/), { target: { value: 'Weld metal parts.' } })
  fireEvent.click(screen.getByRole('button', { name: /select barangay/i }))
  fireEvent.click(screen.getByRole('option', { name: 'Bulac' }))
}

describe('JobPosts benefits chip toggler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('selects a benefit chip on click and deselects it on the second click', async () => {
    await openCreateForm()
    const chip = screen.getByRole('button', { name: 'SSS' })

    expect(chip).not.toHaveClass('bg-primary')
    fireEvent.click(chip)
    expect(chip).toHaveClass('bg-primary')
    fireEvent.click(chip)
    expect(chip).not.toHaveClass('bg-primary')
  })

  it('saves the selected benefits newline-joined', async () => {
    await openCreateForm()
    await fillRequiredFields()
    fireEvent.click(screen.getByRole('button', { name: 'SSS' }))
    fireEvent.click(screen.getByRole('button', { name: 'PhilHealth' }))

    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() =>
      expect(createJob).toHaveBeenCalledWith(
        'emp-1',
        expect.objectContaining({ benefits: 'SSS\nPhilHealth' })
      )
    )
  })
})
