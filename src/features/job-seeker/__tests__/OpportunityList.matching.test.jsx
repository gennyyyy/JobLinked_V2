import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OpportunityList from '../OpportunityList'
import { listJobs } from '@/shared/services/jobs'
import { matchJobs } from '@/shared/services/ai'

vi.mock('@/shared/services/jobs', () => ({ listJobs: vi.fn() }))
vi.mock('@/shared/services/ai', () => ({ matchJobs: vi.fn() }))

vi.mock('@/shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1', role: 'job-seeker', skills: [] } }),
}))

const NOTICE = 'AI matching is unavailable right now — showing standard results.'

function job(overrides = {}) {
  return {
    id: 'j1',
    title: 'Administrative Assistant',
    status: 'published',
    location: 'Poblacion',
    employment_type: 'Full-time',
    salary_min: 18000,
    salary_max: 22000,
    created_at: '2026-10-18T00:00:00.000Z',
    employers: { company_name: 'Northfield Business Solutions', accreditation_status: 'approved' },
    ...overrides,
  }
}

const JOBS = [
  job(),
  job({ id: 'j2', title: 'Junior Web Developer', created_at: '2026-10-10T00:00:00.000Z', employers: { company_name: 'Hiraya Digital Studio', accreditation_status: 'approved' } }),
  job({ id: 'j3', title: 'Warehouse Helper', created_at: '2026-10-05T00:00:00.000Z', employers: { company_name: 'Santa Maria Logistics', accreditation_status: 'approved' } }),
  // Not part of the matching pool: the employer is not accredited yet.
  job({ id: 'j4', title: 'Pending Employer Role', employers: { company_name: 'Unvetted Corp', accreditation_status: 'pending' } }),
]

const STANDARD = ['Administrative Assistant', 'Junior Web Developer', 'Warehouse Helper']

function cardTitles() {
  return [...document.querySelectorAll('.job-card [data-slot="card-title"]')].map((node) => node.textContent)
}

function cardFor(title) {
  // The open dialog hides the background list from the a11y tree, so find the
  // card by text instead of by role.
  return screen.getByText(title, { selector: 'a' }).closest('.job-card')
}

function renderList() {
  return render(<MemoryRouter><OpportunityList /></MemoryRouter>)
}

async function submitPrompt(text) {
  if (!screen.queryByRole('dialog')) {
    fireEvent.click(screen.getByRole('button', { name: 'AI job matching' }))
  }
  fireEvent.change(screen.getByLabelText('Your job preferences'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: /send preferences/i }))
}

function deferred() {
  let resolve
  const promise = new Promise((settle) => { resolve = settle })
  return { promise, resolve }
}

describe('OpportunityList AI matching', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    listJobs.mockResolvedValue({ jobs: JOBS, total: JOBS.length })
    matchJobs.mockResolvedValue({ mode: 'ai', ranking: [], reasons: [] })
  })

  it('ranks the visible jobs by the server order and passes the per-job reason', async () => {
    matchJobs.mockResolvedValue({
      mode: 'ai',
      ranking: ['j3', 'j1', 'j2'],
      reasons: [{ jobId: 'j3', reason: 'Same barangay and warehouse experience' }],
      generatedAt: '2026-11-05T00:00:00.000Z',
    })
    renderList()
    await screen.findByText('Administrative Assistant')

    await submitPrompt('night shift')

    await waitFor(() => expect(cardTitles()).toEqual(['Warehouse Helper', 'Administrative Assistant', 'Junior Web Developer']))
    // Only the open + accredited jobs are sent as candidates.
    expect(matchJobs).toHaveBeenCalledWith('night shift', ['j1', 'j2', 'j3'])
    expect(within(cardFor('Warehouse Helper')).getByText('Same barangay and warehouse experience')).toBeInTheDocument()
    // The dialog and the results area both disclose the mode.
    expect(screen.getAllByText('AI ranking active')).toHaveLength(2)
  })

  it('falls back to the standard order with one discreet notice when the request fails', async () => {
    matchJobs.mockRejectedValue(new Error('provider unavailable'))
    renderList()
    await screen.findByText('Administrative Assistant')

    await submitPrompt('night shift')

    expect(await screen.findByText(NOTICE)).toBeInTheDocument()
    await waitFor(() => expect(cardTitles()).toEqual(STANDARD))
    expect(screen.queryByText('AI ranking active')).toBeNull()
  })

  it('dispatches a new request when the same prompt is submitted again', async () => {
    matchJobs.mockResolvedValue({ mode: 'ai', ranking: ['j3', 'j1', 'j2'], reasons: [] })
    renderList()
    await screen.findByText('Administrative Assistant')

    await submitPrompt('night shift')
    await waitFor(() => expect(cardTitles()).toEqual(['Warehouse Helper', 'Administrative Assistant', 'Junior Web Developer']))

    await submitPrompt('night shift')

    await waitFor(() => expect(matchJobs).toHaveBeenCalledTimes(2))
    // The second request settles, so Send is usable again (no stuck busy state).
    await waitFor(() => expect(screen.getByRole('button', { name: /send preferences/i })).toBeEnabled())
  })

  it('retries the same prompt after a failure and clears the notice on success', async () => {
    matchJobs
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce({ mode: 'ai', ranking: ['j3', 'j2', 'j1'], reasons: [] })
    renderList()
    await screen.findByText('Administrative Assistant')

    await submitPrompt('night shift')
    expect(await screen.findByText(NOTICE)).toBeInTheDocument()

    await submitPrompt('night shift')

    await waitFor(() => expect(matchJobs).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(cardTitles()).toEqual(['Warehouse Helper', 'Junior Web Developer', 'Administrative Assistant']))
    expect(screen.queryByText(NOTICE)).toBeNull()
  })

  it('ignores a late ranking after switching back to standard matching', async () => {
    const pending = deferred()
    matchJobs.mockReturnValue(pending.promise)
    renderList()
    await screen.findByText('Administrative Assistant')

    await submitPrompt('night shift')
    fireEvent.click(screen.getByRole('button', { name: /use standard matching/i }))
    expect(cardTitles()).toEqual(STANDARD)

    await act(async () => {
      pending.resolve({ mode: 'ai', ranking: ['j3', 'j2', 'j1'], reasons: [{ jobId: 'j3', reason: 'Late reason' }] })
    })

    expect(cardTitles()).toEqual(STANDARD)
    expect(screen.queryByText('Late reason')).toBeNull()
  })

  it('ignores an earlier response that lands after a newer request', async () => {
    const first = deferred()
    const second = deferred()
    matchJobs.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    renderList()
    await screen.findByText('Administrative Assistant')

    await submitPrompt('night shift')
    fireEvent.click(screen.getByRole('button', { name: /view matching jobs/i }))
    // Re-querying the list (filter change) starts a second request mid-flight.
    fireEvent.change(screen.getByLabelText('Job category'), { target: { value: 'Full-time' } })
    await waitFor(() => expect(matchJobs).toHaveBeenCalledTimes(2))

    await act(async () => {
      second.resolve({ mode: 'ai', ranking: ['j3', 'j2', 'j1'], reasons: [{ jobId: 'j3', reason: 'Newest reason' }] })
    })
    await waitFor(() => expect(cardTitles()).toEqual(['Warehouse Helper', 'Junior Web Developer', 'Administrative Assistant']))

    await act(async () => {
      first.resolve({ mode: 'ai', ranking: ['j1', 'j2', 'j3'], reasons: [{ jobId: 'j1', reason: 'Stale reason' }] })
    })

    expect(cardTitles()).toEqual(['Warehouse Helper', 'Junior Web Developer', 'Administrative Assistant'])
    expect(screen.queryByText('Stale reason')).toBeNull()
    expect(within(cardFor('Warehouse Helper')).getByText('Newest reason')).toBeInTheDocument()
  })

  it('keeps disclosing the matching mode in the results area after the dialog closes', async () => {
    matchJobs.mockResolvedValue({ mode: 'deterministic', ranking: ['j2', 'j1', 'j3'], reasons: [] })
    renderList()
    await screen.findByText('Administrative Assistant')

    await submitPrompt('night shift')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // The disclosure outlives the closable dialog, so the per-card reasons are
    // never mistaken for AI output.
    expect(screen.getByText('Standard matching · no AI')).toBeInTheDocument()
    await waitFor(() => expect(cardTitles()).toEqual(['Junior Web Developer', 'Administrative Assistant', 'Warehouse Helper']))

    matchJobs.mockResolvedValue({ mode: 'ai', ranking: ['j3', 'j1', 'j2'], reasons: [] })
    await submitPrompt('night shift')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    expect(screen.getByText('AI ranking active')).toBeInTheDocument()
    expect(screen.queryByText('Standard matching · no AI')).toBeNull()
  })
})
