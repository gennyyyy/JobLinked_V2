import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
  deleteJob: vi.fn(),
}))

const APPROVED_EMPLOYER = { id: 'emp-1', name: 'Santa Maria Trading', accreditation_status: 'approved' }

async function openForm() {
  getEmployer.mockResolvedValue(APPROVED_EMPLOYER)
  listEmployerJobs.mockResolvedValue({ data: [], total: [].length, page: 1, pageSize: 25 })
  render(
    <MemoryRouter>
      <JobPosts />
    </MemoryRouter>
  )
  fireEvent.click(await screen.findByRole('button', { name: /post a vacancy/i }))
  return screen.findByRole('heading', { name: /post a municipal vacancy/i })
}

// The form's labels are not tied to their inputs (pre-existing), so target the
// title field by its placeholder.
function titleField() {
  return screen.getByPlaceholderText(/e.g. Administrative Officer/i)
}

describe('JobPosts unsaved-changes guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('closes without asking when the form is untouched', async () => {
    await openForm()
    fireEvent.click(screen.getByRole('button', { name: 'Close form' }))

    expect(screen.queryByRole('heading', { name: /post a municipal vacancy/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('asks before discarding typed input, and keeps the form when declined', async () => {
    await openForm()
    fireEvent.change(titleField(), { target: { value: 'Administrative Officer' } })

    fireEvent.click(screen.getByRole('button', { name: 'Close form' }))
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /keep editing/i }))
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
    expect(titleField()).toHaveValue('Administrative Officer')
  })

  it('discards on confirm and closes the form', async () => {
    await openForm()
    fireEvent.change(titleField(), { target: { value: 'Administrative Officer' } })

    fireEvent.click(screen.getByRole('button', { name: 'Close form' }))
    fireEvent.click(screen.getByRole('button', { name: /discard changes/i }))

    expect(screen.queryByRole('heading', { name: /post a municipal vacancy/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('also guards the Cancel button', async () => {
    await openForm()
    fireEvent.change(titleField(), { target: { value: 'Administrative Officer' } })

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
  })
})
